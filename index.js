const express = require('express');
const axios = require('axios');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { startAutoRefresh } = require('./utils/autoRefresh');

const cookieParser = require('cookie-parser');

const { verifyToken, generateToken, authenticateUser, generateRefreshToken } = require('./auth');

const app = express();
const PORT = process.env.PORT || 6000;
const NUM_SERVICE_URL = process.env.NUM_SERVICE_URL;


const refreshTokens = [];

// Middleware
app.use(express.json());

app.use(cookieParser());


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


app.post('/login', authenticateUser, (req, res) => {
  try {
    //que expire en 10 minutos
    const token = generateToken({ username: req.user.username },{ expiresIn:'10m' });
    const refreshToken = generateRefreshToken({ username: req.user.username },{ expiresIn: '24h' });

    // Almacenar el refresh token en un array o base de datos
    // refreshTokens.push(refreshToken);
    

    // Grabanmdo las cookies con los tokens, tanto los de access como el token de reshresh
    // las busco en postman, parte inferior derecha.
   
    // res.cookie('accessToken', token, {
    //   httpOnly: true,
    //   secure: true, 
    //   maxAge: 10 * 60 * 1000, // 10m hora en ms ??
    //   sameSite: 'Strict'
    // });

    // res.cookie('refreshToken', refreshToken, {
    //   httpOnly: true,
    //   secure: true,
    //   maxAge: 24 * 60 * 60 * 1000, // 24 horas en ms
    //   sameSite: 'Strict'
    // });

  


    res.json({ 
      token,
      expiresTokenIn: '10m',
      refreshToken,
      expiresRefreshTokenIn: '24hr',
      message: 'Autenticación exitosa',
      
    },
    startAutoRefresh()
  );

  
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al generar el token' });
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
  } catch (error) {
    console.error('Error al obtener números aleatorios:', error);
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



// app.post('/refresh', async (req, res) => {
//   const { refreshToken } = req.body; //entra el token de refresh por el body

//   if (!refreshToken) {
//     return res.status(400).json({ message: 'Refresh Token requerido' });
//   }

  

//   try {
//     const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

//     const newAccessToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

    
//     return res.json({ accessToken: newAccessToken });

//   } catch (error) {
//     console.error(error);
//     return res.status(403).json({ message: 'Refresh Token inválido o expirado' });
//   }
// });


app.post('/refresh', (req, res) => {
  const refreshToken = req.body.refreshToken;


  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh Token requerido' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const newAccessToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: true,
      maxAge: 10 * 60 * 1000, // 1 hora en ms
      sameSite: 'Strict'
    });

    return res.json({ accessToken: newAccessToken });

  } catch (error) {
    console.error(error);
    return res.status(403).json({ message: 'Refresh Token inválido o expirado' });
  }
});


app.post('/create-user', async(req,res)=>{
  const {name, password, role} = req.body

  //sumarle timestamp
  console.log(name, password, role)
  const allowedRoles = process.env.ROLE.split(',');  // ['admin', 'user']
  console.log(allowedRoles)
  
  try {
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `El rol '${role}' no es válido. Debe ser uno de: ${allowedRoles.join(', ')}`
      });
    }

    if (!name || !password || !role) {
      return res.status(400).json({
        success: false,
        error: 'usuario, contraseña o rol no proporcionado'
      });
    }

    

    return res.status(200).json({
      succes:true,
      
      error:'Nuevo usuario creado',
      user:{
        name,
        role,
        
      }
    })
  } catch (error) {
    return res.status(400).json({
      succes:false,
      message:error,
      error:'Error al crear un nuevo user'
    })
  }


});