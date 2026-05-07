const express = require('express');
require('dotenv').config();

const app = express();
const PORT = 7004;

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
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de Obra`);
  next();
});

app.use(express.json());

app.use('/obra', require('../routes/obra/obra.routes.js'));
app.use('/dashboard', require('../routes/dashboard/dashboard.routes.js'));

app.get('/health', (_req, res) => {
  res.json({
    service: 'Microservicio de Obras',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Microservicio de obra corriendo en http://localhost:${PORT}`);
});