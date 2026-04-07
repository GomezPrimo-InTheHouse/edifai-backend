const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 7008;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de Pagos`);
  next();
});

app.use(express.json());
app.use('/', require('../routes/pagos/index.js'));

app.get('/health', (_req, res) => {
  res.json({ service: 'Microservicio de Pagos', status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => console.log(`Microservicio de pagos corriendo en http://localhost:${PORT}`));