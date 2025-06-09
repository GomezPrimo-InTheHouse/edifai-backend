const pool = require('../../connection/db.js');



// Validación de solapamiento
const hayConflictoDeHorario = async ({ fecha, hora_inicio, sala_id }) => {
  const result = await pool.query(
    `SELECT * FROM actividades 
     WHERE fecha::date = $1::date 
     AND hora_inicio = $2 
     AND sala_id = $3`,
    [fecha, hora_inicio, sala_id]
  );
  console.log('Resultado de la consulta de conflicto:', result.rows);
  return result.rows.length > 0;
};

// const verificarConflictoExpositores = async ({ fecha, hora_inicio, hora_fin, expositores_ids, actividad_id }) => {
//   const query = `
//     SELECT ae.usuario_id, a.id AS actividad_id, a.titulo
//     FROM actividad_expositores ae
//     JOIN actividades a ON ae.actividad_id = a.id
//     WHERE ae.usuario_id = ANY($1)
//       AND a.id != $2
//       AND a.fecha::date = $3::date
//       AND (
//         ($4::time, $5::time) OVERLAPS (a.hora_inicio::time, a.hora_fin::time)
//       )
//   `;

//   const values = [expositores_ids, actividad_id, fecha, hora_inicio, hora_fin];
//   const result = await pool.query(query, values);

//   return result.rows; // Array con conflictos, si hay
// };


const verificarExpositoresConActividadEnHorario = async ({ fecha, hora_inicio, hora_fin, expositores_ids, actividad_id }) => {
  console.log('verificando expositores con actividad en horario');
  const result = await pool.query(`
    SELECT au.usuario_id, a.id AS actividad_id
    FROM actividad_expositores au
    JOIN actividades a ON au.actividad_id = a.id
    WHERE au.usuario_id = ANY($1)
      AND a.id != $2
      AND a.fecha::date = $3::date
      AND (
        ($4::time, $5::time) OVERLAPS (a.hora_inicio::time, a.hora_fin::time)
      )
  `, [expositores_ids, actividad_id, fecha, hora_inicio, hora_fin]);
console.log (result.rows)
  return result.rows.length > 0;
};
const verificarEventoEnSalaEnHorario = async ({ evento_id, sala_id, fecha, hora_inicio, actividad_id }) => {
  const result = await pool.query(
    `SELECT 1 FROM actividades
     WHERE evento_id = $1 AND sala_id = $2
       AND fecha::date = $3::date
       AND hora_inicio = $4
       AND id != $5
     LIMIT 1`,
    [evento_id, sala_id, fecha, hora_inicio, actividad_id]
  );
  return result.rows.length > 0;
};


//registrando nueva actividad
const registrarActividad = async (req, res) => {
    const {
    titulo,
    descripcion,
    fecha,
    hora_inicio,
    hora_fin,
    duracion_estimada,
    estado_id,
    evento_id,
    sala_id,
    expositores_ids = []
  } = req.body;
  console.log('Datos recibidos para registrar actividad:', req.body);
  // Validaciones mínimas
  if (!titulo || !fecha || !hora_inicio || !evento_id || !sala_id || expositores_ids.length === 0) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    // Validar conflicto horario
    const conflicto = await hayConflictoDeHorario({ fecha, hora_inicio, sala_id });

    if (conflicto) {
      return res.status(409).json({ error: 'Conflicto: ya hay una actividad en esa sala, fecha y hora.' });
    }

    // Crear actividad
    const nuevaActividad = await pool.query(
      `INSERT INTO actividades 
        (titulo, descripcion, fecha, duracion_estimada, hora_inicio, hora_fin, estado_id, evento_id, sala_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [titulo, descripcion, fecha, duracion_estimada, hora_inicio, hora_fin, estado_id, evento_id, sala_id]
    );

    const actividadId = nuevaActividad.rows[0].id;


    // Validar que los expositores existan
    expositores_ids.map(usuario_id => {
      return pool.query('SELECT * FROM usuarios WHERE id = $1', [usuario_id])
        .then(result => {
          if (result.rows.length === 0) {
            throw new Error(`Usuario con ID ${usuario_id} no encontrado`);
          }
          return result.rows[0];
        });
    })


    // Insertar expositores (usuarios) en tabla intermedia
    const inserts = expositores_ids.map( usuario_id =>   //recorro uno a uno los ids de los expositores
      pool.query(
        `INSERT INTO actividad_expositores (actividad_id, usuario_id) 
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [actividadId, usuario_id] // inserto el id de la actividad y el id del expositor
      )
    );
    await Promise.all(inserts);

    return res.status(201).json({
      mensaje: 'Actividad creada exitosamente',
      actividad: nuevaActividad.rows[0],
    });

  } catch (err) {
    console.error('Error al crear actividad:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

};

//modificar actividad ya registrada
const modificarActividad = async (req, res) => {
    const actividadId = req.params.id;
  //verificar que la actividad exista
  const actividad = await pool.query('SELECT * FROM actividades WHERE id = $1', [actividadId
    ]);
    if (actividad.rows.length === 0) {
      return res.status(404).json({ error: 'Actividad no encontrada' });
      }
      

  const {
   titulo,
    descripcion,
    fecha,
    hora_inicio,
    hora_fin,
    duracion_estimada,
    estado_id,
    evento_id,
    sala_id,
    expositores_ids = []
  } = req.body;

  // Validaciones mínimas
  if (!titulo || !fecha || !hora_inicio || !hora_fin || !evento_id || !sala_id || expositores_ids.length === 0) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    // esxiste la actividad ? 
    const existe = await pool.query('SELECT * FROM actividades WHERE id = $1', [actividadId]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ error: 'Actividad no encontrada' });
    }

    // Hay conflicto con el horario en la sala y evento proporcionado ?
    const conflictoEventoSala = await verificarEventoEnSalaEnHorario({
      evento_id, sala_id, fecha, hora_inicio, actividad_id: actividadId
    });

    if (conflictoEventoSala) {
      return res.status(409).json({
        error: 'Conflicto detected: ya hay otra actividad del mismo evento en esa sala y horario.'
      });
    }

    
    // verificar si hay algun expositor que en el nuevo horario, tiene otra actividad asociada
    const expositoresConActividad = await verificarExpositoresConActividadEnHorario({ fecha, hora_inicio, sala_id, expositores_ids, actividad_id: actividadId });
    console.log(expositoresConActividad)
    if (expositoresConActividad ){
          return res.status(409).json({ error: 'Conflicto detected: expositor ocupado en el horario .' });
    }
       // Actualizar la actividad
    // await pool.query(
    //   `UPDATE actividades 
    //    SET titulo = $1, descripcion = $2, fecha = $3, hora_inicio = $4, hora_fin = $5, duracion_estimada = $6, 
    //        estado_id = $7, evento_id = $8, sala_id = $9, actualizado_en = NOW()
    //    WHERE id = $9`,
    //   [titulo, descripcion, fecha, duracion_estimada, hora_inicio, hora_fin, estado_id, evento_id, sala_id]
    // );

    await pool.query(
      `UPDATE actividades 
      SET titulo = $1, descripcion = $2, fecha = $3, hora_inicio = $4, hora_fin = $5, duracion_estimada = $6, 
          estado_id = $7, evento_id = $8, sala_id = $9, actualizado_en = NOW()
      WHERE id = $10`,
      [titulo, descripcion, fecha, hora_inicio, hora_fin, duracion_estimada, estado_id, evento_id, sala_id, actividadId]
    );


    // Limpiar expositores anteriores
    await pool.query(`DELETE FROM actividad_expositores WHERE actividad_id = $1`, [actividadId]);

    // Agregar nuevos expositores
    const inserts = expositores_ids.map(usuario_id =>
      pool.query(
        `INSERT INTO actividad_expositores (actividad_id, usuario_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [actividadId, usuario_id]
      )
    );
    await Promise.all(inserts);

    return res.status(200).json({ mensaje: 'Actividad modificada exitosamente' });

  } catch (err) {
    console.error('Error al modificar actividad:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

//ver todas las actividades y ver los detalles de una actividad
const verActividades = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM actividades');

    const actividad_id = result.rows.map(actividad => actividad.id);

    // console.log('IDs de actividades obtenidas:', actividad_id);

    const expositores = await pool.query(
      `SELECT ae.actividad_id, u.id AS usuario_id, u.nombre
       FROM actividad_expositores ae
       JOIN usuarios u ON ae.usuario_id = u.id
       WHERE ae.actividad_id = ANY($1)`,
      [actividad_id]
    );
    // console.log('Expositores obtenidos:', expositores.rows);

    // Sumo los expositoress a cada json de  actividad
    const actividadesConExpositores = result.rows.map(actividad =>
      ({
        ...actividad,
        expositores: expositores.rows
          .filter(expositor => expositor.actividad_id === actividad.id)
          .map(expositor => ({
            id: expositor.usuario_id,
            nombre: expositor.nombre
          }))
      })
    );

    return res.status(200).json(actividadesConExpositores);
  } catch (err) {
    console.error('Error al obtener actividades:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
    registrarActividad,
    modificarActividad,
    verActividades
};