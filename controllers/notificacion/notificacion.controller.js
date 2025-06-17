const pool = require('../../connection/db.js')

const { enviarCorreo } = require('../../utils/notificacion/send-email.util.js')



const enviarNotificacionModificacionActividad = async (req, res) => {
  const { actividad_id } = req.body;

  try {
    // Obtener la actividad y su evento
    const actividadRes = await pool.query(`
      SELECT a.*, e.nombre AS evento_nombre
      FROM actividades a
      JOIN eventos e ON e.id = a.evento_id
      WHERE a.id = $1
    `, [actividad_id]);

    if (actividadRes.rows.length === 0) {
      return res.status(404).json({ error: 'Actividad no encontrada' });
    }

    const actividad = actividadRes.rows[0];

    // Obtener expositores de la actividad, para luego obtener los emails
    const expositoresRes = await pool.query(`
      SELECT u.nombre, u.email
      FROM actividad_expositores ae
      JOIN usuarios u ON ae.usuario_id = u.id
      WHERE ae.actividad_id = $1
    `, [actividad_id]);

    // Obtener participantes inscritos al evento mediante [actividad.evento_id] a través de la tabla inscripciones
    const participantesRes = await pool.query(`
      SELECT p.nombre, p.email
      FROM inscripciones i
      JOIN participantes p ON i.participante_id = p.id
      WHERE i.evento_id = $1
    `, [actividad.evento_id]);

    // Combinar destinatarios
    // Aca combino los resultados obtenidos de ambas busquedas en la DB, entonces con este array
    // tendré todos los emails de los expositores y participantes.
    const destinatarios = [
      ...expositoresRes.rows,
      ...participantesRes.rows
    ];
    
    console.log(destinatarios)

    //mapeo el array y filtro por email

    const emails = destinatarios.map(d => d.email);

    if (emails.length === 0) {
      console.log('No hay destinatarios con email');

      return res.status(200).json({ mensaje: 'No hay destinatarios con email' });
    }

    // Armar asunto y contenido del mensaje
    const asunto = `Actividad modificada: ${actividad.titulo}`;
    const mensaje = `
      <h2>Se ha modificado la ACTIVIDAD: "${actividad.titulo}"</h2>
      <p><strong>Perteneciente al EVENTO:</strong> ${actividad.evento_nombre}</p>
      <p><strong>Fecha:</strong> ${actividad.fecha}</p>
      <p><strong>Hora:</strong> ${actividad.hora_inicio} - ${actividad.hora_fin}</p>
      <p><strong>Descripción:</strong> ${actividad.descripcion}</p>
    `;

    // Enviar correo (función definida en utils)
    await enviarCorreo({ destinatarios: emails, asunto, mensaje });

    console.log('Notificación enviada con éxito');
    return res.status(200).json({ mensaje: 'Notificación enviada con éxito' });

  } catch (error) {
    console.error('Error al enviar notificación de modificación:', error);
    return res.status(500).json({ error: 'Error interno del servidor al notificar' });
  }
};




async function enviarRecordatorioProximoDia() {
  try {
    const resActividades = await pool.query(`
      SELECT a.*, e.nombre AS evento_nombre
      FROM actividades a
      JOIN eventos e ON e.id = a.evento_id
      WHERE a.fecha = CURRENT_DATE + INTERVAL '1 day'
    `);

    for (const actividad of resActividades.rows) {
      const actividad_id = actividad.id;

      // Obtener expositores
      const expositoresRes = await pool.query(`
        SELECT u.email
        FROM actividad_expositores ae
        JOIN usuarios u ON ae.usuario_id = u.id
        WHERE ae.actividad_id = $1
      `, [actividad_id]);

      // Obtener participantes del evento
      const participantesRes = await pool.query(`
        SELECT u.email
        FROM participantes p
        JOIN usuarios u ON p.usuario_id = u.id
        WHERE p.evento_id = $1
      `, [actividad.evento_id]);

      const emails = [
        ...expositoresRes.rows,
        ...participantesRes.rows
      ].map(d => d.email).filter(Boolean);

      if (emails.length === 0) continue;

      const asunto = `Recordatorio: Actividad mañana - ${actividad.titulo}`;
      const mensaje = `
        <h2>Recordatorio de actividad</h2>
        <p><strong>Título:</strong> ${actividad.titulo}</p>
        <p><strong>Fecha:</strong> ${actividad.fecha}</p>
        <p><strong>Hora:</strong> ${actividad.hora_inicio} - ${actividad.hora_fin}</p>
        <p><strong>Evento:</strong> ${actividad.evento_nombre}</p>
      `;

      await enviarCorreo({ destinatarios: emails, asunto, mensaje });

      console.log(`Recordatorio enviado para actividad ID ${actividad_id}`);
    }

  } catch (err) {
    console.error('Error al enviar recordatorios:', err);
  }
}







module.exports = {
    
    enviarRecordatorioProximoDia,
   
    enviarNotificacionModificacionActividad

}