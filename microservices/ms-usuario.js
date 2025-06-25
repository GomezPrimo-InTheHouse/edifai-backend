const express = require('express');

require('dotenv').config();
const app = express();

const PORT = process.env.PORT_USUARIO || 7002;

//esto es un log para la consola...
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de usuarios`);
  next();
});

app.use(express.json());



app.use('/usuario', require('../routes/usuario/userRol/user.routes.js'));

// coma antes del req --> '_req', buena practica para evitar errores de linting si no se usa el parámetro 
app.get('/health', (_req, res) => {
  res.json({
    service: 'Microservicio de usuarios',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Microservicio de usuario corriendo en http://localhost:${PORT}`);
});