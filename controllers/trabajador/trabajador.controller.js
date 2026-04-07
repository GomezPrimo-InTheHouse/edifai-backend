const bcrypt = require("bcrypt");
const pool = require("../../connection/db.js");

const createTrabajador = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      // trabajador
      nombre,
      apellido,
      dni,
      telefono,
      fecha_ingreso,
      estado_id,
      especialidad_id,
      jefe_id,
      usuario_creador_id,

      // usuario a crear
      email,
      password, // opcional
    } = req.body;

    // Validaciones mínimas
    if (!nombre || !apellido || !dni || !email || !usuario_creador_id) {
      return res.status(400).json({
        ok: false,
        error:
          "Faltan campos obligatorios: nombre, apellido, dni, email, usuario_creador_id",
      });
    }

    await client.query("BEGIN");

    // DNI único
    const dniExistente = await client.query(
      "SELECT 1 FROM trabajadores WHERE dni = $1",
      [dni]
    );
    if (dniExistente.rowCount > 0) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ ok: false, error: "El DNI ya está registrado" });
    }

    // Email único (mensaje claro)
    const emailExistente = await client.query(
      "SELECT 1 FROM usuarios WHERE email = $1",
      [email]
    );
    if (emailExistente.rowCount > 0) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ ok: false, error: "El email ya está registrado" });
    }

    // usuario creador existe
    const usuarioCreador = await client.query(
      "SELECT 1 FROM usuarios WHERE id = $1",
      [usuario_creador_id]
    );
    if (usuarioCreador.rowCount === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ ok: false, error: "Usuario creador no encontrado" });
    }

    // jefe_id valida contra trabajadores (FK real)
    if (jefe_id != null) {
      const jefeExiste = await client.query(
        "SELECT 1 FROM trabajadores WHERE id = $1",
        [jefe_id]
      );
      if (jefeExiste.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          ok: false,
          error: "Jefe (trabajador) no encontrado",
        });
      }
    }

    // Rol según regla:
    // jefe_id NULL => trabajador jefe (rol_id 8)
    // jefe_id NOT NULL => trabajador empleado (rol_id 7)
    const esJefe = jefe_id == null;
    const rol_id = esJefe ? 8 : 7;

    // Password: si no viene, usar DNI
    const plainPassword =
      password != null && String(password).trim() !== ""
        ? String(password)
        : String(dni);

    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // Crear usuario (SIN TOTP)
    const nuevoUsuario = await client.query(
      `
      INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id, totp_seed, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NULL, now(), now())
      RETURNING id, nombre, email, rol_id, estado_id, created_at, updated_at;
      `,
      [`${nombre} ${apellido}`, email, passwordHash, rol_id, estado_id ?? null]
    );

    const usuarioCreado = nuevoUsuario.rows[0];

    // Crear trabajador vinculado al usuario
    const nuevoTrabajador = await client.query(
      `
      INSERT INTO trabajadores
        (nombre, apellido, dni, email, telefono, fecha_ingreso, estado_id, usuario_id, 
        especialidad_id, jefe_id, usuario_creador_id, created_at, updated_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, $11 , now(), null)
      RETURNING *;
      `,
      [
        nombre,
        apellido,
        dni,
        email,
        telefono ?? null,
        fecha_ingreso ?? null,
        estado_id ?? null,
        usuarioCreado.id,
        especialidad_id ?? null,
        jefe_id ?? null,
        usuario_creador_id,
      ]
    );

    const trabajadorCreado = nuevoTrabajador.rows[0];

    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,
      message: "Trabajador y usuario creados correctamente.",
      data: {
        trabajador: trabajadorCreado,
        usuario: usuarioCreado,
        // no devolvemos el DNI/clave en claro, solo indicamos el criterio
        password_inicial:
          password != null && String(password).trim() !== "" ? null : "DNI",
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");

    if (err && err.code === "23505") {
      return res.status(409).json({
        ok: false,
        error: "Conflicto: email o dni ya existente (unique_violation).",
      });
    }

    console.error("Error createTrabajador:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Error al crear trabajador/usuario" });
  } finally {
    client.release();
  }
};



//obtener todos los trabajadores

const getAllTrabajadores = async (req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM trabajadores ORDER BY id');
        return res.status(200).json(result.rows);
        
    } catch (error) {
        console.error('Error al obtener trabajadores:', error);
        return res.status(500).json({ error: 'Error al obtener trabajadores' });
    }

}

//modificar un trabajador

const modificarTrabajador = async (req, res) => {
    const {id} = req.params;
    const { nombre, apellido, dni, email,
        telefono, fecha_ingreso, 
         estado_id, usuario_id, 
        especialidad_id, jefe_id 
       } = req.body;

    try {
        // Verificar que el trabajador existe
        const trabajadorExistente = await pool.query('SELECT * FROM trabajadores WHERE id = $1', [id]);
        if (trabajadorExistente.rows.length === 0) {
            return res.status(404).json({ error: 'Trabajador no encontrado' });
        }

        // Actualizar el trabajador
        const result = await pool.query(`
            UPDATE trabajadores 
            SET nombre = $1, apellido = $2, dni = $3, email = $4, telefono = $5, fecha_ingreso = $6
            , estado_id = $7, usuario_id = $8, especialidad_id = $9, jefe_id = $10 , updated_at = now()
            WHERE id = $11 
            RETURNING *
        `, [nombre, apellido, dni, email, telefono, fecha_ingreso, estado_id, usuario_id, especialidad_id, jefe_id, id]);

        const trabajadorModificado = result.rows[0];
        return res.status(200).json({
            message: 'Success',
            data: trabajadorModificado
        });
        
    } catch (error) {
        console.error('Error al modificar trabajador:', error);
        return res.status(500).json({ error: 'Error al modificar trabajador' });
        
    }
}

//dar de baja un trabajador, sin borrarlo de la base de datos
const darDeBajaTrabajador = async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar si tiene subordinados asignados
    const subordinados = await pool.query(
      `SELECT id FROM trabajadores WHERE jefe_id = $1`,
      [id]
    );
    if (subordinados.rows.length > 0) {
      return res.status(400).json({
        ok: false,
        message: `No se puede eliminar: el trabajador tiene ${subordinados.rows.length} subordinado(s) asignado(s).`,
      });
    }

    // Verificar si tiene labores asignadas
    const labores = await pool.query(
      `SELECT id FROM labores WHERE trabajador_id = $1`,
      [id]
    );
    if (labores.rows.length > 0) {
      return res.status(400).json({
        ok: false,
        message: `No se puede eliminar: el trabajador tiene ${labores.rows.length} labor(es) asignada(s).`,
      });
    }

    // Si pasa las validaciones, eliminar
    await pool.query(`DELETE FROM trabajadores WHERE id = $1`, [id]);

    res.status(200).json({ ok: true, message: 'Trabajador eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar trabajador:', error);
    res.status(500).json({ ok: false, message: 'Error interno del servidor.' });
  }
};

//marcar presentismo

// {
//   "obra_id": 1,
//   "latitud": -32.4078,
//   "longitud": -63.2421,
//   "observaciones": "Ingreso registrado desde QR"
// }

const marcarPresentismo = async (req, res) => {
  const client = await pool.connect();

  try {
    const { obra_id, latitud, longitud, observaciones } = req.body;

    // Ajustar según tu middleware de auth
    const usuario_id = req.user?.id;

    if (!usuario_id) {
      return res.status(401).json({
        ok: false,
        error: "Usuario no autenticado",
      });
    }

    if (!obra_id) {
      return res.status(400).json({
        ok: false,
        error: "El campo obra_id es obligatorio",
      });
    }

    await client.query("BEGIN");

    // 1) Buscar trabajador asociado al usuario autenticado
    const trabajadorResult = await client.query(
      `
      SELECT id
      FROM trabajadores
      WHERE usuario_id = $1
      LIMIT 1
      `,
      [usuario_id]
    );

    if (trabajadorResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        error: "No existe un trabajador asociado al usuario autenticado",
      });
    }

    const trabajador_id = trabajadorResult.rows[0].id;

    // 2) Validar obra existente
    const obraResult = await client.query(
      `
      SELECT 1
      FROM obras
      WHERE id = $1
      LIMIT 1
      `,
      [obra_id]
    );

    if (obraResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        error: "La obra indicada no existe",
      });
    }

    // 3) Validar que el trabajador esté asignado a la obra
    const asignacionResult = await client.query(
      `
      SELECT 1
      FROM trabajadores_obras
      WHERE trabajador_id = $1
        AND obra_id = $2
      LIMIT 1
      `,
      [trabajador_id, obra_id]
    );

    if (asignacionResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        ok: false,
        error: "El trabajador no está asignado a la obra indicada",
      });
    }

    // 4) Insertar presentismo
    const presentismoResult = await client.query(
      `
      INSERT INTO presentismos
        (fecha, latitud, longitud, obra_id, observaciones, trabajador_id, created_at, updated_at)
      VALUES
        (now(), $1, $2, $3, $4, $5, now(), now())
      RETURNING *;
      `,
      [
        latitud ?? null,
        longitud ?? null,
        obra_id,
        observaciones ?? null,
        trabajador_id,
      ]
    );

    const presentismoCreado = presentismoResult.rows[0];

    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,
      message: "Presentismo registrado correctamente",
      data: presentismoCreado,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error marcarPresentismo:", err);

    return res.status(500).json({
      ok: false,
      error: "Error al registrar presentismo",
    });
  } finally {
    client.release();
  }
};
const getTrabajadorById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM trabajadores WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Trabajador no encontrado' 
      });
    }

    return res.status(200).json({ 
      ok: true, 
      data: result.rows[0] 
    });

  } catch (error) {
    console.error('Error al obtener trabajador:', error);
    return res.status(500).json({ 
      ok: false, 
      error: 'Error al obtener el trabajador' 
    });
  }
};

// Obtiene todos los trabajadores de una especialidad específica
const getTrabajadoresByEspecialidad = async (req, res) => {
  const { especialidad_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM trabajadores WHERE especialidad_id = $1`,
      [especialidad_id]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener trabajadores por especialidad:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};
// Obtiene jefes de una especialidad con su equipo anidado
// Un jefe es un trabajador con jefe_id IS NULL dentro de una especialidad
const getJefesConEquipoPorEspecialidad = async (req, res) => {
  const { especialidad_id } = req.params;

  try {
    // Trae todos los trabajadores de la especialidad
    const result = await pool.query(
      `SELECT * FROM trabajadores WHERE especialidad_id = $1`,
      [especialidad_id]
    );

    const todos = result.rows;

    // Separa jefes (jefe_id IS NULL) y subordinados
    const jefes = todos.filter((t) => t.jefe_id === null);
    const subordinados = todos.filter((t) => t.jefe_id !== null);

    // Anida el equipo dentro de cada jefe
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
    getJefesConEquipoPorEspecialidad
};



//crear un nuevo trabajador
// Table trabajadores {
//   id serial [pk]
//   nombre varchar
//   apellido varchar
//   dni varchar [unique]
//   telefono varchar(50)
//   fecha_ingreso date
//   obra_id int [ref: > obras.id]
//   estado_id int [ref: > estados.id] 
//   usuario_id int [ref: > usuarios.id]
//   especialidad_id int [ref: > especialidades.id]
//   jefe_id int [ref: > trabajadores.id]
//   usuario_creador_id int [ref :> usuarios.id]
// }

// const createTrabajador = async (req, res) => {
    
    
//     try {


//         const {
//         nombre,
//         apellido,
//         dni,
//         telefono,
//         fecha_ingreso,
//         obra_id,
//         estado_id,
//         usuario_id,
//         especialidad_id,
//         jefe_id,
//         usuario_creador_id
         
           
//     } = req.body

//     // verificamos la NO existencia el dni en la db 

//     const dniExistente = await pool.query('SELECT * FROM trabajadores WHERE dni = $1', [dni]);
//     if (dniExistente.rows.length > 0) {
//         return res.status(400).json({ error: 'El DNI ya está registrado' });
//     }

//     // validar el usuario creador
//     const usuarioCreador = await pool.query('SELECT * FROM usuarios WHERE id = $1', [usuario_creador_id]);
//     if (usuarioCreador.rows.length === 0) {
//         return res.status(404).json({ error: 'Usuario creador no encontrado' });
//     }

//     if(jefe_id){
//         const usuarioJefe = await pool.query('SELECT * FROM usuarios WHERE id = $1', [jefe_id]);
//         if(usuarioJefe.rows.length === 0) {
//             return res.status(404).json({ error: 'Jefe no encontrado' });
//         }

//     }
//     //query para registrar el nuevo trabajador luego de todas las valideishons

//    const nuevoTrabajador = await pool.query(`INSERT INTO trabajadores 
//     (nombre, apellido, dni,telefono, fecha_ingreso, obra_id, estado_id, 
//     usuario_id, especialidad_id, jefe_id, usuario_creador_id) 
//     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
//     RETURNING *`,
//     [nombre, apellido, dni, telefono,
//          fecha_ingreso, obra_id, estado_id,
//           usuario_id, especialidad_id, jefe_id, 
//           usuario_creador_id]);    
        
//     const trabajadorCreado = nuevoTrabajador.rows[0];

//     const trabajadorId = trabajadorCreado.id;

//     if (obra_id) {
//     await pool.query(
//         `INSERT INTO trabajadores_obras (trabajador_id, obra_id)
//         VALUES ($1, $2)
//         ON CONFLICT (trabajador_id, obra_id) DO NOTHING`,
//         [trabajadorId, obra_id]
//     );
// }
//     res.status(200).json({
//         message:'Success',
//         data: trabajadorCreado

//     })

//     } catch (error) {
//         console.error('Error: al cargar trabajador:', error);
//         return res.status(500).json({ error: 'Error al crear trabajador' });
        
//     }
   



// }


// const createTrabajador = async (req, res) => {
//   const client = await pool.connect();

//   try {
//     const {
//       nombre,
//       apellido,
//       dni,
//       telefono,
//       fecha_ingreso,
      
//       estado_id,
//       usuario_id,
//       especialidad_id,
//       jefe_id,
//       usuario_creador_id,
     
//     } = req.body;

//     await client.query("BEGIN");

//     // DNI único
//     const dniExistente = await client.query(
//       "SELECT 1 FROM trabajadores WHERE dni = $1",
//       [dni]
//     );
//     if (dniExistente.rowCount > 0) {
//       await client.query("ROLLBACK");
//       return res.status(400).json({ error: "El DNI ya está registrado" });
//     }

//     // usuario creador existe
//     const usuarioCreador = await client.query(
//       "SELECT 1 FROM usuarios WHERE id = $1",
//       [usuario_creador_id]
//     );
//     if (usuarioCreador.rowCount === 0) {
//       await client.query("ROLLBACK");
//       return res.status(404).json({ error: "Usuario creador no encontrado" });
//     }

//     // validar obra si viene
//     if (obra_id) {
//       const obraExiste = await client.query(
//         "SELECT 1 FROM obras WHERE id = $1",
//         [obra_id]
//       );
//       if (obraExiste.rowCount === 0) {
//         await client.query("ROLLBACK");
//         return res.status(404).json({ error: "Obra no encontrada" });
//       }
//     }

//     // ⚠️ ojo con jefe_id: si referencia trabajadores.id, validalo contra trabajadores, no usuarios
//     // (lo dejo como lo tenías, pero revisalo)
//     if (jefe_id) {
//       const usuarioJefe = await client.query(
//         "SELECT 1 FROM usuarios WHERE id = $1",
//         [jefe_id]
//       );
//       if (usuarioJefe.rowCount === 0) {
//         await client.query("ROLLBACK");
//         return res.status(404).json({ error: "Jefe no encontrado" });
//       }
//     }

//     // Insert trabajador
//     const nuevoTrabajador = await client.query(
//       `INSERT INTO trabajadores
//         (nombre, apellido, dni, telefono, fecha_ingreso,  estado_id,
//          usuario_id, especialidad_id, jefe_id, usuario_creador_id)
//        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
//        RETURNING *`,
//       [
//         nombre,
//         apellido,
//         dni,
//         telefono,
//         fecha_ingreso,
        
//         estado_id,
//         usuario_id,
//         especialidad_id,
//         jefe_id ?? null,
//         usuario_creador_id,
//       ]
//     );

//     const trabajadorCreado = nuevoTrabajador.rows[0];

   

//     await client.query("COMMIT");
//     return res.status(200).json({ message: "Success", data: trabajadorCreado });
//   } catch (error) {
//     await client.query("ROLLBACK");
//     console.error("Error: al cargar trabajador:", error);
//     return res.status(500).json({ error: "Error al crear trabajador" });
//   } finally {
//     client.release();
//   }
// };



