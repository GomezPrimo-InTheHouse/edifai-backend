// controllers/auth.controller.js
const pool = require('../../connection/db.js');
const bcrypt = require('bcrypt');
const { generarTotp, generarQRCodeTerminal, generarQRCodeDataURL } = require('../../utils/auth/totp-util.js');


const register = async (req, res) => {
  try {
    const { nombre, email, password, rol_id} = req.body;

    if (!nombre || !email || !password || !rol_id) {
      return res.status(400).json({ error: 'Faltan nombre, email, password o rol id' });
    }
    

    // Validar rol_id
    const rol = await pool.query('SELECT * FROM roles WHERE id = $1', [
      rol_id
    ]);
    if (rol.rows.length === 0) {
      return res.status(400).json({ error: 'Rol no válido' });
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
    estadoActivoId = 1; // El estado activo es 1

    const result = await pool.query(`
      INSERT INTO usuarios (rol_id, nombre, email, password_hash, totp_seed, created_at, estado_id)
      VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      RETURNING id, nombre, email, rol_id, created_at, estado_id
    `, [rol_id, nombre, email, password_hash, totp_seed, estadoActivoId]);

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


//obtener todos los usuarios
const obtenerUsuarios = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM usuarios');
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};


//obtener usuarios por id 
const obtenerUsuarioPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener usuario por ID:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

//modificar usuario (tomando su id como parametro)
const modificarUsuario = async (req, res) => {
  const { id } = req.params;
  const { nombre, email, password, rol_id } = req.body;
  try {
    // Verificar si el usuario existe
    const usuarioExistente = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    if (usuarioExistente.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Validar rol_id
    const rol = await pool.query('SELECT * FROM roles WHERE id = $1', [rol_id]);
    if (rol.rows.length === 0) {
      return res.status(400).json({ error: 'Rol no válido' });
    }

    // Hashear la nueva contraseña si se proporciona
    let password_hash = null;
    if (password) {
      password_hash = await bcrypt.hash(password, 10);
    }

    // Actualizar el usuario
    const result = await pool.query(`
      UPDATE usuarios 
      SET nombre = $1, email = $2, password_hash = COALESCE($3, password_hash), rol_id = $4 
      WHERE id = $5 
      RETURNING id, nombre, email, rol_id
    `, [nombre, email, password_hash, rol_id, id]);

    return res.status(200).json({
      user: result.rows[0],
      message: 'Usuario modificado correctamente'
    });

  } catch (error) {
    console.error('Error al modificar usuario:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}


module.exports = { register, obtenerUsuarios, obtenerUsuarioPorId, modificarUsuario };
