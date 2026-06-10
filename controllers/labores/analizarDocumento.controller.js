const Anthropic = require('@anthropic-ai/sdk');
const { ROL_ADMIN_PRIVADO } = require('../../middlewares/filtrarPorPropietario.js');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_LABORES_API_KEY });

const SIMBOLOS_UNIDAD = ['m²', 'm³', 'ml', 'kg', 'tn', 'un', 'gl', 'hr', 'lt', 'm'];

const SYSTEM_PROMPT = `Sos un asistente especializado en análisis de documentos de construcción argentina.
Tu tarea es extraer labores y presupuestos de documentos como planillas de cómputo, presupuestos de obra, cotizaciones y similares.

Devolvé ÚNICAMENTE un JSON válido con esta estructura, sin texto adicional, sin markdown, sin explicaciones:
{
  "labores": [
    {
      "descripcion": "string — descripción de la labor",
      "unidad_simbolo": "m²|m³|ml|kg|tn|un|gl|hr|lt|m|null — unidad de medida detectada",
      "cantidad": number|null,
      "presupuesto": {
        "cotizante_nombre": "string|null — nombre del cotizante si aparece en el documento",
        "precio_unitario": number|null,
        "precio_total": number|null,
        "plazo_dias": number|null,
        "notas": "string|null"
      }|null
    }
  ],
  "cotizante_global": "string|null — si hay un cotizante único para todo el documento"
}

Reglas:
- Si el documento tiene un solo cotizante para todas las labores, ponerlo en cotizante_global y null en cada presupuesto.cotizante_nombre
- Si precio_unitario y cantidad están presentes, precio_total = precio_unitario * cantidad
- Si solo hay precio_total sin precio_unitario, calculá precio_unitario = precio_total / cantidad si hay cantidad
- unidad_simbolo debe ser exactamente uno de: ${SIMBOLOS_UNIDAD.join(', ')} o null
- Ignorar ítems que no sean labores (ej: materiales puros, gastos administrativos)
- Si no encontrás información, devolvé { "labores": [] }`;

// ── POST /labor-presupuestos/analizar-documento ──────────────
const analizarDocumento = async (req, res) => {

    
  try {
    const { imagen_base64, media_type, texto_libre } = req.body;

    if (!imagen_base64 && !texto_libre)
      return res.status(400).json({ success: false, message: 'Debe enviar imagen_base64 o texto_libre' });

    let userContent;

    if (imagen_base64) {
      // PDF o imagen
      const esPDF = media_type === 'application/pdf';
      userContent = [
        esPDF
          ? { type: 'document', source: { type: 'base64', media_type, data: imagen_base64 } }
          : { type: 'image', source: { type: 'base64', media_type: media_type || 'image/jpeg', data: imagen_base64 } },
        { type: 'text', text: 'Analizá este documento y extraé todas las labores y presupuestos que encuentres.' },
      ];
    } else {
      // Texto libre
      userContent = [{ type: 'text', text: `Analizá este texto y extraé labores y presupuestos:\n\n${texto_libre}` }];
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const rawText = response.content.find(b => b.type === 'text')?.text ?? '{}';
    console.log('RESPUESTA IA RAW:', rawText); // ← agregar esto antes del JSON.parse
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return res.status(422).json({ success: false, message: 'La IA no pudo estructurar el documento. Intentá con mejor calidad de imagen.' });
    }

    // Enriquecer con unidad_id basado en simbolo
    const { rows: unidades } = await require('../../connection/db.js').query(
      `SELECT id, simbolo FROM unidades_medida`
    );
    const unidadMap = Object.fromEntries(unidades.map(u => [u.simbolo, u.id]));

    const laboresEnriquecidas = (parsed.labores ?? []).map((labor, idx) => ({
      _key: idx,
      descripcion: labor.descripcion ?? '',
      unidad_simbolo: labor.unidad_simbolo ?? null,
      unidad_id: labor.unidad_simbolo ? (unidadMap[labor.unidad_simbolo] ?? null) : null,
      cantidad: labor.cantidad ?? null,
      seleccionada: true,
      presupuesto: labor.presupuesto
        ? {
            cotizante_nombre: labor.presupuesto.cotizante_nombre ?? parsed.cotizante_global ?? null,
            precio_unitario: labor.presupuesto.precio_unitario ?? null,
            precio_total: labor.presupuesto.precio_total ?? null,
            plazo_dias: labor.presupuesto.plazo_dias ?? null,
            notas: labor.presupuesto.notas ?? null,
          }
        : null,
    }));

    return res.status(200).json({
      success: true,
      data: {
        labores: laboresEnriquecidas,
        cotizante_global: parsed.cotizante_global ?? null,
      },
    });
  } catch (error) {
    console.error('Error al analizar documento:', error);
    return res.status(500).json({ success: false, message: 'Error al procesar el documento con IA' });
  }
};

module.exports = { analizarDocumento };