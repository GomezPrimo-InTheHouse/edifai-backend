const pool = require('../../connection}/db.js');
const QRCode = require('qrcode');

//  para añadir al participante a un evento, primero debe estar registrado tajnto el participante como el evento,
//  luego se crea una relacion entre ambos.

//en la tabla de eventos de mi db, tiene asociado un

const registrarParticipante = async (req, res) =>{

    const { nombre, apellido, email, telefono } = req.body;

    try {
        const participanteExistente = await pool.query('SELECT * FROM participantes WHERE email = $1', [email]);

        if (participanteExistente.rows.length > 0) {
            return res.status(409).json({ error: 'El participante ya está registrado con este email' });
        }

        if (!nombre || !apellido || !email || !telefono) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        const result = await pool.query(`
            INSERT INTO participantes (nombre, apellido, email, telefono, creado_en)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id, nombre, apellido, email, telefono, creado_en
        `, [nombre, apellido, email, telefono]);

        return res.status(201).json({
            participante: result.rows[0],
            message: 'Participante registrado correctamente'
        });
        
    } catch (error) {
        console.error('Error al registrar participante:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
        
    }
}

const añadirParticipanteAEvento = async (req, res) =>{
    const { emailParticipante, evento } = req.body;

    try {
        const participanteResult = await pool.query('SELECT * FROM participantes WHERE email = $1', [emailParticipante]);

        if (participanteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Participante no encontrado, primero registrar al participante' });
        }

        const participante = participanteResult.rows[0];

        // Verificar luego si el evento existe
        const eventoResult = await pool.query('SELECT * FROM eventos WHERE nombre = $1', [evento.nombre]);

        if (eventoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }

        // Insertar la relación participante-evento
        await pool.query(`
            INSERT INTO participantes_eventos (participante_id, evento_id)
            VALUES ($1, $2)
        `, [participante.id, evento.id]);

        return res.status(200).json({
            message: 'Participante añadido al evento correctamente',
            participante: participante,
            evento: evento
        });

    } catch (error) {
        console.error('Error al añadir participante a evento:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}



const inscribirParticipante = async (req, res) => {

  const { participante_id, evento_id, tipo_inscripcion } = req.body;

  try {
    // Validaciones previas
// 1- verificar que el evento existe
    const evento = await pool.query('SELECT * FROM eventos WHERE id = $1', [evento_id]);
    if (evento.rows.length === 0) {
        return res.status(404).json({ error: 'Evento no encontrado' });
        }
// 2- verificar que el participante existe
    const existe = await pool.query(
      'SELECT * FROM inscripciones WHERE participante_id = $1 AND evento_id = $2',
      [participante_id, evento_id]
    );
    // 2- un participante no puede inscribirse dos veces al mismo evento
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: 'El participante ya está inscrito en este evento.' });
    }


    // Crear inscripción
    const nuevaInscripcion = await pool.query(
      `INSERT INTO inscripciones (participante_id, evento_id, tipo_inscripcion)
       VALUES ($1, $2, $3) RETURNING *`,
      [participante_id, evento_id, tipo_inscripcion]
    );

    const inscripcion = nuevaInscripcion.rows[0];

    // Generar datos para QR
    const qrData = JSON.stringify({
      inscripcion_id: inscripcion.id,
      participante_id,
      evento_id
    });

    // Generar QR en base64
    const qrCodeBase64 = await QRCode.toDataURL(qrData);

    // Guardar QR en la base de datos
    await pool.query(
      `UPDATE inscripciones SET qr_code = $1 WHERE id = $2`,
      [qrCodeBase64, inscripcion.id]
    );

    return res.status(201).json({
      mensaje: 'Participante inscrito correctamente',
      inscripcion_id: inscripcion.id,
      qr_code: qrCodeBase64
    });

  } catch (error) {
    console.error('Error en inscripción:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};


module.exports = {
    registrarParticipante,
    inscribirParticipante,
};