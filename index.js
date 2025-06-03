const express = require('express');

require('dotenv').config();

const authRoute = require('./ms-auth.js');


const app = express();
const PORT = process.env.PORT || 6000;





// Middleware
app.use(express.json());




// Middleware de registro (logging)
// app.use((req, res, next) => {
//   console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
//   next();
// });

// // Manejador global de errores
// app.use((err, req, res, next) => {
//   console.error('Error en la aplicación:', err);
//   res.status(500).json({ error: 'Error interno del servidor' });
// });

// Rutas

app.use('/auth', authRoute);

// app.post('/login', authenticateUser, async (req, res) => {
//   const username = req.user.username;
//   try {
//     // expire en 10 minutoss
//     const accessToken = generateToken({ username: req.user.username },{ expiresIn:'10m' });
//     const refreshToken = generateRefreshToken({ username: req.user.username },{ expiresIn: '24h' });


// // Guarda o actualiza el access_token y el resresh_token en la base de datos
//    const query = `
//       INSERT INTO sesiones (username, access_token, refresh_token)
//       VALUES ($1, $2, $3)
//       ON CONFLICT (username) DO UPDATE SET
//         access_token = EXCLUDED.access_token,
//         refresh_token = EXCLUDED.refresh_token,
//         updated_at = CURRENT_TIMESTAMP;
//     `;


//    await pool.query(query, [username, accessToken, refreshToken]);

//     // Registro y hago uso del microservicio de historial de login
//    await registrarHistorial({
//         username,
//         accion: 'login',
//         estado: 'exito',
//         mensaje: 'Usuario inició sesión correctamente'
//       });

//     res.json({ 
//       accessToken,
//       expiresTokenIn: '10m',
//       refreshToken,
//       expiresRefreshTokenIn: '24hr',
//       message: 'Autenticación exitosa',
      
//     },
//     startAutoRefresh()  //testeando la function de refresh token

//   );

  
    
//   } catch (error) {

   
//     console.error('Error en login:', error);
//     res.status(500).json({ error: 'Error al generar el token' }
      
//     );
//   }
// });





// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor API corriendo en http://localhost:${PORT}`);
  //llamo a la functon de auto refresh unos minutos antes de que expire el token
   
});




// app.post('/refresh', async (req, res) => {
//    const { refreshToken } = req.body; // o usa req.headers['authorization'] si prefieres

//   if (!refreshToken) {
//     return res.status(400).json({ message: 'Refresh Token requerido' });
//   }

//   try {
//     // Verificar JWT
//     const decoded = jwt.verify(refreshToken,  process.env.JWT_SECRET);

//     const username = decoded.username;

//     // Buscar el refreshToken en la base de datos
//     const result = await pool.query('SELECT refresh_token FROM tokens WHERE username = $1', [username]);

//     if (!result.rows[0] || result.rows[0].refresh_token !== refreshToken) {
//       return res.status(403).json({ message: 'Refresh Token no válido o no coincide' });
//     }

//     // Generar nuevo AccessToken
//     const newAccessToken = jwt.sign({ username },  process.env.JWT_SECRET , { expiresIn: '15m' });

//     // Actualizar accessToken en la DB
//     await pool.query('UPDATE tokens SET access_token = $1, updated_at = CURRENT_TIMESTAMP WHERE username = $2', [newAccessToken, username]);

//     res.json({ accessToken: newAccessToken });

//   } catch (error) {
//     console.error(error);
//     return res.status(403).json({ message: 'Refresh Token inválido o expirado' });
//   }
// });


