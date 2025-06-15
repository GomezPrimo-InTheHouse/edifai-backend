const express = require('express');

require('dotenv').config();

const notificacionRoutes = require('../routes/notificacion/notificacion.route.js')

const app = express();
const PORT = process.env.PORT_NOTIFICACION || 7005;

app.use(express.json());  

app.use('/notificacion', notificacionRoutes)



app.listen(PORT, () => {
    console.log(`Microservicio de Notificaciones corriendo en http://localhost:${PORT}`);
}
);