const pool = require('../db/db.js'); 
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const express = require('express');
require('dotenv').config();

const app = express();

const PORT =  7001;

//esto es un log para la consola...
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de Autenticación`);
  next();
});

app.use(express.json());




app.post('/register', async (req, res) => {
    try {
        const { nombre, email, password, rol  } = req.body;

        //hashear la password
        const password_hash = await bcrypt.hash(password, 10);

        // Validar que el email no esté ya registrado
        const user = await pool.query(`SELECT * FROM usuarios WHERE email = $1`, [email]);
        //si encuentra un usuario con el mismo email, retorna un error
        if (user.rows.length > 0) {
          return res.status(400).json({ message: 'El email ya está registrado' });
          }

        // Validar los datos de entrada
        if (!nombre || !email || !password) {
            return res.status(400).json({ error: 'Faltan nombre, email o password' });
        }

        // Crear el usuario en la base de datos
        const nuevoUsuario = await pool.query
          ('INSERT INTO usuarios (rol, nombre, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING *',
           [rol, nombre, email, password_hash]);

        

        return res.status(201).json(nuevoUsuario.rows[0]);
    } catch (error) {
        console.error('Error al crear usuario:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
})

app.post('/login', async (req, res) => {
    const authHeader = req.headers['authorization'];

  // Validamos el header Basic Auth
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Falta la cabecera Authorization' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [email, password] = credentials.split(':');

  if (!email || !password) {
    return res.status(400).json({ error: 'Formato inválido de credenciales' });
  }

  try {
    const usuarioResult = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);

    if (usuarioResult.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const usuario = usuarioResult.rows[0];
    const passwordCorrecta = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordCorrecta) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // Obtenemos rol (si lo tienes en la tabla)
    const rol = usuario.rol || 'user';

    // Generamos los tokens
    const accessToken = jwt.sign(
      { userId: usuario.id, email: usuario.email, rol },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: usuario.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Guardamos la sesión
    await pool.query(
      'INSERT INTO sesiones (usuario_id, access_token, refresh_token, totp_seed) VALUES ($1, $2, $3, $4)',
      [usuario.id, accessToken, refreshToken, 'placeholder-totp-seed']
    );

    return res.status(200).json({
      message: 'Inicio de sesión exitoso',
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
})


// Endpoint de información
app.get('/health', (req, res) => {
  res.json({
    service: 'Microservicio de números aleatorios',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Microservicio de auth corriendo en http://localhost:${PORT}`);
});