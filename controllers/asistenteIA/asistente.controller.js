

const pool = require('../../connection/db.js');
const Anthropic = require('@anthropic-ai/sdk');
const { TOOLS, ejecutarTool } = require('./asistente.tools.js');
const { ROLES_ADMIN, ROL_ADMIN_PRIVADO } = require('../../middlewares/filtrarPorPropietario.js');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_MARKET_API_KEY });

const SYSTEM_PROMPT = `Sos el asistente de EdifAI, un ERP de gestión de construcción.
Respondés en español, breve y concreto, usando solo datos reales de las tools disponibles.
Nunca inventes datos. Si una tool devuelve error, comunicáselo al usuario sin inventar valores.`;

const enviarMensaje = async (req, res) => {
  const rolId = req.user?.rol_id;
  if (!ROLES_ADMIN.includes(rolId) && rolId !== ROL_ADMIN_PRIVADO) {
    return res.status(403).json({ success: false, message: 'Sin permiso para usar el asistente' });
  }

  const usuarioId = req.user.userId;
  const { mensaje, sesion_id } = req.body;
  if (!mensaje?.trim()) {
    return res.status(400).json({ success: false, message: 'El mensaje no puede estar vacío' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let sesionId = sesion_id;
    if (!sesionId) {
      const nueva = await client.query(
        `INSERT INTO asistente_sesiones (usuario_id, titulo) VALUES ($1, $2) RETURNING id`,
        [usuarioId, mensaje.slice(0, 80)]
      );
      sesionId = nueva.rows[0].id;
    } else {
      const existe = await client.query(
        `SELECT id FROM asistente_sesiones WHERE id = $1 AND usuario_id = $2`,
        [sesionId, usuarioId]
      );
      if (existe.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
      }
    }

    await client.query(
      `INSERT INTO asistente_mensajes (sesion_id, rol, contenido) VALUES ($1, 'user', $2)`,
      [sesionId, mensaje]
    );

    const historial = await client.query(
      `SELECT rol, contenido FROM asistente_mensajes WHERE sesion_id = $1 ORDER BY id ASC LIMIT 40`,
      [sesionId]
    );

    await client.query('COMMIT');

    const messages = historial.rows.map(m => ({
      role: m.rol === 'user' ? 'user' : 'assistant',
      content: m.contenido,
    }));

    const respuestaFinal = await ejecutarConversacion(messages, req);

    await pool.query(
      `INSERT INTO asistente_mensajes (sesion_id, rol, contenido) VALUES ($1, 'assistant', $2)`,
      [sesionId, respuestaFinal]
    );
    await pool.query(`UPDATE asistente_sesiones SET updated_at = NOW() WHERE id = $1`, [sesionId]);

    return res.status(200).json({ success: true, data: { sesion_id: sesionId, respuesta: respuestaFinal } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error en asistente IA:', error);
    return res.status(500).json({ success: false, message: 'Error al procesar el mensaje' });
  } finally {
    client.release();
  }
};

async function ejecutarConversacion(messages, req, intentos = 0) {
  if (intentos > 5) return 'No pude completar la consulta, probá reformular la pregunta.';

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages,
  });

  if (response.stop_reason === 'tool_use') {
    const toolUses = response.content.filter(b => b.type === 'tool_use');
    const toolResults = [];

    for (const toolUse of toolUses) {
      const resultado = await ejecutarTool(toolUse.name, toolUse.input, req);
      toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(resultado) });
    }

    const nuevosMensajes = [
      ...messages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults },
    ];

    return ejecutarConversacion(nuevosMensajes, req, intentos + 1);
  }

  const textoFinal = response.content.find(b => b.type === 'text');
  return textoFinal?.text ?? 'No obtuve una respuesta.';
}

const obtenerSesiones = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, titulo, created_at, updated_at FROM asistente_sesiones WHERE usuario_id = $1 ORDER BY updated_at DESC`,
      [req.user.userId]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al obtener sesiones:', error);
    res.status(500).json({ success: false, message: 'Error al obtener sesiones' });
  }
};

const obtenerMensajes = async (req, res) => {
  const { id } = req.params;
  try {
    const sesion = await pool.query(
      `SELECT id FROM asistente_sesiones WHERE id = $1 AND usuario_id = $2`,
      [id, req.user.userId]
    );
    if (sesion.rowCount === 0) return res.status(404).json({ success: false, message: 'Sesión no encontrada' });

    const result = await pool.query(
      `SELECT rol, contenido, created_at FROM asistente_mensajes WHERE sesion_id = $1 ORDER BY id ASC`,
      [id]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ success: false, message: 'Error al obtener mensajes' });
  }
};

const eliminarSesion = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM asistente_sesiones WHERE id = $1 AND usuario_id = $2 RETURNING id`,
      [id, req.user.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
    res.status(200).json({ success: true, message: 'Sesión eliminada' });
  } catch (error) {
    console.error('Error al eliminar sesión:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar sesión' });
  }
};

module.exports = { enviarMensaje, obtenerSesiones, obtenerMensajes, eliminarSesion };