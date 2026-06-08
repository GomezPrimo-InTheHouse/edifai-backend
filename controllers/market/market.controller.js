const pool = require('../../connection/db.js');
const { notificar } = require('../../helpers/notificar.js');
const getSupabase = require('../../connection/supabase');
const { analizarComprobante } = require('../../helpers/analizarComprobante.js');
const multer = require('multer');

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

        if (material_id) {
            const materialResult = await client.query(
                `SELECT id, stock_actual, nombre FROM materiales WHERE id = $1`, [material_id]
            );
            if (materialResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Material no encontrado' });
            }

            const material = materialResult.rows[0];

            // ← ya NO descontamos stock al publicar
            if (Number(cantidad) > Number(material.stock_actual)) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: `Stock insuficiente. Stock actual: ${material.stock_actual} ${unidad}`,
                });
            }

            const publicacionActiva = await client.query(
                `SELECT id FROM market_publicaciones WHERE material_id = $1 AND vendedor_id = $2 AND estado = 'activa'`,
                [material_id, vendedor_id]
            );
            if (publicacionActiva.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ success: false, message: 'Este material ya tiene una publicación activa en el Market' });
            }
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

        if (Number(pub.vendedor_id) !== Number(req.user.userId) && req.user.rol_id !== 1) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, message: 'Sin permiso para cancelar esta publicación' });
        }

        if (pub.estado !== 'activa') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Solo se pueden cancelar publicaciones activas' });
        }

        // ← ya NO devolvemos stock al cancelar publicación (nunca se descontó)

        await client.query(
            `UPDATE market_publicaciones SET estado = 'cancelada', updated_at = NOW() WHERE id = $1`, [id]
        );

        await client.query('COMMIT');
        return res.status(200).json({ success: true, message: 'Publicación cancelada correctamente' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en cancelarPublicacion:', error.message);
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

        // Después del INSERT de la transacción y antes del COMMIT
        const compradorResult = await client.query(
            `SELECT nombre FROM usuarios WHERE id = $1`, [comprador_id]
        );
        const compradorNombre = compradorResult.rows[0]?.nombre ?? 'Un administrador';

        await client.query(
            `INSERT INTO market_mensajes (transaccion_id, remitente_id, mensaje)
   VALUES ($1, $2, $3)`,
            [
                result.rows[0].id,
                comprador_id,
                `${compradorNombre} está interesado en comprar ${cantidad_comprada} ${pub.unidad} de "${pub.nombre_material}".`
            ]
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
        return res.status(400).json({ success: false, message: 'Estado inválido.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const txResult = await client.query(`
      SELECT mt.*, 
             mp.nombre_material, mp.cantidad AS cantidad_publicada, 
             mp.material_id, mp.estado AS pub_estado
      FROM market_transacciones mt
      JOIN market_publicaciones mp ON mp.id = mt.publicacion_id
      WHERE mt.id = $1
    `, [id]);

        if (txResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Transacción no encontrada' });
        }

        const tx = txResult.rows[0];

        const esComprador = Number(tx.comprador_id) === Number(req.user.userId);
        const esVendedor = Number(tx.vendedor_id) === Number(req.user.userId);
        const esAdmin = req.user.rol_id === 1;

        if (!esComprador && !esVendedor && !esAdmin) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, message: 'Sin permiso sobre esta transacción' });
        }

        if (tx.estado !== 'pendiente') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Solo se pueden modificar transacciones pendientes' });
        }

        if (estado === 'confirmada' && !esVendedor && !esAdmin) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, message: 'Solo el vendedor puede confirmar la venta' });
        }

        if (estado === 'confirmada') {
            // Verificar y descontar stock del material
            if (tx.material_id) {
                const materialCheck = await client.query(
                    `SELECT stock_actual FROM materiales WHERE id = $1`, [tx.material_id]
                );
                const stockActual = Number(materialCheck.rows[0]?.stock_actual ?? 0);

                if (stockActual < Number(tx.cantidad_comprada)) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        success: false,
                        message: `Stock insuficiente para confirmar. Stock actual: ${stockActual}`,
                    });
                }

                await client.query(
                    `UPDATE materiales SET stock_actual = stock_actual - $1, updated_at = NOW() WHERE id = $2`,
                    [tx.cantidad_comprada, tx.material_id]
                );
            }

            // Leer cantidad ACTUAL de la publicación (no la del JOIN que puede estar desactualizada)
            const pubResult = await client.query(
                `SELECT cantidad FROM market_publicaciones WHERE id = $1`, [tx.publicacion_id]
            );
            const cantidadActualPub = Number(pubResult.rows[0]?.cantidad ?? 0);
            const cantidadRestante = cantidadActualPub - Number(tx.cantidad_comprada);

            if (cantidadRestante <= 0) {
                // Marcar publicación como vendida con datos del comprador final
                await client.query(
                    `UPDATE market_publicaciones 
     SET cantidad = 0, estado = 'vendida', 
         comprador_final_id = $1, fecha_venta = NOW(),
         updated_at = NOW() 
     WHERE id = $2`,
                    [tx.comprador_id, tx.publicacion_id]
                );

                // Cancelar otras transacciones pendientes
                const otrasTransacciones = await client.query(
                    `SELECT id, comprador_id FROM market_transacciones
     WHERE publicacion_id = $1 AND estado = 'pendiente' AND id != $2`,
                    [tx.publicacion_id, id]
                );
                for (const otraTx of otrasTransacciones.rows) {
                    await client.query(
                        `UPDATE market_transacciones SET estado = 'cancelada' WHERE id = $1`, [otraTx.id]
                    );
                    await notificar({
                        tipo: 'market_stock_agotado',
                        mensaje: `Lo sentimos, el stock de "${tx.nombre_material}" ya fue vendido a otro usuario.`,
                        usuario_id: Number(otraTx.comprador_id),
                    });
                }
            } else {
                await client.query(
                    `UPDATE market_publicaciones SET cantidad = $1, updated_at = NOW() WHERE id = $2`,
                    [cantidadRestante, tx.publicacion_id]
                );
            }

            // Confirmar y archivar esta transacción
            await client.query(
                `UPDATE market_transacciones SET estado = 'confirmada', archivada = TRUE WHERE id = $1`, [id]
            );

        } else {
            // Cancelada — sin tocar stock ni publicación
            await client.query(
                `UPDATE market_transacciones SET estado = 'cancelada' WHERE id = $1`, [id]
            );
        }

        await client.query('COMMIT');

        await notificar({
            tipo: 'market_transaccion',
            mensaje: `Transacción #${id} de "${tx.nombre_material}" fue ${estado}`,
            usuario_id: estado === 'confirmada' ? Number(tx.comprador_id) : Number(tx.vendedor_id),
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

const getInbox = async (req, res) => {
    const { archivadas } = req.query; // ?archivadas=true para ver historial
    const soloArchivadas = archivadas === 'true';

    try {
        const result = await pool.query(`
      SELECT 
        mt.*,
        mp.nombre_material, mp.unidad, mp.moneda, mp.estado AS publicacion_estado,
        uc.nombre AS comprador_nombre, uc.email AS comprador_email,
        uv.nombre AS vendedor_nombre, uv.email AS vendedor_email,
        (
          SELECT COUNT(*) FROM market_mensajes mm
          WHERE mm.transaccion_id = mt.id
            AND mm.leido = FALSE
            AND mm.remitente_id != $1
        ) AS mensajes_no_leidos,
        (
          SELECT mm2.mensaje FROM market_mensajes mm2
          WHERE mm2.transaccion_id = mt.id
          ORDER BY mm2.created_at DESC LIMIT 1
        ) AS ultimo_mensaje,
        (
          SELECT mm3.created_at FROM market_mensajes mm3
          WHERE mm3.transaccion_id = mt.id
          ORDER BY mm3.created_at DESC LIMIT 1
        ) AS ultimo_mensaje_at
      FROM market_transacciones mt
      JOIN market_publicaciones mp ON mp.id = mt.publicacion_id
      JOIN usuarios uc ON uc.id = mt.comprador_id
      JOIN usuarios uv ON uv.id = mt.vendedor_id
      WHERE (mt.comprador_id = $1 OR mt.vendedor_id = $1)
        AND mt.archivada = $2
      ORDER BY ultimo_mensaje_at DESC NULLS LAST, mt.created_at DESC
    `, [req.user.userId, soloArchivadas]);

        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error en getInbox:', error.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};



const subirComprobante = async (req, res) => {
    const { transaccion_id } = req.params;
    const client = await pool.connect();

    try {
        if (!req.file)
            return res.status(400).json({ success: false, message: 'No se recibió ningún archivo' });

        // Verificar que es comprador de esta transacción
        const txResult = await pool.query(
            `SELECT mt.*, mp.nombre_material, mp.material_id
       FROM market_transacciones mt
       JOIN market_publicaciones mp ON mp.id = mt.publicacion_id
       WHERE mt.id = $1`,
            [transaccion_id]
        );

        if (txResult.rows.length === 0)
            return res.status(404).json({ success: false, message: 'Transacción no encontrada' });

        const tx = txResult.rows[0];

        if (Number(tx.comprador_id) !== Number(req.user.userId))
            return res.status(403).json({ success: false, message: 'Solo el comprador puede subir el comprobante' });

        if (tx.estado !== 'pendiente')
            return res.status(400).json({ success: false, message: 'La transacción no está pendiente' });

        // Subir imagen a Supabase Storage
        const supabase = getSupabase();
        const ext = req.file.originalname.split('.').pop();
        const fileName = `comprobante-${transaccion_id}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('market-comprobantes')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false,
            });

        if (uploadError) {
            console.error('Error subiendo comprobante:', uploadError);
            return res.status(500).json({ success: false, message: 'Error al subir el comprobante' });
        }

        // Analizar con IA
        const imageBase64 = req.file.buffer.toString('base64');
        const mediaType = req.file.mimetype;
        const analisis = await analizarComprobante(
            imageBase64,
            mediaType,
            Number(tx.total),
            tx.moneda
        );

        // Generar URL firmada para el comprobante (válida 24hs)
        const { data: signedData } = await supabase.storage
            .from('market-comprobantes')
            .createSignedUrl(fileName, 86400);

        const comprobanteUrl = signedData?.signedUrl ?? null;

        await client.query('BEGIN');

        // Insertar mensaje con el comprobante en el chat
        const compradorResult = await pool.query(
            `SELECT nombre FROM usuarios WHERE id = $1`, [req.user.userId]
        );
        const compradorNombre = compradorResult.rows[0]?.nombre ?? 'El comprador';

        const mensajeComprobante = `📎 ${compradorNombre} adjuntó un comprobante de pago.\n🔗 ${comprobanteUrl}`;
        await client.query(
            `INSERT INTO market_mensajes (transaccion_id, remitente_id, mensaje)
       VALUES ($1, $2, $3)`,
            [transaccion_id, req.user.userId, mensajeComprobante]
        );

        // Si la IA valida el comprobante con alta confianza y el monto coincide → confirmar automáticamente
        const validado = analisis.es_comprobante && analisis.monto_coincide && analisis.confianza !== 'baja';

        if (validado) {
            // Descontar stock
            if (tx.material_id) {
                await client.query(
                    `UPDATE materiales SET stock_actual = stock_actual - $1, updated_at = NOW() WHERE id = $2`,
                    [tx.cantidad_comprada, tx.material_id]
                );
            }

            // Actualizar cantidad publicación
            const pubResult = await client.query(
                `SELECT cantidad FROM market_publicaciones WHERE id = $1`, [tx.publicacion_id]
            );
            const cantidadRestante = Number(pubResult.rows[0]?.cantidad ?? 0) - Number(tx.cantidad_comprada);

            if (cantidadRestante <= 0) {
                // Marcar publicación como vendida con datos del comprador final
                await client.query(
                    `UPDATE market_publicaciones 
     SET cantidad = 0, estado = 'vendida', 
         comprador_final_id = $1, fecha_venta = NOW(),
         updated_at = NOW() 
     WHERE id = $2`,
                    [tx.comprador_id, tx.publicacion_id]
                );

                // Cancelar otras transacciones pendientes
                const otrasTransacciones = await client.query(
                    `SELECT id, comprador_id FROM market_transacciones
     WHERE publicacion_id = $1 AND estado = 'pendiente' AND id != $2`,
                    [tx.publicacion_id, id]
                );
                for (const otraTx of otrasTransacciones.rows) {
                    await client.query(
                        `UPDATE market_transacciones SET estado = 'cancelada' WHERE id = $1`, [otraTx.id]
                    );
                    await notificar({
                        tipo: 'market_stock_agotado',
                        mensaje: `Lo sentimos, el stock de "${tx.nombre_material}" ya fue vendido a otro usuario.`,
                        usuario_id: Number(otraTx.comprador_id),
                    });
                }
            } else {
                await client.query(
                    `UPDATE market_publicaciones SET cantidad = $1, updated_at = NOW() WHERE id = $2`,
                    [cantidadRestante, tx.publicacion_id]
                );
            }

            // Confirmar y archivar transacción
            await client.query(
                `UPDATE market_transacciones SET estado = 'confirmada', archivada = TRUE WHERE id = $1`,
                [transaccion_id]
            );

            // Mensaje automático de confirmación en el chat
            await client.query(
                `INSERT INTO market_mensajes (transaccion_id, remitente_id, mensaje)
         VALUES ($1, $2, $3)`,
                [transaccion_id, req.user.userId,
                    `✅ Comprobante validado automáticamente por IA. La transacción fue confirmada. ¡Gracias!`]
            );

            await notificar({
                tipo: 'market_transaccion',
                mensaje: `Comprobante validado: transacción de "${tx.nombre_material}" confirmada automáticamente.`,
                usuario_id: Number(tx.vendedor_id),
            });

        } else {
            // Comprobante inválido → mensaje en el chat con el motivo
            await client.query(
                `INSERT INTO market_mensajes (transaccion_id, remitente_id, mensaje)
         VALUES ($1, $2, $3)`,
                [transaccion_id, req.user.userId,
                    `⚠️ El comprobante no pudo ser validado automáticamente. Motivo: ${analisis.motivo}. El vendedor deberá confirmarlo manualmente.`]
            );
        }

        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            validado,
            analisis,
            comprobanteUrl,
            message: validado
                ? 'Comprobante validado y transacción confirmada automáticamente.'
                : 'Comprobante recibido pero no validado. El vendedor debe confirmar manualmente.',
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en subirComprobante:', error.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    } finally {
        client.release();
    }
};


const getMisCompras = async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT 
        mt.*,
        mp.nombre_material, mp.unidad, mp.moneda,
        mp.precio_unitario, mp.descripcion, mp.material_id,
        uv.nombre AS vendedor_nombre, uv.email AS vendedor_email
      FROM market_transacciones mt
      JOIN market_publicaciones mp ON mp.id = mt.publicacion_id
      JOIN usuarios uv ON uv.id = mt.vendedor_id
      WHERE mt.comprador_id = $1
        AND mt.estado = 'confirmada'
      ORDER BY mt.created_at DESC
    `, [req.user.userId]);

        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error en getMisCompras:', error.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};

const agregarCompraAlInventario = async (req, res) => {
  const { transaccion_id } = req.params;
  const forzar = req.query.forzar === 'true';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const txResult = await pool.query(`
      SELECT mt.*, mp.nombre_material, mp.descripcion, mp.unidad, 
             mp.precio_unitario, mp.material_id
      FROM market_transacciones mt
      JOIN market_publicaciones mp ON mp.id = mt.publicacion_id
      WHERE mt.id = $1 AND mt.comprador_id = $2 AND mt.estado = 'confirmada'
    `, [transaccion_id, req.user.userId]);

    if (txResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Transacción no encontrada o sin permiso' });
    }

    const tx = txResult.rows[0];

    // Verificar si ya fue agregado al inventario
    const yaAgregado = await client.query(
      `SELECT id FROM materiales 
       WHERE propietario_id = $1 
         AND nombre = $2 
         AND origen = 'market'
         AND stock_actual = $3`,
      [req.user.userId, tx.nombre_material, tx.cantidad_comprada]
    );

    if (yaAgregado.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Este material ya fue agregado a tu inventario' });
    }

    // Buscar materiales similares (solo si no se fuerza la creación)
    if (!forzar) {
      const similarResult = await client.query(
        `SELECT id, nombre, stock_actual, unidad, precio_unitario
         FROM materiales 
         WHERE propietario_id = $1 
           AND origen != 'market'
           AND LOWER(nombre) ILIKE $2
           AND estado_id = 23
         LIMIT 3`,
        [req.user.userId, `%${tx.nombre_material.toLowerCase().trim()}%`]
      );

      if (similarResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(200).json({
          success: false,
          requiere_confirmacion: true,
          similares: similarResult.rows,
          message: 'Se encontraron materiales similares en tu inventario.',
        });
      }
    }

    // Obtener estado activo
    const estadoResult = await client.query(
      `SELECT id FROM estados WHERE nombre = 'Activo' AND ambito = 'material' LIMIT 1`
    );
    const estado_id = estadoResult.rows[0]?.id ?? 23;

    // Insertar en materiales con origen = 'market'
    const result = await client.query(
      `INSERT INTO materiales 
        (nombre, descripcion, unidad, stock_actual, precio_unitario, estado_id, propietario_id, origen)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'market')
       RETURNING *`,
      [
        tx.nombre_material,
        tx.descripcion ?? null,
        tx.unidad,
        tx.cantidad_comprada,
        tx.precio_unitario,
        estado_id,
        req.user.userId,
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Material agregado a tu inventario correctamente.',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en agregarCompraAlInventario:', error.message);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};


const agregarStockMaterialExistente = async (req, res) => {
  const { transaccion_id, material_id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const txResult = await pool.query(`
      SELECT mt.cantidad_comprada, mt.comprador_id, mp.nombre_material
      FROM market_transacciones mt
      JOIN market_publicaciones mp ON mp.id = mt.publicacion_id
      WHERE mt.id = $1 AND mt.comprador_id = $2 AND mt.estado = 'confirmada'
    `, [transaccion_id, req.user.userId]);

    if (txResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Transacción no encontrada' });
    }

    const tx = txResult.rows[0];

    await client.query(
      `UPDATE materiales SET stock_actual = stock_actual + $1, updated_at = NOW() WHERE id = $2 AND propietario_id = $3`,
      [tx.cantidad_comprada, material_id, req.user.userId]
    );

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Stock actualizado correctamente.' });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
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
    getInbox,
    subirComprobante,
    getMisCompras,
    agregarCompraAlInventario,
    agregarStockMaterialExistente
};