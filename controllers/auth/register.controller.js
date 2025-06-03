// controllers/auth.controller.js
const bcrypt = require('bcrypt');
const pool = require('../../db/db.js');
const { generarTotp } = require('../../utils/auth/totp.util.js');

const registrar = async (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    // Generar secreto TOTP y QR
    const { base32, qrImage } = await generarTotp(email);

    const result = await pool.query(
      `INSERT INTO usuarios (rol, nombre, email, password_hash, totp_seed)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [nombre, email, passwordHash, base32]
    );

    const userId = result.rows[0].id;

  

    res.status(201).json({
      mensaje: 'Usuario registrado',
      qr: qrImage,
      instruccion: 'Escaneá este código QR en tu app Authenticator',
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { registrar };
