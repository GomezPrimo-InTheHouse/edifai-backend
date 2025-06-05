const express = require('express');

require('dotenv').config();

app = express();

const PORT = process.env.PORT_EVENTO || 7002;

const eventoRoute = require('../routes/evento/evento.route.js');

//esto es un log para la consola...
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de registro de eventos`);
  next();
});



app.use(express.json());


// me busco las rutas asociadas a este microservicio
app.use('/evento', eventoRoute)


app.get('/health', (req, res) => {
  res.json({
    service: 'Microservicio de Eventos',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Microservicio de Eventos corriendo en http://localhost:${PORT}`);
});