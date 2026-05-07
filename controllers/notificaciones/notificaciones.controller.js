const pool = require('../../connection/db');

// Clientes SSE conectados: Map<userId, res[]>
const sseClients = new Map();

// ── SSE stream ────────────────────────────────────────────────

  // Verificar token manualmente — acepta query param o header
const sseStream = (req, res) => {
  const origin = req.headers.origin || 'http://localhost:5173';
  
  const authHeader = req.headers.authorization;
  const tokenFromQuery = req.query.token;
  const token = tokenFromQuery || (authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null);

  if (!token) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.flushHeaders();
    res.write(`event: auth_error\ndata: ${JSON.stringify({ message: 'Token no proporcionado' })}\n\n`);
    return res.end();
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  } catch (error) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.flushHeaders();
    res.write(`event: auth_error\ndata: ${JSON.stringify({ message: 'Token expirado' })}\n\n`);
    return res.end();
  }

  const userId  = decoded.userId;
  const isAdmin = [1, 3, 4, 6].includes(decoded.rol_id);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);

  const clientKey = isAdmin ? 'admin' : String(userId);
  if (!sseClients.has(clientKey)) sseClients.set(clientKey, []);
  sseClients.get(clientKey).push(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    const clients  = sseClients.get(clientKey) || [];
    const filtered = clients.filter((c) => c !== res);
    if (filtered.length === 0) sseClients.delete(clientKey);
    else sseClients.set(clientKey, filtered);
  });
};

// ── Emitir evento SSE a los clientes correspondientes ─────────
const emitirSSE = (notificacion) => {
  const data = `data: ${JSON.stringify(notificacion)}\n\n`;

  if (notificacion.usuario_id === null) {
    // Global → solo admins
    (sseClients.get('admin') || []).forEach((res) => res.write(data));
  } else {
    // Personal → solo ese usuario específico + admins
    const key = String(notificacion.usuario_id);
    (sseClients.get(key) || []).forEach((res) => res.write(data));
    (sseClients.get('admin') || []).forEach((res) => res.write(data));
  }
};

// ── GET /notificaciones ───────────────────────────────────────
const getNotificaciones = async (req, res) => {
  const userId = req.user.userId;
  const rolId = req.user.rol_id;
  const isAdmin = [1, 3, 4, 6].includes(rolId);

  try {
    let result;

    if (isAdmin) {
      // Admins ven: globales (usuario_id = null) + las que les conciernen (su usuario_id)
      result = await pool.query(
        `SELECT * FROM notificaciones
         WHERE usuario_id IS NULL OR usuario_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [userId]
      );
    } else {
      // Trabajadores ven: solo las suyas (su usuario_id exacto)
      result = await pool.query(
        `SELECT * FROM notificaciones
         WHERE usuario_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      );
    }

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error getNotificaciones:', err);
    res.status(500).json({ error: 'Error interno' });
  }
};

// ── POST /notificaciones/interna ──────────────────────────────
// Llamada desde otros controllers vía HTTP
const crearNotificacionInterna = async (req, res) => {
  const { tipo, mensaje, usuario_id = null } = req.body;

  if (!tipo || !mensaje) {
    return res.status(400).json({ error: 'tipo y mensaje son requeridos' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO notificaciones (tipo, mensaje, usuario_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [tipo, mensaje, usuario_id]
    );

    const notificacion = result.rows[0];
    emitirSSE(notificacion);

    res.status(201).json({ success: true, data: notificacion });
  } catch (err) {
    console.error('Error crearNotificacionInterna:', err);
    res.status(500).json({ error: 'Error interno' });
  }
};

// ── PATCH /notificaciones/:id/leer ────────────────────────────
const marcarLeida = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;
  const isAdmin = [1, 3, 4, 6].includes(req.user.rol_id);

  try {
    const check = await pool.query(
      `SELECT * FROM notificaciones WHERE id = $1`,
      [id]
    );

    if (check.rows.length === 0)
      return res.status(404).json({ error: 'Notificación no encontrada' });

    const notif = check.rows[0];

    // Solo puede marcar la suya o si es admin
    if (!isAdmin && notif.usuario_id !== userId)
      return res.status(403).json({ error: 'Sin permisos' });

    await pool.query(
      `UPDATE notificaciones SET leida = TRUE WHERE id = $1`,
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error marcarLeida:', err);
    res.status(500).json({ error: 'Error interno' });
  }
};

// ── PATCH /notificaciones/leer-todas ─────────────────────────
const marcarTodasLeidas = async (req, res) => {
  const userId = req.user.userId;
  const isAdmin = [1, 3, 4, 6].includes(req.user.rol_id);

  try {
    isAdmin
      ? await pool.query(`UPDATE notificaciones SET leida = TRUE`)
      : await pool.query(
          `UPDATE notificaciones SET leida = TRUE
           WHERE usuario_id = $1 OR usuario_id IS NULL`,
          [userId]
        );

    res.json({ success: true });
  } catch (err) {
    console.error('Error marcarTodasLeidas:', err);
    res.status(500).json({ error: 'Error interno' });
  }
};

module.exports = {
  sseStream,
  getNotificaciones,
  crearNotificacionInterna,
  marcarLeida,
  marcarTodasLeidas,
};