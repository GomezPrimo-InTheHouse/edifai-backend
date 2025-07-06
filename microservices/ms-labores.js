const express = require('express');

require('dotenv').config();
const app = express();

const PORT = process.env.PORT_LABORES || 7005


app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de labores`);
  next();
});

app.use(express.json());


app.use('/labor', require('../routes/labores/labores.routes.js'));


// coma antes del req --> '_req', buena practica para evitar errores de linting si no se usa el parámetro 
app.get('/health', (_req, res) => {
  res.json({
    service: 'Microservicio de labores',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Microservicio de labores corriendo en http://localhost:${PORT}`);
});