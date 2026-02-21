// controllers/auth.controller.js
const pool = require('../../connection/db.js');
const bcrypt = require('bcryptjs'); // unificamos a bcryptjs
const { generarTotp, generarQRCodeTerminal, generarQRCodeDataURL } = require('../../utils/auth/totp-util.js');

const register = async (req, res) => {
  try {
    const { nombre, email, password, rol_id } = req.body;

    if (!nombre || !email || !password || !rol_id) {
      return res.status(400).json({ error: 'Faltan nombre, email, password o rol_id' });
    }

    // Validar rol_id
    const rol = await pool.query('SELECT * FROM roles WHERE id = $1', [rol_id]);
    if (rol.rows.length === 0) {
      return res.status(400).json({ error: 'Rol no válido' });
    }
    const nuevoRol = rol.rows[0];

    // Verificar si ya existe un usuario con ese email
    const existente = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (existente.rows.length > 0) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }

    // Hashear la contraseña
    const password_hash = await bcrypt.hash(password, 10);

    // Generar TOTP y QR
    const totp = generarTotp(email);
    const totp_seed = totp.base32;
    const otpauth_url = totp.otpauth_url;

    // Mostrar en terminal el QR (opcional)
    await generarQRCodeTerminal(otpauth_url);

    // Generar QR en formato Data URL
    const qrCodeDataURL = await generarQRCodeDataURL(otpauth_url);

    // Estado ACTIVO (id = 1)
    const estadoActivoId = 1;

    const result = await pool.query(
      `
      INSERT INTO usuarios (rol_id, nombre, email, password_hash, totp_seed, created_at, updated_at, estado_id)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6)
      RETURNING id, nombre, email, rol_id, created_at, estado_id
      `,
      [rol_id, nombre, email, password_hash, totp_seed, estadoActivoId]
    );

    const usuarioCreado = result.rows[0];

    return res.status(201).json({
      user: {
        id: usuarioCreado.id,
        nombre: usuarioCreado.nombre,
        email: usuarioCreado.email,
        rol: { nombre: nuevoRol.nombre, id: nuevoRol.id },
        created_at: usuarioCreado.created_at,
        estado_id: 'activo',
      },
      message: 'Usuario registrado correctamente',
      qrCodeDataURL,
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
