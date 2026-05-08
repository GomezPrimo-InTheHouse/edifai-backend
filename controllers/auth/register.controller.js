// controllers/auth.controller.js
const pool = require('../../connection/db.js');
const bcrypt = require('bcryptjs'); // unificamos a bcryptjs
const { generarTotp, generarQRCodeTerminal, generarQRCodeDataURL } = require('../../utils/auth/totp-util.js');

const register = async (req, res) => {
  try {
    const { nombre, email, password, rol_id, estado_id, usuario_creador_id } = req.body;

    if (!nombre || !email || !password || !rol_id) {
      return res.status(400).json({ error: 'Faltan nombre, email, password o rol_id' });
    }

    const rol = await pool.query('SELECT * FROM roles WHERE id = $1', [rol_id]);
    if (rol.rows.length === 0) {
      return res.status(400).json({ error: 'Rol no válido' });
    }
    const nuevoRol = rol.rows[0];

    const existente = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (existente.rows.length > 0) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Generar TOTP y QR
    const totp = generarTotp(email);
    const totp_seed = totp.base32;
    const otpauth_url = totp.otpauth_url;

    await generarQRCodeTerminal(otpauth_url);
    const qrCodeDataURL = await generarQRCodeDataURL(otpauth_url);

    const estadoActivoId = estado_id || 1;

    const result = await pool.query(
      `
      INSERT INTO usuarios (
        rol_id, nombre, email, password_hash, totp_seed,
        usuario_creador_id, estado_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING id, nombre, email, rol_id, estado_id, usuario_creador_id, created_at
      `,
      [rol_id, nombre, email, password_hash, totp_seed, usuario_creador_id || null, estadoActivoId]
    );

    const usuarioCreado = result.rows[0];

    return res.status(201).json({
      user: {
        id: usuarioCreado.id,
        nombre: usuarioCreado.nombre,
        email: usuarioCreado.email,
        rol: { nombre: nuevoRol.nombre, id: nuevoRol.id },
        created_at: usuarioCreado.created_at,
        estado_id: usuarioCreado.estado_id,
        usuario_creador_id: usuarioCreado.usuario_creador_id,
      },
      message: 'Usuario registrado correctamente',
      qrCodeDataURL,
      totp_seed,
    });

  } catch (error) {
    console.error('Error al registrar usuario:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  register,
  // los otros métodos (obtenerUsuarios, obtenerUsuarioPorId, modificarUsuario)
  // idealmente los vamos a ir migrando al módulo ms-usuario, para no duplicar lógica.
};
