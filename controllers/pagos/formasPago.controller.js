const pool = require('../../connection/db.js');

const getAllFormasPago = async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM formas_pago ORDER BY nombre ASC`);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al obtener formas de pago:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = { getAllFormasPago };