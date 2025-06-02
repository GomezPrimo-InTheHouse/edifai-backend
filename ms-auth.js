const pool = require('./db/db.js'); 

const express = require('express');
require('dotenv').config();

const app = express();

const PORT =  7001;

//esto es un log para la consola...
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de Autenticación`);
  next();
});

app.use(express.json());




app.post('/crear-usuario', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validar los datos de entrada
        if (!email || !password) {
            return res.status(400).json({ error: 'Faltan email o password' });
        }

        // Crear el usuario en la base de datos
        const nuevoUsuario = await pool.query('INSERT INTO usuarios (email, password) VALUES ($1, $2) RETURNING *', [email, password]);

        // Registrar el historial
        registrarHistorial('crear-usuario', nuevoUsuario.rows[0].id);

        return res.status(201).json(nuevoUsuario.rows[0]);
    } catch (error) {
        console.error('Error al crear usuario:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
})


// Endpoint de información
app.get('/health', (req, res) => {
  res.json({
    service: 'Microservicio de números aleatorios',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Microservicio de números aleatorios corriendo en http://localhost:${PORT}`);
});