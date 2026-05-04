const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 7009;

// DESPUÉS — agregar métodos explícitamente:
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

const router = require('../routes/notificaciones/notificaciones.routes');
app.use('/notificaciones', router);

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'ms-notificaciones' }));

app.listen(PORT, () => {
  console.log(`🔔 ms-notificaciones corriendo en puerto ${PORT}`);
});