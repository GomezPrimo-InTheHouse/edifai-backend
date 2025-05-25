const express = require('express');
const axios = require('axios');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { startAutoRefresh } = require('./utils/autoRefresh');
const { registrarHistorial } = require('./microservicio-historial');

const pool = require('./db/db.js')

const { verifyToken, generateToken, authenticateUser, generateRefreshToken } = require('./auth');

const app = express();
const PORT = process.env.PORT || 6000;
const NUM_SERVICE_URL = process.env.NUM_SERVICE_URL;


const refreshTokens = [];

// Middleware
app.use(express.json());




// Middleware de registro (logging)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('Error en la aplicación:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Rutas


app.post('/login', authenticateUser, async (req, res) => {
  const username = req.user.username;
  try {
    // expire en 10 minutoss
    const accessToken = generateToken({ username: req.user.username },{ expiresIn:'10m' });
    const refreshToken = generateRefreshToken({ username: req.user.username },{ expiresIn: '24h' });


// Guarda o actualiza el access_token y el resresh_token en la base de datos
   const query = `
      INSERT INTO tokens (username, access_token, refresh_token)
      VALUES ($1, $2, $3)
      ON CONFLICT (username) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        updated_at = CURRENT_TIMESTAMP;
    `;


   await pool.query(query, [username, accessToken, refreshToken]);

    // Registro y hago uso del microservicio de historial de login
   await registrarHistorial({
        username,
        accion: 'login',
        estado: 'exito',
        mensaje: 'Usuario inició sesión correctamente'
      });

    res.json({ 
      accessToken,
      expiresTokenIn: '10m',
      refreshToken,
      expiresRefreshTokenIn: '24hr',
      message: 'Autenticación exitosa',
      
    },
    startAutoRefresh(),

  );

  
    
  } catch (error) {

   
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al generar el token' }
      
    );
  }
});

app.get('/sum', verifyToken, async (req, res) => {
  try {


    // Realizar solicitud al microservicio de números
    const response = await axios.get(NUM_SERVICE_URL);
    const { num1, num2 } = response.data;
    
    const suma = num1 + num2;
    
    res.json({ 
      result: suma,
      operation: `${num1} + ${num2}`,
      user: req.user.username,
      timestamp: new Date().toISOString()
    });


    const username = process.env.AUTH_USERNAME;
    await registrarHistorial({
        username,
        accion: 'suma',
        estado: 'exito',
        mensaje: 'Usuario utilizo endp de suma correctamente'
      });

  } catch (error) {
    console.error('Error al obtener números aleatorios:', error);
     await registrarHistorial({
        username,
        accion: 'suma',
        estado: 'error',
        mensaje: 'Usuario utilizo endp de suma con error'
      });
    res.status(500).json({ error: 'Error al realizar la operación de suma' });
  }
});

// Endpoint de información
app.get('/info', verifyToken, (req, res) => {
  res.json({
    service: 'API de suma con autenticación JWT',
    user: req.user.username,
    endpoints: [
      { path: '/login', method: 'POST', description: 'Autenticación de usuario y generación de token' },
      { path: '/sum', method: 'GET', description: 'Obtiene dos números aleatorios y devuelve su suma' },
      { path: '/info', method: 'GET', description: 'Información sobre la API' }
    ]
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor API corriendo en http://localhost:${PORT}`);
  //llamo a la functon de auto refresh unos minutos antes de que expire el token
   
});







app.post('/refresh', async (req, res) => {
   const { refreshToken } = req.body; // o usa req.headers['authorization'] si prefieres

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh Token requerido' });
  }

  try {
    // Verificar JWT
    const decoded = jwt.verify(refreshToken,  process.env.JWT_SECRET);

    const username = decoded.username;

    // Buscar el refreshToken en la base de datos
    const result = await pool.query('SELECT refresh_token FROM tokens WHERE username = $1', [username]);

    if (!result.rows[0] || result.rows[0].refresh_token !== refreshToken) {
      return res.status(403).json({ message: 'Refresh Token no válido o no coincide' });
    }

    // Generar nuevo AccessToken
    const newAccessToken = jwt.sign({ username },  process.env.JWT_SECRET , { expiresIn: '15m' });

    // Actualizar accessToken en la DB
    await pool.query('UPDATE tokens SET access_token = $1, updated_at = CURRENT_TIMESTAMP WHERE username = $2', [newAccessToken, username]);

    res.json({ accessToken: newAccessToken });

  } catch (error) {
    console.error(error);
    return res.status(403).json({ message: 'Refresh Token inválido o expirado' });
  }
});

app.post('/create-user', async (req, res) => {
  const { name, password, role } = req.body;

  const allowedRoles = process.env.ROLE.split(','); // ['admin', 'user']

  try {
    // Validar campos requeridos
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `El rol '${role}' no es válido. Debe ser uno de: ${allowedRoles.join(', ')}`
      });
    }

    if (!name || !password || !role) {
      return res.status(400).json({
        success: false,
        error: 'Usuario, contraseña o rol no proporcionado'
      });
    }

    // Insertar en la base de datos
    const query = `
      INSERT INTO users (name, password, role)
      VALUES ($1, $2, $3)
      RETURNING id, name, role, created_at;
    `;
    const values = [name, password, role]; // luego cambiar password por hash

    const result = await pool.query(query, values); // asumiendo que tienes pool configurado

    const user = result.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Nuevo usuario creado',
      user
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: 'Error al crear un nuevo usuario'
    });
  }
});
