const { spawn } = require('child_process');
const path = require('path');

//aca voy agregando los microservicios que quiero iniciar
// cada uno con su nombre y puerto correspondiente
// el nombre debe ser el mismo que el archivo del microservicio
const services = [
  { name: 'ms-auth.js', port: 7001 },
  { name: 'ms-usuario.js', port: 7002 },
  { name: 'ms-trabajadores.js', port: 7003 },
  { name: 'ms-obra.js', port: 7004 }

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
