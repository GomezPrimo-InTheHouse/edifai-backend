const express = require('express');
const app = express();

require('dotenv').config();

const PORT = process.env.PORT_CLIENTES || 7010;

// CORS
// app.use((req, res, next) => {
//   res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
//   if (req.method === 'OPTIONS') return res.sendStatus(200);
//   next();
// });

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de clientes`);
  next();
});

app.use(express.json());

app.use('/clientes', require('../routes/clientes/clientes.routes.js'));

app.get('/health', (_req, res) => {
  res.json({
    service: 'Microservicio de clientes',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Microservicio de clientes corriendo en http://localhost:${PORT}`);
});