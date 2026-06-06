// const pool = require('../../connection/db.js');

// const getAllClientes = async (req, res) => {
//   try {
//     const result = await pool.query(`
//       SELECT * FROM clientes WHERE estado_id = 1 ORDER BY nombre ASC
//     `);
//     res.status(200).json({ success: true, data: result.rows });
//   } catch (error) {
//     console.error('Error en getAllClientes:', error);
//     res.status(500).json({ success: false, message: 'Error interno del servidor' });
//   }
// };

// const getClienteById = async (req, res) => {
//   const { id } = req.params;
//   try {
//     const result = await pool.query(`
//       SELECT c.*, 
//         COALESCE(
//           json_agg(o.* ORDER BY o.id DESC) FILTER (WHERE o.id IS NOT NULL), '[]'
//         ) AS obras
//       FROM clientes c
//       LEFT JOIN obras o ON o.cliente_id = c.id
//       WHERE c.id = $1
//       GROUP BY c.id
//     `, [id]);
//     if (result.rows.length === 0)
//       return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
//     res.status(200).json({ success: true, data: result.rows[0] });
//   } catch (error) {
//     console.error('Error en getClienteById:', error);
//     res.status(500).json({ success: false, message: 'Error interno del servidor' });
//   }
// };

// const createCliente = async (req, res) => {
//   const { nombre, apellido, razon_social, dni_cuit, telefono, direccion, email } = req.body;
//   if (!nombre || !telefono)
//     return res.status(400).json({ success: false, message: 'Nombre y teléfono son obligatorios' });
//   try {
//     const result = await pool.query(`
//       INSERT INTO clientes (nombre, apellido, razon_social, dni_cuit, telefono, direccion, email, estado_id)
//       VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
//       RETURNING *
//     `, [nombre, apellido ?? null, razon_social ?? null, dni_cuit ?? null, telefono, direccion ?? null, email ?? null]);
//     res.status(201).json({ success: true, data: result.rows[0] });
//   } catch (error) {
//     console.error('Error en createCliente:', error);
//     res.status(500).json({ success: false, message: 'Error interno del servidor' });
//   }
// };

// const updateCliente = async (req, res) => {
//   const { id } = req.params;
//   const { nombre, apellido, razon_social, dni_cuit, telefono, direccion, email } = req.body;
//   try {
//     const result = await pool.query(`
//       UPDATE clientes SET
//         nombre       = COALESCE($1, nombre),
//         apellido     = COALESCE($2, apellido),
//         razon_social = COALESCE($3, razon_social),
//         dni_cuit     = COALESCE($4, dni_cuit),
//         telefono     = COALESCE($5, telefono),
//         direccion    = COALESCE($6, direccion),
//         email        = COALESCE($7, email),
//         updated_at   = NOW()
//       WHERE id = $8
//       RETURNING *
//     `, [nombre, apellido, razon_social, dni_cuit, telefono, direccion, email, id]);
//     if (result.rows.length === 0)
//       return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
//     res.status(200).json({ success: true, data: result.rows[0] });
//   } catch (error) {
//     console.error('Error en updateCliente:', error);
//     res.status(500).json({ success: false, message: 'Error interno del servidor' });
//   }
// };

// // Soft delete — marca como inactivo
// const deleteCliente = async (req, res) => {
//   const { id } = req.params;
//   try {
//     const result = await pool.query(`
//       UPDATE clientes SET estado_id = 2, updated_at = NOW()
//       WHERE id = $1 AND estado_id = 1
//       RETURNING *
//     `, [id]);
//     if (result.rows.length === 0)
//       return res.status(404).json({ success: false, message: 'Cliente no encontrado o ya inactivo' });
//     res.status(200).json({ success: true, message: 'Cliente dado de baja correctamente' });
//   } catch (error) {
//     console.error('Error en deleteCliente:', error);
//     res.status(500).json({ success: false, message: 'Error interno del servidor' });
//   }
// };

// module.exports = { getAllClientes, getClienteById, createCliente, updateCliente, deleteCliente };
const pool = require('../../connection/db.js');
const { getFiltro, ROL_ADMIN_PRIVADO } = require('../../middlewares/filtrarPorPropietario.js');

const getAllClientes = async (req, res) => {
  try {
    const { where, params } = getFiltro(req);
    const result = await pool.query(
      `SELECT * FROM clientes WHERE estado_id = 1 ${where} ORDER BY nombre ASC`,
      params
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error en getAllClientes:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const getClienteById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT c.*, 
        COALESCE(
          json_agg(o.* ORDER BY o.id DESC) FILTER (WHERE o.id IS NOT NULL), '[]'
        ) AS obras
      FROM clientes c
      LEFT JOIN obras o ON o.cliente_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `, [id]);

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });

    const cliente = result.rows[0];
    if (req.user.rol_id === ROL_ADMIN_PRIVADO && cliente.propietario_id !== req.user.userId)
      return res.status(403).json({ success: false, message: 'Sin permiso sobre este cliente' });

    res.status(200).json({ success: true, data: cliente });
  } catch (error) {
    console.error('Error en getClienteById:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const createCliente = async (req, res) => {
  const { nombre, apellido, razon_social, dni_cuit, telefono, direccion, email } = req.body;

  if (!nombre || !telefono)
    return res.status(400).json({ success: false, message: 'Nombre y teléfono son obligatorios' });

  const propietario_id = req.user.rol_id === ROL_ADMIN_PRIVADO ? req.user.userId : null;

  try {
    const result = await pool.query(`
      INSERT INTO clientes (nombre, apellido, razon_social, dni_cuit, telefono, direccion, email, estado_id, propietario_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)
      RETURNING *
    `, [nombre, apellido ?? null, razon_social ?? null, dni_cuit ?? null, telefono, direccion ?? null, email ?? null, propietario_id]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error en createCliente:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const updateCliente = async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, razon_social, dni_cuit, telefono, direccion, email } = req.body;

  try {
    const existente = await pool.query(`SELECT propietario_id FROM clientes WHERE id = $1`, [id]);
    if (existente.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });

    if (req.user.rol_id === ROL_ADMIN_PRIVADO && existente.rows[0].propietario_id !== req.user.userId)
      return res.status(403).json({ success: false, message: 'Sin permiso sobre este cliente' });

    const result = await pool.query(`
      UPDATE clientes SET
        nombre       = COALESCE($1, nombre),
        apellido     = COALESCE($2, apellido),
        razon_social = COALESCE($3, razon_social),
        dni_cuit     = COALESCE($4, dni_cuit),
        telefono     = COALESCE($5, telefono),
        direccion    = COALESCE($6, direccion),
        email        = COALESCE($7, email),
        updated_at   = NOW()
      WHERE id = $8
      RETURNING *
    `, [nombre, apellido, razon_social, dni_cuit, telefono, direccion, email, id]);

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error en updateCliente:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const deleteCliente = async (req, res) => {
  const { id } = req.params;
  try {
    const existente = await pool.query(`SELECT propietario_id FROM clientes WHERE id = $1 AND estado_id = 1`, [id]);
    if (existente.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Cliente no encontrado o ya inactivo' });

    if (req.user.rol_id === ROL_ADMIN_PRIVADO && existente.rows[0].propietario_id !== req.user.userId)
      return res.status(403).json({ success: false, message: 'Sin permiso sobre este cliente' });

    await pool.query(`UPDATE clientes SET estado_id = 2, updated_at = NOW() WHERE id = $1`, [id]);
    res.status(200).json({ success: true, message: 'Cliente dado de baja correctamente' });
  } catch (error) {
    console.error('Error en deleteCliente:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = { getAllClientes, getClienteById, createCliente, updateCliente, deleteCliente };