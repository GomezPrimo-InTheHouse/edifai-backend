const express = require('express');

require('dotenv').config();
const app = express();

const PORT =  7004;

//esto es un log para la consola...
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de Obra`);
  next();
});

app.use(express.json());


app.use('/obra', require('../routes/obra/obra.routes.js'));

// coma antes del req --> '_req', buena practica para evitar errores de linting si no se usa el parámetro 
app.get('/health', (_req, res) => {
  res.json({
    service: 'Microservicio de Obras',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Microservicio de obra corriendo en http://localhost:${PORT}`);
});