const express = require('express');
const app = express();
const inscripcionRoute = require('../routes/inscripcion/inscripcion.route.js');
const PORT = process.env.PORT_INSCRIPCION || 7003;

app.use(express.json());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de Inscripción`);
  next();
});

// Importar las rutas de inscripción


app.use('/inscripcion', inscripcionRoute)


app.listen(PORT, () => {
    console.log(`Microservicio de Inscripción corriendo en http://localhost:${PORT}`);
    }
);

