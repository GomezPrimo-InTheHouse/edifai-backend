// ms-materiales.js - Servidor Express puerto 7007
// TODO: Implementar servidor Express para microservicio de materiales
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.MS_PORT || 7007;

// CORS
// app.use((req, res, next) => {
//   res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
//   if (req.method === 'OPTIONS') return res.sendStatus(200);
//   next();
// });

// Log
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de Materiales`);
  next();
});

app.use(express.json());

app.use('/materiales', require('../routes/materiales/materiales.routes.js'));
app.use('/tipoMaterial', require('../routes/materiales/tipoMaterial.routes.js'));
app.use('/historial', require('../routes/materiales/historialIncremento.routes.js'));
app.use('/presupuestos', require('../routes/presupuestos/presupuestos.routes.js'));
app.use('/presupuestoMateriales', require('../routes/presupuestos/presupuestoMateriales.routes.js'));

app.get('/health', (_req, res) => {
  res.json({ service: 'Microservicio de Materiales', status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Microservicio de materiales corriendo en http://localhost:${PORT}`);
});