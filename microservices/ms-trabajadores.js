const express = require('express');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT_TRABAJADOR || 7003;



//esto es un log para la consola...
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de trabajadores`);
  next();
});

app.use(express.json());


app.use('/especialidad', require('../routes/especialidad/especialidad.routes.js'));
app.use('/trabajador', require('../routes/trabajadores/trabajadores.routes.js'));

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