// const bcrypt = require("bcrypt");
// const pool = require("../../connection/db.js");

// const createTrabajador = async (req, res) => {
//   const client = await pool.connect();

//   try {
//     const {
//       nombre, apellido, dni, telefono, fecha_ingreso,
//       estado_id, especialidad_id, jefe_id, usuario_creador_id,
//       email, password,
//       // datos facturación
//       razon_social, cuit, condicion_iva, direccion_fiscal, cbu, alias_cbu,
//     } = req.body;

//     if (!nombre || !apellido || !dni || !email || !usuario_creador_id) {
//       return res.status(400).json({
//         ok: false,
//         error: 'Faltan campos obligatorios: nombre, apellido, dni, email, usuario_creador_id',
//       });
//     }

//     await client.query('BEGIN');

//     const dniExistente = await client.query('SELECT 1 FROM trabajadores WHERE dni = $1', [dni]);
//     if (dniExistente.rowCount > 0) {
//       await client.query('ROLLBACK');
//       return res.status(409).json({ ok: false, error: 'El DNI ya está registrado' });
//     }

//     const emailExistente = await client.query('SELECT 1 FROM usuarios WHERE email = $1', [email]);
//     if (emailExistente.rowCount > 0) {
//       await client.query('ROLLBACK');
//       return res.status(409).json({ ok: false, error: 'El email ya está registrado' });
//     }

//     const usuarioCreador = await client.query('SELECT 1 FROM usuarios WHERE id = $1', [usuario_creador_id]);
//     if (usuarioCreador.rowCount === 0) {
//       await client.query('ROLLBACK');
//       return res.status(404).json({ ok: false, error: 'Usuario creador no encontrado' });
//     }

//     if (jefe_id != null) {
//       const jefeExiste = await client.query('SELECT 1 FROM trabajadores WHERE id = $1', [jefe_id]);
//       if (jefeExiste.rowCount === 0) {
//         await client.query('ROLLBACK');
//         return res.status(404).json({ ok: false, error: 'Jefe (trabajador) no encontrado' });
//       }
//     }

//     const esJefe = jefe_id == null;
//     const rol_id = esJefe ? 8 : 7;
//     const plainPassword = password != null && String(password).trim() !== '' ? String(password) : String(dni);
//     const passwordHash = await bcrypt.hash(plainPassword, 10);

//     const nuevoUsuario = await client.query(
//       `INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id, totp_seed, created_at, updated_at)
//        VALUES ($1, $2, $3, $4, $5, NULL, now(), now())
//        RETURNING id, nombre, email, rol_id, estado_id, created_at, updated_at`,
//       [`${nombre} ${apellido}`, email, passwordHash, rol_id, estado_id ?? null]
//     );

//     const usuarioCreado = nuevoUsuario.rows[0];

//     const nuevoTrabajador = await client.query(
//       `INSERT INTO trabajadores
//         (nombre, apellido, dni, email, telefono, fecha_ingreso, estado_id, usuario_id,
//          especialidad_id, jefe_id, usuario_creador_id,
//          razon_social, cuit, condicion_iva, direccion_fiscal, cbu, alias_cbu,
//          created_at, updated_at)
//        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),now())
//        RETURNING *`,
//       [
//         nombre, apellido, dni, email, telefono ?? null,
//         fecha_ingreso ?? null, estado_id ?? null, usuarioCreado.id,
//         especialidad_id ?? null, jefe_id ?? null, usuario_creador_id,
//         razon_social ?? null, cuit ?? null, condicion_iva ?? null,
//         direccion_fiscal ?? null, cbu ?? null, alias_cbu ?? null,
//       ]
//     );

//     await client.query('COMMIT');

//     return res.status(201).json({
//       ok: true,
//       message: 'Trabajador y usuario creados correctamente.',
//       data: {
//         trabajador: nuevoTrabajador.rows[0],
//         usuario: usuarioCreado,
//         password_inicial: password != null && String(password).trim() !== '' ? null : 'DNI',
//       },
//     });
//   } catch (err) {
//     await client.query('ROLLBACK');
//     if (err?.code === '23505') {
//       return res.status(409).json({ ok: false, error: 'Conflicto: email o dni ya existente.' });
//     }
//     console.error('Error createTrabajador:', err);
//     return res.status(500).json({ ok: false, error: 'Error al crear trabajador/usuario' });
//   } finally {
//     client.release();
//   }
// };


// //obtener todos los trabajadores

// const getAllTrabajadores = async (req, res) => {
//   try {
//     const result = await pool.query(`
//       SELECT 
//         t.*,
//         -- Días marcados este mes
//         COUNT(DISTINCT DATE(p.fecha)) AS dias_marcados_mes,
//         -- Porcentaje de asistencia del mes (sobre días hábiles transcurridos)
//         ROUND(
//           COUNT(DISTINCT DATE(p.fecha))::numeric / NULLIF(
//             (SELECT COUNT(*)
//              FROM generate_series(
//                DATE_TRUNC('month', CURRENT_DATE),
//                CURRENT_DATE,
//                '1 day'::interval
//              ) AS gs(day)
//              WHERE EXTRACT(DOW FROM gs.day) NOT IN (0, 6)
//             ), 0
//           ) * 100, 0
//         ) AS porcentaje_asistencia_mes
//       FROM trabajadores t
//       LEFT JOIN presentismos p 
//         ON p.trabajador_id = t.id
//         AND DATE(p.fecha) >= DATE_TRUNC('month', CURRENT_DATE)
//         AND DATE(p.fecha) <= CURRENT_DATE
//       GROUP BY t.id
//       ORDER BY t.id
//     `);
//     return res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error al obtener trabajadores:', error);
//     return res.status(500).json({ error: 'Error al obtener trabajadores' });
//   }
// };

// //modificar un trabajador

// const modificarTrabajador = async (req, res) => {
//     const {id} = req.params;
//     const { nombre, apellido, dni, email,
//         telefono, fecha_ingreso, 
//          estado_id, usuario_id, 
//         especialidad_id, jefe_id 
//        } = req.body;

//     try {
//         // Verificar que el trabajador existe
//         const trabajadorExistente = await pool.query('SELECT * FROM trabajadores WHERE id = $1', [id]);
//         if (trabajadorExistente.rows.length === 0) {
//             return res.status(404).json({ error: 'Trabajador no encontrado' });
//         }

//         // Actualizar el trabajador
//         const result = await pool.query(`
//             UPDATE trabajadores 
//             SET nombre = $1, apellido = $2, dni = $3, email = $4, telefono = $5, fecha_ingreso = $6
//             , estado_id = $7, usuario_id = $8, especialidad_id = $9, jefe_id = $10 , updated_at = now()
//             WHERE id = $11 
//             RETURNING *
//         `, [nombre, apellido, dni, email, telefono, fecha_ingreso, estado_id, usuario_id, especialidad_id, jefe_id, id]);

//         const trabajadorModificado = result.rows[0];
//         return res.status(200).json({
//             message: 'Success',
//             data: trabajadorModificado
//         });
        
//     } catch (error) {
//         console.error('Error al modificar trabajador:', error);
//         return res.status(500).json({ error: 'Error al modificar trabajador' });
        
//     }
// }

// //dar de baja un trabajador, sin borrarlo de la base de datos
// const darDeBajaTrabajador = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const existente = await pool.query('SELECT id, nombre, apellido FROM trabajadores WHERE id = $1', [id]);
//     if (existente.rows.length === 0) {
//       return res.status(404).json({ ok: false, message: 'Trabajador no encontrado.' });
//     }

//     const trabajador = existente.rows[0];

//     // Verificar subordinados
//     const subordinados = await pool.query('SELECT id FROM trabajadores WHERE jefe_id = $1', [id]);
//     if (subordinados.rows.length > 0) {
//       return res.status(400).json({
//         ok: false,
//         message: `No se puede dar de baja: el trabajador tiene ${subordinados.rows.length} subordinado(s) asignado(s).`,
//       });
//     }

//     // Verificar labores activas
//     const labores = await pool.query(
//       `SELECT id FROM labores WHERE trabajador_id = $1 AND archivado = FALSE`,
//       [id]
//     );
//     if (labores.rows.length > 0) {
//       return res.status(400).json({
//         ok: false,
//         message: `No se puede dar de baja: el trabajador tiene ${labores.rows.length} labor(es) activa(s) asignada(s).`,
//       });
//     }

//     // Soft delete — cambiar estado a inactivo (estado_id = 2)
//     await pool.query(
//       `UPDATE trabajadores SET estado_id = 2, updated_at = NOW() WHERE id = $1`,
//       [id]
//     );

//     // Desactivar usuario vinculado si existe
//     await pool.query(
//       `UPDATE usuarios SET estado_id = 2, updated_at = NOW() WHERE id = (
//         SELECT usuario_id FROM trabajadores WHERE id = $1
//       )`,
//       [id]
//     );

//     await notificar({
//       tipo: 'baja_trabajador',
//       mensaje: `Trabajador "${trabajador.nombre} ${trabajador.apellido}" fue dado de baja`,
//       usuario_id: null,
//     });

//     res.status(200).json({ ok: true, message: 'Trabajador dado de baja correctamente.' });
//   } catch (error) {
//     console.error('Error al dar de baja trabajador:', error);
//     res.status(500).json({ ok: false, message: 'Error interno del servidor.' });
//   }
// };

// //marcar presentismo


// const marcarPresentismo = async (req, res) => {
//   const client = await pool.connect();

//   try {
//     const { obra_id, latitud, longitud, observaciones } = req.body;

//     // Ajustar según tu middleware de auth
//     const usuario_id = req.user?.id;

//     if (!usuario_id) {
//       return res.status(401).json({
//         ok: false,
//         error: "Usuario no autenticado",
//       });
//     }

//     if (!obra_id) {
//       return res.status(400).json({
//         ok: false,
//         error: "El campo obra_id es obligatorio",
//       });
//     }

//     await client.query("BEGIN");

//     // 1) Buscar trabajador asociado al usuario autenticado
//     const trabajadorResult = await client.query(
//       `
//       SELECT id
//       FROM trabajadores
//       WHERE usuario_id = $1
//       LIMIT 1
//       `,
//       [usuario_id]
//     );

//     if (trabajadorResult.rowCount === 0) {
//       await client.query("ROLLBACK");
//       return res.status(404).json({
//         ok: false,
//         error: "No existe un trabajador asociado al usuario autenticado",
//       });
//     }

//     const trabajador_id = trabajadorResult.rows[0].id;

//     // 2) Validar obra existente
//     const obraResult = await client.query(
//       `
//       SELECT 1
//       FROM obras
//       WHERE id = $1
//       LIMIT 1
//       `,
//       [obra_id]
//     );

//     if (obraResult.rowCount === 0) {
//       await client.query("ROLLBACK");
//       return res.status(404).json({
//         ok: false,
//         error: "La obra indicada no existe",
//       });
//     }

//     // 3) Validar que el trabajador esté asignado a la obra
//     const asignacionResult = await client.query(
//       `
//       SELECT 1
//       FROM trabajadores_obras
//       WHERE trabajador_id = $1
//         AND obra_id = $2
//       LIMIT 1
//       `,
//       [trabajador_id, obra_id]
//     );

//     if (asignacionResult.rowCount === 0) {
//       await client.query("ROLLBACK");
//       return res.status(403).json({
//         ok: false,
//         error: "El trabajador no está asignado a la obra indicada",
//       });
//     }

//     // 4) Insertar presentismo
//     const presentismoResult = await client.query(
//       `
//       INSERT INTO presentismos
//         (fecha, latitud, longitud, obra_id, observaciones, trabajador_id, created_at, updated_at)
//       VALUES
//         (now(), $1, $2, $3, $4, $5, now(), now())
//       RETURNING *;
//       `,
//       [
//         latitud ?? null,
//         longitud ?? null,
//         obra_id,
//         observaciones ?? null,
//         trabajador_id,
//       ]
//     );

//     const presentismoCreado = presentismoResult.rows[0];

//     await client.query("COMMIT");

//     return res.status(201).json({
//       ok: true,
//       message: "Presentismo registrado correctamente",
//       data: presentismoCreado,
//     });
//   } catch (err) {
//     await client.query("ROLLBACK");
//     console.error("Error marcarPresentismo:", err);

//     return res.status(500).json({
//       ok: false,
//       error: "Error al registrar presentismo",
//     });
//   } finally {
//     client.release();
//   }
// };
// const getTrabajadorById = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const result = await pool.query('SELECT * FROM trabajadores WHERE id = $1', [id]);
    
//     if (result.rows.length === 0) {
//       return res.status(404).json({ 
//         ok: false, 
//         error: 'Trabajador no encontrado' 
//       });
//     }

//     return res.status(200).json({ 
//       ok: true, 
//       data: result.rows[0] 
//     });

//   } catch (error) {
//     console.error('Error al obtener trabajador:', error);
//     return res.status(500).json({ 
//       ok: false, 
//       error: 'Error al obtener el trabajador' 
//     });
//   }
// };

// // Obtiene todos los trabajadores de una especialidad específica
// const getTrabajadoresByEspecialidad = async (req, res) => {
//   const { especialidad_id } = req.params;

//   try {
//     const result = await pool.query(
//       `SELECT * FROM trabajadores WHERE especialidad_id = $1`,
//       [especialidad_id]
//     );

//     res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error al obtener trabajadores por especialidad:', error);
//     res.status(500).json({ ok: false, error: 'Error interno del servidor' });
//   }
// };
// // Obtiene jefes de una especialidad con su equipo anidado
// // Un jefe es un trabajador con jefe_id IS NULL dentro de una especialidad
// const getJefesConEquipoPorEspecialidad = async (req, res) => {
//   const { especialidad_id } = req.params;

//   try {
//     // Trae todos los trabajadores de la especialidad
//     const result = await pool.query(
//       `SELECT * FROM trabajadores WHERE especialidad_id = $1`,
//       [especialidad_id]
//     );

//     const todos = result.rows;

//     // Separa jefes (jefe_id IS NULL) y subordinados
//     const jefes = todos.filter((t) => t.jefe_id === null);
//     const subordinados = todos.filter((t) => t.jefe_id !== null);

//     // Anida el equipo dentro de cada jefe
//     const jefesConEquipo = jefes.map((jefe) => ({
//       ...jefe,
//       equipo: subordinados.filter((s) => s.jefe_id === jefe.id),
//     }));

//     res.status(200).json(jefesConEquipo);
//   } catch (error) {
//     console.error('Error al obtener jefes con equipo:', error);
//     res.status(500).json({ ok: false, error: 'Error interno del servidor' });
//   }
// };

// module.exports = {
//     getAllTrabajadores,
//     createTrabajador,
//     modificarTrabajador,
//     darDeBajaTrabajador,
//     marcarPresentismo,
//     getTrabajadorById,
//     getTrabajadoresByEspecialidad,
//     getJefesConEquipoPorEspecialidad
// };

const bcrypt = require("bcrypt");
const pool = require("../../connection/db.js");
const { notificar } = require('../../helpers/notificar.js');
const { getFiltro, ROL_ADMIN_PRIVADO } = require('../../middlewares/filtrarPorPropietario.js');

const createTrabajador = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      nombre, apellido, dni, telefono, fecha_ingreso,
      estado_id, especialidad_id, jefe_id,
      email, password,
      razon_social, cuit, condicion_iva, direccion_fiscal, cbu, alias_cbu,
    } = req.body;

    const usuario_creador_id = req.user.userId;
    const propietario_id = req.user.rol_id === ROL_ADMIN_PRIVADO ? req.user.userId : null;

    if (!nombre || !apellido || !dni || !email) {
      return res.status(400).json({
        ok: false,
        error: 'Faltan campos obligatorios: nombre, apellido, dni, email',
      });
    }

    await client.query('BEGIN');

    const dniExistente = await client.query('SELECT 1 FROM trabajadores WHERE dni = $1', [dni]);
    if (dniExistente.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, error: 'El DNI ya está registrado' });
    }

    const emailExistente = await client.query('SELECT 1 FROM usuarios WHERE email = $1', [email]);
    if (emailExistente.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, error: 'El email ya está registrado' });
    }

    if (jefe_id != null) {
      const jefeExiste = await client.query('SELECT 1 FROM trabajadores WHERE id = $1', [jefe_id]);
      if (jefeExiste.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ ok: false, error: 'Jefe (trabajador) no encontrado' });
      }
    }

    const esJefe = jefe_id == null;
    const rol_id = esJefe ? 8 : 7;
    const plainPassword = password != null && String(password).trim() !== '' ? String(password) : String(dni);
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const nuevoUsuario = await client.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id, totp_seed, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NULL, now(), now())
       RETURNING id, nombre, email, rol_id, estado_id, created_at, updated_at`,
      [`${nombre} ${apellido}`, email, passwordHash, rol_id, estado_id ?? null]
    );

    const usuarioCreado = nuevoUsuario.rows[0];

    const nuevoTrabajador = await client.query(
      `INSERT INTO trabajadores
        (nombre, apellido, dni, email, telefono, fecha_ingreso, estado_id, usuario_id,
         especialidad_id, jefe_id, usuario_creador_id,
         razon_social, cuit, condicion_iva, direccion_fiscal, cbu, alias_cbu,
         propietario_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now(),now())
       RETURNING *`,
      [
        nombre, apellido, dni, email, telefono ?? null,
        fecha_ingreso ?? null, estado_id ?? null, usuarioCreado.id,
        especialidad_id ?? null, jefe_id ?? null, usuario_creador_id,
        razon_social ?? null, cuit ?? null, condicion_iva ?? null,
        direccion_fiscal ?? null, cbu ?? null, alias_cbu ?? null,
        propietario_id,
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      ok: true,
      message: 'Trabajador y usuario creados correctamente.',
      data: {
        trabajador: nuevoTrabajador.rows[0],
        usuario: usuarioCreado,
        password_inicial: password != null && String(password).trim() !== '' ? null : 'DNI',
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err?.code === '23505') {
      return res.status(409).json({ ok: false, error: 'Conflicto: email o dni ya existente.' });
    }
    console.error('Error createTrabajador:', err);
    return res.status(500).json({ ok: false, error: 'Error al crear trabajador/usuario' });
  } finally {
    client.release();
  }
};

const getAllTrabajadores = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const { where, params } = getFiltro(req);

    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT t.id) AS total
       FROM trabajadores t
       WHERE 1=1 ${where.replace('AND propietario_id', 'AND t.propietario_id')}`,
      params
    );

    const total = Number(countResult.rows[0].total ?? countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    const result = await pool.query(`
      SELECT 
        t.*,
        COUNT(DISTINCT DATE(p.fecha)) AS dias_marcados_mes,
        ROUND(
          COUNT(DISTINCT DATE(p.fecha))::numeric / NULLIF(
            (SELECT COUNT(*)
             FROM generate_series(
               DATE_TRUNC('month', CURRENT_DATE),
               CURRENT_DATE,
               '1 day'::interval
             ) AS gs(day)
             WHERE EXTRACT(DOW FROM gs.day) NOT IN (0, 6)
            ), 0
          ) * 100, 0
        ) AS porcentaje_asistencia_mes
      FROM trabajadores t
      LEFT JOIN presentismos p 
        ON p.trabajador_id = t.id
        AND DATE(p.fecha) >= DATE_TRUNC('month', CURRENT_DATE)
        AND DATE(p.fecha) <= CURRENT_DATE
      WHERE 1=1 ${where.replace('AND propietario_id', 'AND t.propietario_id')}
      GROUP BY t.id
      ORDER BY t.id
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    return res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        totalPages,
        page,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error al obtener trabajadores:', error);
    return res.status(500).json({ error: 'Error al obtener trabajadores' });
  }
};

const modificarTrabajador = async (req, res) => {
  const { id } = req.params;
  const {
    nombre, apellido, dni, email,
    telefono, fecha_ingreso,
    estado_id, usuario_id,
    especialidad_id, jefe_id
  } = req.body;

  try {
    const trabajadorExistente = await pool.query(
      'SELECT * FROM trabajadores WHERE id = $1', [id]
    );
    if (trabajadorExistente.rows.length === 0) {
      return res.status(404).json({ error: 'Trabajador no encontrado' });
    }

    const trabajador = trabajadorExistente.rows[0];
    if (req.user.rol_id === ROL_ADMIN_PRIVADO && trabajador.propietario_id !== req.user.userId) {
      return res.status(403).json({ ok: false, message: 'Sin permiso sobre este trabajador' });
    }

    const result = await pool.query(`
      UPDATE trabajadores 
      SET nombre = $1, apellido = $2, dni = $3, email = $4, telefono = $5,
          fecha_ingreso = $6, estado_id = $7, usuario_id = $8,
          especialidad_id = $9, jefe_id = $10, updated_at = now()
      WHERE id = $11 
      RETURNING *
    `, [nombre, apellido, dni, email, telefono, fecha_ingreso, estado_id, usuario_id, especialidad_id, jefe_id, id]);

    return res.status(200).json({
      message: 'Success',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al modificar trabajador:', error);
    return res.status(500).json({ error: 'Error al modificar trabajador' });
  }
};

const darDeBajaTrabajador = async (req, res) => {
  const { id } = req.params;

  try {
    const existente = await pool.query(
      'SELECT id, nombre, apellido, propietario_id FROM trabajadores WHERE id = $1', [id]
    );
    if (existente.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Trabajador no encontrado.' });
    }

    const trabajador = existente.rows[0];
    if (req.user.rol_id === ROL_ADMIN_PRIVADO && trabajador.propietario_id !== req.user.userId) {
      return res.status(403).json({ ok: false, message: 'Sin permiso sobre este trabajador' });
    }

    const subordinados = await pool.query('SELECT id FROM trabajadores WHERE jefe_id = $1', [id]);
    if (subordinados.rows.length > 0) {
      return res.status(400).json({
        ok: false,
        message: `No se puede dar de baja: el trabajador tiene ${subordinados.rows.length} subordinado(s) asignado(s).`,
      });
    }

    const labores = await pool.query(
      `SELECT id FROM labores WHERE trabajador_id = $1 AND archivado = FALSE`, [id]
    );
    if (labores.rows.length > 0) {
      return res.status(400).json({
        ok: false,
        message: `No se puede dar de baja: el trabajador tiene ${labores.rows.length} labor(es) activa(s) asignada(s).`,
      });
    }

    await pool.query(
      `UPDATE trabajadores SET estado_id = 2, updated_at = NOW() WHERE id = $1`, [id]
    );

    await pool.query(
      `UPDATE usuarios SET estado_id = 2, updated_at = NOW() WHERE id = (
        SELECT usuario_id FROM trabajadores WHERE id = $1
      )`, [id]
    );

    await notificar({
      tipo: 'baja_trabajador',
      mensaje: `Trabajador "${trabajador.nombre} ${trabajador.apellido}" fue dado de baja`,
      usuario_id: null,
    });

    res.status(200).json({ ok: true, message: 'Trabajador dado de baja correctamente.' });
  } catch (error) {
    console.error('Error al dar de baja trabajador:', error);
    res.status(500).json({ ok: false, message: 'Error interno del servidor.' });
  }
};

const marcarPresentismo = async (req, res) => {
  const client = await pool.connect();

  try {
    const { obra_id, latitud, longitud, observaciones } = req.body;
    const usuario_id = req.user?.id;

    if (!usuario_id) {
      return res.status(401).json({ ok: false, error: "Usuario no autenticado" });
    }

    if (!obra_id) {
      return res.status(400).json({ ok: false, error: "El campo obra_id es obligatorio" });
    }

    await client.query("BEGIN");

    const trabajadorResult = await client.query(
      `SELECT id FROM trabajadores WHERE usuario_id = $1 LIMIT 1`, [usuario_id]
    );

    if (trabajadorResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "No existe un trabajador asociado al usuario autenticado" });
    }

    const trabajador_id = trabajadorResult.rows[0].id;

    const obraResult = await client.query(`SELECT 1 FROM obras WHERE id = $1 LIMIT 1`, [obra_id]);
    if (obraResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "La obra indicada no existe" });
    }

    const asignacionResult = await client.query(
      `SELECT 1 FROM trabajadores_obras WHERE trabajador_id = $1 AND obra_id = $2 LIMIT 1`,
      [trabajador_id, obra_id]
    );
    if (asignacionResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({ ok: false, error: "El trabajador no está asignado a la obra indicada" });
    }

    const presentismoResult = await client.query(
      `INSERT INTO presentismos
        (fecha, latitud, longitud, obra_id, observaciones, trabajador_id, created_at, updated_at)
       VALUES (now(), $1, $2, $3, $4, $5, now(), now())
       RETURNING *`,
      [latitud ?? null, longitud ?? null, obra_id, observaciones ?? null, trabajador_id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,
      message: "Presentismo registrado correctamente",
      data: presentismoResult.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error marcarPresentismo:", err);
    return res.status(500).json({ ok: false, error: "Error al registrar presentismo" });
  } finally {
    client.release();
  }
};

const getTrabajadorById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM trabajadores WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Trabajador no encontrado' });
    }

    const trabajador = result.rows[0];
    if (req.user.rol_id === ROL_ADMIN_PRIVADO && trabajador.propietario_id !== req.user.userId) {
      return res.status(403).json({ ok: false, message: 'Sin permiso sobre este trabajador' });
    }

    return res.status(200).json({ ok: true, data: trabajador });
  } catch (error) {
    console.error('Error al obtener trabajador:', error);
    return res.status(500).json({ ok: false, error: 'Error al obtener el trabajador' });
  }
};

const getTrabajadoresByEspecialidad = async (req, res) => {
  const { especialidad_id } = req.params;

  try {
    const { where, params } = getFiltro(req);

    const result = await pool.query(
      `SELECT * FROM trabajadores WHERE especialidad_id = $${params.length + 1} ${where}`,
      [...params, especialidad_id]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener trabajadores por especialidad:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

const getJefesConEquipoPorEspecialidad = async (req, res) => {
  const { especialidad_id } = req.params;

  try {
    const { where, params } = getFiltro(req);

    const result = await pool.query(
      `SELECT * FROM trabajadores WHERE especialidad_id = $${params.length + 1} ${where}`,
      [...params, especialidad_id]
    );

    const todos = result.rows;
    const jefes = todos.filter((t) => t.jefe_id === null);
    const subordinados = todos.filter((t) => t.jefe_id !== null);

    const jefesConEquipo = jefes.map((jefe) => ({
      ...jefe,
      equipo: subordinados.filter((s) => s.jefe_id === jefe.id),
    }));

    res.status(200).json(jefesConEquipo);
  } catch (error) {
    console.error('Error al obtener jefes con equipo:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

module.exports = {
  getAllTrabajadores,
  createTrabajador,
  modificarTrabajador,
  darDeBajaTrabajador,
  marcarPresentismo,
  getTrabajadorById,
  getTrabajadoresByEspecialidad,
  getJefesConEquipoPorEspecialidad,
};