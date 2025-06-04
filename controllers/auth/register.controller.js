// controllers/auth.controller.js
const pool = require('../../db/db.js');
const bcrypt = require('bcrypt');
const { generarTotp, generarQRCodeTerminal, generarQRCodeDataURL } = require('../../utils/auth/totp-util.js');

const register = async (req, res) => {
  try {
    const { nombre, email, password, rol = 'user' } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Faltan nombre, email o password' });
    }

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

    // Mostrar en terminal el QR para escanear (opcional)
    await generarQRCodeTerminal(otpauth_url);

    // Generar QR en formato Data URL por si se quiere mostrar en frontend
    const qrCodeDataURL = await generarQRCodeDataURL(otpauth_url);

    // Crear usuario
    const result = await pool.query(`
      INSERT INTO usuarios (rol, nombre, email, password_hash, totp_seed, creado_en)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, nombre, email, rol, creado_en
    `, [rol, nombre, email, password_hash, totp_seed]);

    return res.status(201).json({
      user: result.rows[0],
      message: 'Usuario registrado correctamente',
      qrCodeDataURL // esto lo podés mostrar en frontend si querés
    });

  } catch (error) {
    console.error('Error al registrar usuario:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { register };
