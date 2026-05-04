const pool = require('../../connection/db.js');
require('dotenv').config();
const { notificar } = require('../../src/helpers/notificar.js');

const createObra = async (req, res) => {
  try {
    const {
      usuario_creador_id,
      nombre,
      descripcion,
      ubicacion,
      latitud,        // ← nuevo
      longitud,       // ← nuevo
      fecha_fin_estimado,
      fecha_inicio_estimado,
      tipo_obra_id,
      estado_id,
    } = req.body;

    if (!nombre || !descripcion || !ubicacion ||
      !fecha_fin_estimado || !fecha_inicio_estimado ||
      !tipo_obra_id || !estado_id || !usuario_creador_id) {
      return res.status(400).json({ message: 'Faltan datos para crear la obra' });
    }

    const tipoObra = await pool.query('SELECT * FROM tipos_de_obra WHERE id = $1', [tipo_obra_id]);
    if (tipoObra.rows.length === 0) {
      return res.status(400).json({ message: 'Tipo de obra no existente' });
    }

    const result = await pool.query(
      `INSERT INTO obras (
        usuario_creador_id, nombre, descripcion, ubicacion,
        latitud, longitud,
        fecha_fin_estimado, fecha_inicio_estimado,
        tipo_obra_id, estado_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        usuario_creador_id, nombre, descripcion, ubicacion,
        latitud ?? null, longitud ?? null,
        fecha_fin_estimado, fecha_inicio_estimado,
        tipo_obra_id, estado_id,
      ]
    );

    await notificar({
      tipo: 'obra_creada',
      mensaje: `Nueva obra creada: "${nombre}"`,
      usuario_id: null, // global — solo admins
    });

    return res.status(200).json({
      success: true,
      message: 'Obra creada con éxito',
      obra: result.rows[0],
    });
  } catch (error) {
    notificar({
      tipo: 'error_sistema',
      mensaje: `Error al crear obra: ${error.message}`,
      usuario_id: null,
    });
    res.status(500).json({ success: false, message: 'Error al crear obra', error: error.message });
  }
};

const modifyObra = async (req, res) => {
  const { id } = req.params;
  const {
    usuario_creador_id,
    nombre,
    descripcion,
    ubicacion,
    latitud,        // ← nuevo
    longitud,       // ← nuevo
    fecha_inicio_real,
    fecha_fin_real,
    fecha_inicio_estimado,
    fecha_fin_estimado,
    tipo_obra_id,
    estado_id,
  } = req.body;

  try {
    const obraExistente = await pool.query('SELECT id FROM obras WHERE id = $1', [id]);
    if (obraExistente.rows.length === 0) {
      return res.status(404).json({ error: 'Obra no encontrada' });
    }

    if (!nombre) {
      return res.status(400).json({ error: 'Faltan datos obligatorios (nombre)' });
    }

    const result = await pool.query(
      `UPDATE obras SET
        usuario_creador_id = $1,
        nombre             = $2,
        descripcion        = $3,
        ubicacion          = $4,
        latitud            = $5,
        longitud           = $6,
        fecha_inicio_real  = $7,
        fecha_fin_real     = $8,
        fecha_inicio_estimado = $9,
        fecha_fin_estimado = $10,
        tipo_obra_id       = $11,
        estado_id          = $12
      WHERE id = $13
      RETURNING *`,
      [
        usuario_creador_id,
        nombre,
        descripcion || null,
        ubicacion || null,
        latitud ?? null,
        longitud ?? null,
        fecha_inicio_real || null,
        fecha_fin_real || null,
        fecha_inicio_estimado || null,
        fecha_fin_estimado || null,
        tipo_obra_id || null,
        estado_id || null,
        id,
      ]
    );

    await notificar({
      tipo: 'obra_modificada',
      mensaje: `Obra #${id} fue modificada`,
      usuario_id: null, // global — solo admins
    });

    return res.status(200).json({
      obra: result.rows[0],
      message: 'Obra actualizada correctamente',
    });
  } catch (error) {
    console.error('Error al modificar obra:', error);
    notificar({
      tipo: 'error_sistema',
      mensaje: `Error al modificar obra #${id}: ${error.message}`,
      usuario_id: null,
    });
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

//getAll obras
const getAllObras = async (_req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM obras ORDER BY id`);
    return res.status(200).json({
      success: true,
      message: 'Obras obtenidas con éxito',
      obras: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener obras',
      error: error.message
    });
  }
}


//dar de baja obra ( no eliminar)
const darDeBajaObra = async (req, res) => {
  try {
    const { id } = req.params;

    //validar existencia de obra

    const existeObra = await pool.query('Select * from Obras where id = $1', [id])
    if (existeObra.rows[0] === 0) {
      return res.status(404).json({ message: 'Obra no encontrada' });
    }

    //actualizar estado de obra
    const result = await pool.query(`
    UPDATE Obras
    SET estado_id = 2
    WHERE id = $1
    RETURNING *;
    `, [id]);

    res.status(200).json({
      success: true,
      message: 'Obra dada de baja correctamente',
      obra: result.rows[0]
    })

  } catch (error) {
    console.error('Error al dar de baja obra:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });

  }


}

//getObraByID
const getObraByID = async (req, res) => {
  try {
    const { id } = req.params;
    const obra = await pool.query('SELECT * FROM Obras WHERE id = $1', [id])
    if (obra.rows[0] === 0) {
      return res.status(404).json({ message: 'Obra no encontrada' });
    }
    res.status(200).json({
      success: true,
      message: 'Obra encontrada correctamente',
      obra: obra.rows[0]
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    })
  }
}


const getObrasByUbicacion = async (req, res) => {
  try {
    const { ubicacion } = req.params

    //buscar dentro de atributo 'ubicacion' si contiene la ubicacion obtenida por parametros
    const obras = await pool.query('SELECT * FROM Obras WHERE ubicacion ILIKE $1', [`%${ubicacion}%`])
    if (obras.rows[0] === 0) {
      return res.status(404).json({ message: 'No hay obras en la ubicación solicitada' })
    }

    res.status(200).json({
      success: true,
      message: 'Obras encontradas correctamente',
      obras: obras.rows
    })

  } catch (error) {

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    })

  }
}

const getObrasByEstado = async (req, res) => {
  try {
    const { estado } = req.params

    //buscar en la tabla estados, cual id corresponde al estado obtenido por parametros
    // luego asignarlo a la constante idObtenido.
    const estadoId = await pool.query('SELECT id FROM Estados WHERE nombre = $1', [estado])

    if (estadoId.rows[0] === 0) {
      return res.status(404).json({ message: 'No existe el estado proporcionado' })
    }

    const idObtenido = estadoId.rows[0].id
    //ahora se busca dentor de la tabla Obras, todas las obras que esten con el estado proporcionado por parametros

    const obras = await pool.query('SELECT * FROM Obras WHERE estado_id = $1', [idObtenido])

    //ver si hay obras con el estado proporcionado, caso contrario devolver un status 200, pero con un mensaje de no hay obras con el estado solicitado
    if (obras.rows[0] === 0) {
      return res.status(200).json({ message: 'No hay obras con el estado solicitado' })
    }

    res.status(200).json({
      success: true,
      message: 'Obras encontradas correctamente',
      obras: obras.rows
    })



  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    })
  }
}



module.exports = {
  createObra,
  getAllObras,
  darDeBajaObra,
  getObraByID,
  modifyObra,
  getObrasByUbicacion,
  getObrasByEstado
}   
