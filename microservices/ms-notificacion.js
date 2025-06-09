const express = require('express');

require('dotenv').config();



const app = express();
const PORT = process.env.PORT_NOTIFICACION || 7005;

app.use(express.json());  




app.listen(PORT, () => {
    console.log(`Microservicio de Notificaciones corriendo en http://localhost:${PORT}`);
}
);