const { spawn } = require('child_process');
const path = require('path');

const services = [
  { name: 'ms-auth.js', port: 7001 },
  { name: 'ms-evento.js', port: 7002 },
  { name: 'ms-inscripcion.js', port: 7003 },
  { name: 'ms-actividad.js', port: 7004 },
  { name: 'ms-notificacion.js', port: 7005 }
];

services.forEach(service => {
  const servicePath = path.join(__dirname, 'microservices', service.name);

  const child = spawn('node', [servicePath], {
    env: { ...process.env, PORT: service.port },
    stdio: 'inherit',
    shell: true
  });

  child.on('close', code => {
    console.log(`✅ ${service.name} finalizó con código ${code}`);
  });

  child.on('error', err => {
    console.error(`❌ Error al iniciar ${service.name}:`, err);
  });
});
