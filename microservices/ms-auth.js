const express = require('express');

require('dotenv').config();
const app = express();

const {register, obtenerUsuarios} = require('../controllers/auth/register.controller.js');
const { login } = require('../controllers/auth/login.controller.js');
const { refreshAccessToken } = require('../controllers/auth/authWithRefresh.controller.js');
const { logout } = require('../controllers/auth/logout.controller.js');
const { darDeBajaUsuario } = require('../controllers/auth/deleteUser.controller.js');

const basicAuth = require('../middlewares/basicAuth.js');

const PORT =  7001;

//esto es un log para la consola...
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Microservicio de Autenticación`);
  next();
});

app.use(express.json());

// refactorizar el  codigo adicionandole una carpeta para las rutas.
// aqui solo deberia ir un app.use('/api/auth', require('./routes/auth.routes.js'));


app.post('/register', register);

app.post('/login', basicAuth , login)

app.post('/logout', logout) 

app.delete('/deleteUser', darDeBajaUsuario) 

app.post('/refresh-token', refreshAccessToken)

app.get('/obtenerUsuarios', obtenerUsuarios)


app.get('/health', (req, res) => {
  res.json({
    service: 'Microservicio de números aleatorios',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Microservicio de auth corriendo en http://localhost:${PORT}`);
});