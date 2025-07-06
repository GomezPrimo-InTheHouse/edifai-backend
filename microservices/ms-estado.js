const express = require('express');

require('dotenv').config();
const app = express();

const PORT = process.env.PORT_ESTADO || 7006


app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de estados`);
  next();
});

app.use(express.json());


app.use('/estado', require('../routes/estado/estado.routes.js'));


// coma antes del req --> '_req', buena practica para evitar errores de linting si no se usa el parámetro 
app.get('/health', (_req, res) => {
  res.json({
    service: 'Microservicio de estados',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Microservicio de estados corriendo en http://localhost:${PORT}`);
});