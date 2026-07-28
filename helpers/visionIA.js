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
      ? `Sos un asistente de gestión de obras de construcción. Tu rol es ayudar al administrador a hacer un seguimiento visual de los avances, no actuar como auditor estricto.

LABOR: "${labor.nombre}"
DESCRIPCIÓN: "${labor.descripcion}"

Se te proporcionan dos imágenes:
1. Imagen actual del avance (primera imagen)
2. Imagen anterior aprobada como referencia (segunda imagen)

CRITERIO DE EVALUACIÓN — Aplicá criterio amplio y generoso:
- Las fotos de obra son tomadas desde el celular en condiciones reales: pueden tener escombros, materiales apilados, herramientas, suciedad. Eso es NORMAL y no es motivo de rechazo.
- Si la imagen muestra cualquier elemento relacionado con construcción (hormigón, ladrillos, revoques, excavaciones, instalaciones, estructura, materiales, herramientas, etc.) es evidencia válida de trabajo en curso.
- Si la imagen actual muestra el mismo sector que la anterior aunque con pequeñas diferencias, consideralo progreso válido.
- Solo recomendá RECHAZAR si la imagen claramente no tiene ninguna relación con obra (ej: foto de una persona sin contexto de obra, un auto, un paisaje sin construcción).
- En caso de duda, siempre preferí APROBAR — el administrador puede verificar presencialmente si lo necesita.
- No exijas que la imagen sea idéntica al tipo de trabajo descrito — en obra los trabajadores fotografían lo que tienen a mano en el momento.

Escribí un análisis breve de 1-2 oraciones describiendo qué se ve en la imagen actual y si hay diferencias visibles respecto a la anterior. Luego indicá la recomendación.

Formato de respuesta:
[Descripción breve de lo que se ve]
RECOMENDACIÓN: Aprobar`
      : `Sos un asistente de gestión de obras de construcción. Tu rol es ayudar al administrador a hacer un seguimiento visual de los avances.

LABOR: "${labor.nombre}"
DESCRIPCIÓN: "${labor.descripcion}"

Esta es la primera imagen registrada para esta labor.

CRITERIO DE EVALUACIÓN — Aplicá criterio amplio y generoso:
- Las fotos de obra son tomadas desde el celular en condiciones reales: pueden tener escombros, materiales apilados, herramientas, suciedad. Eso es NORMAL.
- Si la imagen muestra cualquier elemento relacionado con construcción (hormigón, ladrillos, revoques, excavaciones, instalaciones, estructura, materiales de obra, herramientas, etc.) es evidencia válida de trabajo en curso.
- Solo recomendá RECHAZAR si la imagen claramente no tiene ninguna relación con obra (ej: foto de una persona sin contexto de obra, un auto, un paisaje sin construcción).
- En caso de duda, siempre preferí APROBAR — el administrador puede verificar presencialmente si lo necesita.

Escribí un análisis breve de 1-2 oraciones describiendo qué se ve. Luego indicá la recomendación.

Formato de respuesta:
[Descripción breve de lo que se ve]
RECOMENDACIÓN: Aprobar`;

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
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5',
        max_tokens: 300,
        messages:   [{ role: 'user', content }],
      }),
    });

    const data = await response.json();
    const resultado_vision = data.content?.[0]?.text ?? 'No se pudo analizar la imagen.';

    // Determinar cambio_detectado desde la recomendación
    const cambio_detectado = resultado_vision.includes('RECOMENDACIÓN: Rechazar')
      ? false
      : true; // default a true (aprobar) — solo false si explícitamente rechaza

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
  }
}

module.exports = { analyzeAvanceImage };