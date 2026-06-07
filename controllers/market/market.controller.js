const pool = require('../../connection/db.js');
const { notificar } = require('../../helpers/notificar.js');

const ROLES_ADMIN_ALL = [1, 3, 4, 6, 9];

// ─────────────────────────────────────────────────────────────
// PUBLICACIONES
// ─────────────────────────────────────────────────────────────

const publicarMaterial = async (req, res) => {
    const client = await pool.connect();
    try {
        const { material_id, nombre_material, descripcion, cantidad, unidad, precio_unitario, moneda } = req.body;
        const vendedor_id = req.user.userId;

        if (!nombre_material || !cantidad || !unidad || !precio_unitario)
            return res.status(400).json({ success: false, message: 'Faltan campos obligatorios: nombre_material, cantidad, unidad, precio_unitario' });

        if (cantidad <= 0)
            return res.status(400).json({ success: false, message: 'La cantidad debe ser mayor a 0' });

        await client.query('BEGIN');

        // Si viene material_id, validar stock y publicación activa
        if (material_id) {
            const materialResult = await client.query(
                `SELECT id, stock_actual, nombre FROM materiales WHERE id = $1`, [material_id]
            );
            if (materialResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Material no encontrado' });
            }

            const material = materialResult.rows[0];

            if (Number(cantidad) > Number(material.stock_actual)) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: `Stock insuficiente. Stock actual: ${material.stock_actual} ${unidad}`,
                });
            }

            // Verificar publicación activa existente
            const publicacionActiva = await client.query(
                `SELECT id FROM market_publicaciones WHERE material_id = $1 AND vendedor_id = $2 AND estado = 'activa'`,
                [material_id, vendedor_id]
            );
            if (publicacionActiva.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ success: false, message: 'Este material ya tiene una publicación activa en el Market' });
            }

            // Descontar stock
            await client.query(
                `UPDATE materiales SET stock_actual = stock_actual - $1, updated_at = NOW() WHERE id = $2`,
                [cantidad, material_id]
            );
        }

        const result = await client.query(
            `INSERT INTO market_publicaciones
        (vendedor_id, material_id, nombre_material, descripcion, cantidad, unidad, precio_unitario, moneda)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [vendedor_id, material_id ?? null, nombre_material, descripcion ?? null, cantidad, unidad, precio_unitario, moneda ?? 'ARS']
        );

        await client.query('COMMIT');

        await notificar({
            tipo: 'market_publicacion',
            mensaje: `Nueva publicación en el Market: "${nombre_material}"`,
            usuario_id: null,
        });

        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en publicarMaterial:', error.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    } finally {
        client.release();
    }
};

const getPublicaciones = async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT mp.*,
             u.nombre AS vendedor_nombre,
             u.email  AS vendedor_email
      FROM market_publicaciones mp
      JOIN usuarios u ON u.id = mp.vendedor_id
      WHERE mp.estado = 'activa'
      ORDER BY mp.created_at DESC
    `);
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error en getPublicaciones:', error.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};

const getMisPublicaciones = async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT mp.*,
             u.nombre AS vendedor_nombre,
             u.email  AS vendedor_email
      FROM market_publicaciones mp
      JOIN usuarios u ON u.id = mp.vendedor_id
      WHERE mp.vendedor_id = $1
      ORDER BY mp.created_at DESC
    `, [req.user.userId]);
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error en getMisPublicaciones:', error.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};

const cancelarPublicacion = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const pubResult = await client.query(
            `SELECT * FROM market_publicaciones WHERE id = $1`, [id]
        );
        if (pubResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Publicación no encontrada' });
        }

        const pub = pubResult.rows[0];

        if (pub.vendedor_id !== req.user.userId && req.user.rol_id !== 1) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, message: 'Sin permiso para cancelar esta publicación' });
        }

        if (pub.estado !== 'activa') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Solo se pueden cancelar publicaciones activas' });
        }

        // Devolver stock si tiene material_id
        if (pub.material_id) {
            await client.query(
                `UPDATE materiales SET stock_actual = stock_actual + $1, updated_at = NOW() WHERE id = $2`,
                [pub.cantidad, pub.material_id]
            );
        }

        await client.query(
            `UPDATE market_publicaciones SET estado = 'cancelada', updated_at = NOW() WHERE id = $1`, [id]
        );

        await client.query('COMMIT');
        return res.status(200).json({ success: true, message: 'Publicación cancelada y stock devuelto' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en cancelarPublicacion:', error.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────
// TRANSACCIONES
// ─────────────────────────────────────────────────────────────

const iniciarTransaccion = async (req, res) => {
    const client = await pool.connect();
    try {
        const { publicacion_id, cantidad_comprada } = req.body;
        const comprador_id = req.user.userId;

        if (!publicacion_id || !cantidad_comprada)
            return res.status(400).json({ success: false, message: 'Faltan campos: publicacion_id, cantidad_comprada' });

        await client.query('BEGIN');

        const pubResult = await client.query(
            `SELECT * FROM market_publicaciones WHERE id = $1`, [publicacion_id]
        );
        if (pubResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Publicación no encontrada' });
        }

        const pub = pubResult.rows[0];

        if (pub.estado !== 'activa') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'La publicación ya no está activa' });
        }

        if (pub.vendedor_id === comprador_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'No podés comprar tu propia publicación' });
        }

        if (Number(cantidad_comprada) > Number(pub.cantidad)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: `Cantidad solicitada supera la disponible (${pub.cantidad} ${pub.unidad})` });
        }

        const total = (Number(cantidad_comprada) * Number(pub.precio_unitario)).toFixed(2);

        const result = await client.query(
            `INSERT INTO market_transacciones
        (publicacion_id, comprador_id, vendedor_id, cantidad_comprada, precio_unitario, moneda, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [publicacion_id, comprador_id, pub.vendedor_id, cantidad_comprada, pub.precio_unitario, pub.moneda, total]
        );

        await client.query('COMMIT');

        // Notificar al vendedor
        await notificar({
            tipo: 'market_transaccion',
            mensaje: `Nuevo interesado en tu publicación "${pub.nombre_material}"`,
            usuario_id: pub.vendedor_id,
        });

        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en iniciarTransaccion:', error.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    } finally {
        client.release();
    }
};

const actualizarTransaccion = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    const estadosValidos = ['confirmada', 'cancelada'];

    if (!estadosValidos.includes(estado))
        return res.status(400).json({ success: false, message: 'Estado inválido. Valores permitidos: confirmada, cancelada' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const txResult = await client.query(
            `SELECT mt.*, mp.nombre_material, mp.cantidad AS cantidad_publicada, mp.material_id
       FROM market_transacciones mt
       JOIN market_publicaciones mp ON mp.id = mt.publicacion_id
       WHERE mt.id = $1`, [id]
        );
        if (txResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Transacción no encontrada' });
        }

        const tx = txResult.rows[0];
        const esParteDelChat = tx.comprador_id === req.user.userId || tx.vendedor_id === req.user.userId || req.user.rol_id === 1;

        if (!esParteDelChat) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, message: 'Sin permiso sobre esta transacción' });
        }

        if (tx.estado !== 'pendiente') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Solo se pueden modificar transacciones pendientes' });
        }

        await client.query(
            `UPDATE market_transacciones SET estado = $1 WHERE id = $2`, [estado, id]
        );

        if (estado === 'confirmada') {
            // Actualizar cantidad restante en publicación
            const nuevaCantidad = Number(tx.cantidad_publicada) - Number(tx.cantidad_comprada);
            if (nuevaCantidad <= 0) {
                await client.query(`UPDATE market_publicaciones SET estado = 'vendida', updated_at = NOW() WHERE id = $1`, [tx.publicacion_id]);
            } else {
                await client.query(`UPDATE market_publicaciones SET cantidad = $1, updated_at = NOW() WHERE id = $2`, [nuevaCantidad, tx.publicacion_id]);
            }
        }

        if (estado === 'cancelada' && tx.material_id) {
            // Devolver stock si se cancela
            await client.query(
                `UPDATE materiales SET stock_actual = stock_actual + $1, updated_at = NOW() WHERE id = $2`,
                [tx.cantidad_comprada, tx.material_id]
            );
        }

        await client.query('COMMIT');

        await notificar({
            tipo: 'market_transaccion',
            mensaje: `Transacción #${id} de "${tx.nombre_material}" fue ${estado}`,
            usuario_id: estado === 'confirmada' ? tx.comprador_id : tx.vendedor_id,
        });

        return res.status(200).json({ success: true, message: `Transacción ${estado} correctamente` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en actualizarTransaccion:', error.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    } finally {
        client.release();
    }
};

const getMisTransacciones = async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT mt.*,
             mp.nombre_material, mp.unidad, mp.moneda,
             uc.nombre AS comprador_nombre, uc.email AS comprador_email,
             uv.nombre AS vendedor_nombre, uv.email AS vendedor_email,
             (SELECT COUNT(*) FROM market_mensajes mm
              WHERE mm.transaccion_id = mt.id AND mm.leido = FALSE AND mm.remitente_id != $1) AS mensajes_no_leidos
      FROM market_transacciones mt
      JOIN market_publicaciones mp ON mp.id = mt.publicacion_id
      JOIN usuarios uc ON uc.id = mt.comprador_id
      JOIN usuarios uv ON uv.id = mt.vendedor_id
      WHERE mt.comprador_id = $1 OR mt.vendedor_id = $1
      ORDER BY mt.created_at DESC
    `, [req.user.userId]);

        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error en getMisTransacciones:', error.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};

// ─────────────────────────────────────────────────────────────
// MENSAJES
// ─────────────────────────────────────────────────────────────

const getMensajes = async (req, res) => {
    const { transaccion_id } = req.params;
    try {
        const txResult = await pool.query(
            `SELECT comprador_id, vendedor_id FROM market_transacciones WHERE id = $1`, [transaccion_id]
        );
        if (txResult.rows.length === 0)
            return res.status(404).json({ success: false, message: 'Transacción no encontrada' });

        const tx = txResult.rows[0];
        const esParteDelChat =
            Number(tx.comprador_id) === Number(req.user.userId) ||
            Number(tx.vendedor_id) === Number(req.user.userId) ||
            req.user.rol_id === 1;
        if (!esParteDelChat)
            return res.status(403).json({ success: false, message: 'Sin acceso a este chat' });

        const result = await pool.query(`
      SELECT mm.*, u.nombre AS remitente_nombre
      FROM market_mensajes mm
      JOIN usuarios u ON u.id = mm.remitente_id
      WHERE mm.transaccion_id = $1
      ORDER BY mm.created_at ASC
    `, [transaccion_id]);

        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error en getMensajes:', error.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};

const enviarMensaje = async (req, res) => {
    const { transaccion_id } = req.params;
    const { mensaje } = req.body;

    if (!mensaje?.trim())
        return res.status(400).json({ success: false, message: 'El mensaje no puede estar vacío' });

    try {
        const txResult = await pool.query(
            `SELECT comprador_id, vendedor_id FROM market_transacciones WHERE id = $1`, [transaccion_id]
        );
        if (txResult.rows.length === 0)
            return res.status(404).json({ success: false, message: 'Transacción no encontrada' });

        const tx = txResult.rows[0];
        const esParteDelChat =
            Number(tx.comprador_id) === Number(req.user.userId) ||
            Number(tx.vendedor_id) === Number(req.user.userId) ||
            req.user.rol_id === 1;
        if (!esParteDelChat)
            return res.status(403).json({ success: false, message: 'Sin acceso a este chat' });

        const result = await pool.query(
            `INSERT INTO market_mensajes (transaccion_id, remitente_id, mensaje)
       VALUES ($1,$2,$3) RETURNING *`,
            [transaccion_id, req.user.userId, mensaje.trim()]
        );

        // Notificar al destinatario via SSE
        const destinatarioId = Number(req.user.userId) === Number(tx.vendedor_id)
            ? tx.comprador_id
            : tx.vendedor_id;
        await notificar({
            tipo: 'market_mensaje',
            mensaje: `Nuevo mensaje en tu transacción`,
            usuario_id: destinatarioId,
        });

        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error en enviarMensaje:', error.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};

const marcarLeidos = async (req, res) => {
    const { transaccion_id } = req.params;
    try {
        await pool.query(
            `UPDATE market_mensajes SET leido = TRUE
       WHERE transaccion_id = $1 AND remitente_id != $2`,
            [transaccion_id, req.user.userId]
        );
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error en marcarLeidos:', error.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};

const getMensajesNoLeidos = async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT mm.transaccion_id, COUNT(*) AS cantidad
      FROM market_mensajes mm
      JOIN market_transacciones mt ON mt.id = mm.transaccion_id
      WHERE (mt.comprador_id = $1 OR mt.vendedor_id = $1)
        AND mm.remitente_id != $1
        AND mm.leido = FALSE
      GROUP BY mm.transaccion_id
    `, [req.user.userId]);

        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error en getMensajesNoLeidos:', error.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};

module.exports = {
    publicarMaterial,
    getPublicaciones,
    getMisPublicaciones,
    cancelarPublicacion,
    iniciarTransaccion,
    actualizarTransaccion,
    getMisTransacciones,
    getMensajes,
    enviarMensaje,
    marcarLeidos,
    getMensajesNoLeidos,
};