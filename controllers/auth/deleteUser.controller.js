
// controllers/userController.js
const pool = require('../../connection/db.js');

const darDeBajaUsuario = async (req, res) => {
  const { email } = req.body;
  const estadoInactivoId = 2;

  if (!email) {
    return res.status(400).json({ error: 'Falta el email' });
  }

  try {
    const userResult = await pool.query(
      `SELECT id FROM usuarios WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const userId = userResult.rows[0].id;

    // Desactivar usuario
    //el usuario quedaria con el estado inactivo y sin sesiones activas.
    await pool.query(
      `UPDATE usuarios SET estado_id = $1 WHERE id = $2`,
      [estadoInactivoId, userId]
    );

    // Desactivar todas las sesiones activas del usuario
    await pool.query(
      `UPDATE sesiones SET estado_id = $1, actualizado_en = NOW()
       WHERE usuario_id = $2 AND estado_id = 1`,
      [estadoInactivoId, userId]
    );

    return res.status(200).json({ message: 'Usuario desactivado correctamente' });
  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { darDeBajaUsuario };
