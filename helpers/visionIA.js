// helpers/visionIA.js
const pool = require('../connection/db.js');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function analyzeAvanceImage(avanceId, imagenUrl, laborId) {
  try {
    // Obtener descripción de la labor
    const laborResult = await pool.query(
      `SELECT nombre, descripcion FROM labores WHERE id = $1`,
      [laborId]
    );
    const labor = laborResult.rows[0];

    // Obtener imagen anterior aprobada (si existe)
    const anteriorResult = await pool.query(
      `SELECT id, imagen_url FROM avances_obra
       WHERE labor_id = $1 AND imagen_url IS NOT NULL AND estado = 'aprobado' AND id < $2
       ORDER BY fecha_registro DESC LIMIT 1`,
      [laborId, avanceId]
    );
    const imagenAnterior = anteriorResult.rows[0] ?? null;

    // Construir prompt
    const prompt = imagenAnterior
      ? `Sos un inspector de obras de construcción experto. Analizá el avance de esta labor.

LABOR: "${labor.nombre}"
DESCRIPCIÓN DE LA LABOR: "${labor.descripcion}"

Se te proporciona:
1. La imagen actual del avance (primera imagen)
2. La imagen anterior aprobada de referencia (segunda imagen)

Analizá ambas imágenes y determiná:
- ¿La imagen actual muestra progreso real respecto a la anterior?
- ¿El trabajo visible es consistente con la descripción de la labor?
- ¿Hay señales de que el avance es genuino?

Devolvé un análisis conciso en 2-3 oraciones. Terminá con una recomendación clara: "RECOMENDACIÓN: Aprobar" o "RECOMENDACIÓN: Rechazar" o "RECOMENDACIÓN: Revisar manualmente".`
      : `Sos un inspector de obras de construcción experto. Analizá el avance de esta labor.

LABOR: "${labor.nombre}"
DESCRIPCIÓN DE LA LABOR: "${labor.descripcion}"

Esta es la primera imagen registrada para esta labor.

Analizá la imagen y determiná:
- ¿La imagen muestra trabajo relacionado con la labor descrita?
- ¿El trabajo visible es consistente con la descripción?
- ¿Hay señales de que el avance es genuino?

Devolvé un análisis conciso en 2-3 oraciones. Terminá con una recomendación clara: "RECOMENDACIÓN: Aprobar" o "RECOMENDACIÓN: Rechazar" o "RECOMENDACIÓN: Revisar manualmente".`;

    // Construir content para Claude
    const content = imagenAnterior
      ? [
          { type: 'image', source: { type: 'url', url: imagenUrl } },
          { type: 'image', source: { type: 'url', url: imagenAnterior.imagen_url } },
          { type: 'text', text: prompt },
        ]
      : [
          { type: 'image', source: { type: 'url', url: imagenUrl } },
          { type: 'text', text: prompt },
        ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5',
        max_tokens: 400,
        messages:   [{ role: 'user', content }],
      }),
    });

    const data = await response.json();
    console.log('🔍 Respuesta Anthropic Vision:', JSON.stringify(data, null, 2)); // ← agregar
    console.log('API KEY presente:', !!process.env.ANTHROPIC_API_KEY);
    console.log('API KEY primeros chars:', process.env.ANTHROPIC_API_KEY?.slice(0, 15));
    const resultado_vision = data.content?.[0]?.text ?? 'No se pudo analizar la imagen.';

    // Determinar cambio_detectado desde la recomendación
    const cambio_detectado = resultado_vision.includes('RECOMENDACIÓN: Aprobar')
      ? true
      : resultado_vision.includes('RECOMENDACIÓN: Rechazar')
      ? false
      : null;

    // Guardar resultado en DB
    await pool.query(
      `UPDATE avances_obra
       SET resultado_vision        = $1,
           cambio_detectado        = $2,
           imagen_comparada_con_id = $3,
           updated_at              = NOW()
       WHERE id = $4`,
      [resultado_vision, cambio_detectado, imagenAnterior?.id ?? null, avanceId]
    );

    console.log(`✅ Visión IA completada para avance #${avanceId}`);
  } catch (error) {
    console.error(`❌ Error en análisis de visión IA para avance #${avanceId}:`, error.message);
    // No lanzar — es background, no debe afectar al usuario
  }
}

module.exports = { analyzeAvanceImage };