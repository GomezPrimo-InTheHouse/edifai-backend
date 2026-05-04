const express = require('express');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT_TRABAJADOR || 7003;

// const especialidadRoutes = require('../routes/especialidad/especialidad.routes.js');
// const trabajadorRoutes = require('../routes/trabajadores/trabajadores.routes.js');
// const presentismoRoutes = require('../routes/presentismo/presentismo.routes.js');

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

//esto es un log para la consola...
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de trabajadores`);
  next();
});

app.use(express.json());


app.use('/especialidad', require('../routes/especialidad/especialidad.routes.js'));
app.use('/trabajador', require('../routes/trabajadores/trabajadores.routes.js'));
app.use('/presentismo', require('../routes/presentismo/presentismo.routes.js'));


// coma antes del req --> '_req', buena practica para evitar errores de linting si no se usa el parámetro 
app.get('/health', (_req, res) => {
  res.json({
    service: 'Microservicio de trabajadores',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Microservicio de trabajadores corriendo en http://localhost:${PORT}`);
});