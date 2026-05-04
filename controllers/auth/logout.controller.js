const pool = require('../../connection/db.js');
const { notificar } = require('../../src/helpers/notificar.js');

const logout = async (req, res) => {
  const { email } = req.body;
  const estadoInactivoId = 2; // estado 'INACTIVO'

  if (!email) {
    return res.status(400).json({ error: 'Falta el email' });
  }

  try {
    // Normalizamos el email para evitar inconsistencias
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Buscar usuario por email
    const result = await pool.query(
      `SELECT id FROM usuarios WHERE email = $1`,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const userId = result.rows[0].id;

    // 2. Actualizar la/las sesiones activas del usuario
    const updateResult = await pool.query(
      `UPDATE sesiones
       SET estado_id = $1,
           actualizado_en = NOW()
       WHERE usuario_id = $2
         AND estado_id = 1 
       RETURNING id`,
      [estadoInactivoId, userId]
    );

    // Opcional: verificar si no había sesiones activas
    if (updateResult.rowCount === 0) {
      return res.status(200).json({
        message: 'No había sesiones activas, pero se procesó el logout igualmente'
      });
    }

    await notificar({ tipo: 'logout', mensaje: `Usuario cerró sesión`, usuario_id: userId });

    return res.status(200).json({
      message: 'Sesión finalizada correctamente',
      sesiones_cerradas: updateResult.rowCount
    });
  } catch (error) {
    notificar({ tipo: 'error_sistema', mensaje: `Error en logout: ${error.message}`, usuario_id: null });
    console.error('Error al cerrar sesión:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

};


module.exports = { logout };