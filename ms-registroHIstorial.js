// microservicio-historial.js
const pool = require('./db/db.js'); 

const express = require('express');
require('dotenv').config();

const app = express();
const PORT =  7001;

//esto es un log para la consola...
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de historial`);
  next();
});





app.use(express.json());

app.post('/registrar-historial', async (req, res) => {

  console.log('Recibido registro de historial:', req.body);
  const { username, accion, estado, mensaje } = req.body;

  if (!username || !accion || !estado) {
    return res.status(400).json({ error: 'Faltan campos requeridos: username, accion, estado' });
  }

  try {
    
      const query = `
        INSERT INTO historial (username, accion, estado, mensaje)
        VALUES ($1, $2, $3, $4)
      `;
      const values = [username || null, accion, estado, mensaje || null];
  
      await pool.query(query, values);
  
      console.log();
      res.status(200).json({ 
        success: true,
        messaje: `Acción registrada: ${accion} - Usuario: ${username} - Estado: ${estado}`
       });
    

  } catch (error) {
    console.error('Error al registrar historial:', error);
    res.status(500).json({ error: 'Error interno del servidor al registrar historial' });
  }


})

const registrarHistorial = async ({ username, accion, estado, mensaje }) => {
  try {
    const query = `
      INSERT INTO historial (username, accion, estado, mensaje)
      VALUES ($1, $2, $3, $4)
    `;
    const values = [username || null, accion, estado, mensaje || null];

    await pool.query(query, values);

    console.log(`[Historial] Acción registrada: ${accion} - Usuario: ${username} - Estado: ${estado}`);
  } catch (error) {
    console.error(`[Historial] Error al registrar historial:`, error);
  }
};

// Endpoint de información
app.get('/health', (req, res) => {
  res.json({
    service: 'Microservicio de historial',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Microservicio de historial en http://localhost:${PORT}`);
});

// module.exports = { registrarHistorial };
