

const express = require('express');

const router = express.Router();

router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de asistenteIA`);
  next();
});

router.use(express.json());

router.use('/asistente', require('../../routes/asistenteIA/asistente.routes.js'));

router.get('/health', (_req, res) => {
  res.json({
    service: 'Microservicio de asistenteIA',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;