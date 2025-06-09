const express = require('express');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT_ACTIVIDAD || 7004;

const actividadRoute = require('../routes/actividad/actividad.route.js');

app.use(express.json());   

app.use('/actividad', actividadRoute)

app.listen(PORT, () => {
    console.log(`Microservicio de Actividad corriendo en http://localhost:${PORT}`);
}
);