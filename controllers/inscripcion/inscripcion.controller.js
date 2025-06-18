const pool = require('../../connection/db.js');
const QRCode = require('qrcode');
const qrcode = require('qrcode-terminal'); // al principio del archivo


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



// dado un particiapnte ya inscripto, procedo a inscribirlo a un evento creado
const inscribirParticipante = async (req, res) => {
  const { participante_id, evento_id, tipo_inscripcion_id } = req.body;

  try {
    const evento = await pool.query('SELECT * FROM eventos WHERE id = $1', [evento_id]);
    if (evento.rows.length === 0) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    const existe = await pool.query(
      'SELECT * FROM inscripciones WHERE participante_id = $1 AND evento_id = $2',
      [participante_id, evento_id]
    );
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: 'El participante ya está inscrito en este evento.' });
    }

    const nuevaInscripcion = await pool.query(
      `INSERT INTO inscripciones (participante_id, evento_id, tipo_inscripcion_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [participante_id, evento_id, tipo_inscripcion_id]
    );

    const inscripcion = nuevaInscripcion.rows[0];

    //Genero el QR para la posterior validación en el evento

    const qrData = JSON.stringify({
      inscripcion_id: inscripcion.id,
      participante_id,
      evento_id
    });

    // Mostrar QR en consola
    qrcode.generate(qrData, { small: true });

    // Genero como base64 y lo guardo en la base de datos
    const qrCodeBase64 = await QRCode.toDataURL(qrData);

    await pool.query(
      `UPDATE inscripciones SET qr_code = $1 WHERE id = $2`,
      [qrCodeBase64, inscripcion.id]
    );

    return res.status(201).json({
      mensaje: 'Participante inscrito correctamente',
      inscripcion_id: inscripcion.id,
      qr_code: qrCodeBase64 // opcional
    });

  } catch (error) {
    console.error('Error en inscripción:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getAllTiposInscripcion = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tipos_inscripcion');
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener tipos de inscripción:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

const verParticipantes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.nombre, p.apellido, p.email, p.telefono
      FROM participantes p
    `);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener participantes:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}


// const validarQR = async (req, res) => {
//   const { inscripcion_id, participante_id, evento_id } = req.body;

//   if (!inscripcion_id || !participante_id || !evento_id) {
//     return res.status(400).json({ error: 'Datos incompletos en el QR' });
//   }

//   try {
//     // Verificar existencia y validez del participante
//     const result = await pool.query(
//       `SELECT * FROM inscripciones 
//        WHERE id = $1 AND participante_id = $2 AND evento_id = $3`,
//       [inscripcion_id, participante_id, evento_id]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Inscripción no encontrada' });
//     }

//     const inscripcion = result.rows[0];

//     if (inscripcion.ingreso_registrado) {
//       return res.status(403).json({ error: 'Ingreso ya registrado anteriormente' });
//     }

//     // Registrar ingreso
//     await pool.query(
//       `UPDATE inscripciones SET ingreso_registrado = true WHERE id = $1`,
//       [inscripcion_id]
//     );

//     return res.status(200).json({
//       mensaje: 'Ingreso validado correctamente',
//       participante_id,
//       evento_id
//     });

//   } catch (error) {
//     console.error('Error al validar QR:', error);
//     return res.status(500).json({ error: 'Error interno del servidor' });
//   }
// };

module.exports = {
    registrarParticipante,
    inscribirParticipante,
    verParticipantes,
    getAllTiposInscripcion
};