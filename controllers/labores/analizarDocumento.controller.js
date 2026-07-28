// const Anthropic = require('@anthropic-ai/sdk');
// const { ROL_ADMIN_PRIVADO } = require('../../middlewares/filtrarPorPropietario.js');

// const client = new Anthropic({ apiKey: process.env.ANTHROPIC_LABORES_API_KEY });

// const SIMBOLOS_UNIDAD = ['m²', 'm³', 'ml', 'kg', 'tn', 'un', 'gl', 'hr', 'lt', 'm'];

// const SYSTEM_PROMPT = `Sos un asistente especializado en análisis de documentos de construcción argentina.
// Tu tarea es extraer labores y presupuestos de documentos como planillas de cómputo, presupuestos de obra, cotizaciones y similares.

// Devolvé ÚNICAMENTE un JSON válido con esta estructura, sin texto adicional, sin markdown, sin explicaciones:
// {
//   "labores": [
//     {
//       "nombre_corto": "string — nombre breve de la labor, máximo 6 palabras, que identifique el trabajo (ej: 'Excavación viga fundación', 'Armado hierro encadenado', 'Capa aisladora ladrillo')",
//       "descripcion_completa": "string — descripción técnica completa tal como aparece en el documento, con todos los detalles",
//       "unidad_simbolo": "m²|m³|ml|kg|tn|un|gl|hr|lt|m|null",
//       "cantidad": number|null,
//       "presupuesto": {
//         "cotizante_nombre": "string|null",
//         "precio_unitario": number|null,
//         "precio_total": number|null,
//         "plazo_dias": number|null,
//         "notas": "string|null — información adicional relevante del presupuesto, si la hay"
//       }|null
//     }
//   ],
//   "cotizante_global": "string|null — nombre del contratista/empresa si es único para todo el documento"
// }

// Reglas para nombre_corto:
// - Máximo 6 palabras, idealmente 3-4
// - Debe identificar claramente el tipo de trabajo
// - No incluir cantidades ni precios
// - Ejemplos correctos: "Excavación viga fundación", "Armado hierro encadenado", "Impermeabilización mampostería", "Parrilla base columnas"

// Reglas generales:
// - Si el documento tiene un solo cotizante, ponerlo en cotizante_global y null en cada presupuesto.cotizante_nombre
// - Si precio_unitario y cantidad están presentes, precio_total = precio_unitario * cantidad
// - unidad_simbolo debe ser exactamente uno de: ${SIMBOLOS_UNIDAD.join(', ')} o null
// - Ignorar ítems que no sean labores (materiales puros, gastos administrativos)
// - Si no encontrás información, devolvé { "labores": [] }`;

// // ── POST /labor-presupuestos/analizar-documento ──────────────
// const analizarDocumento = async (req, res) => {


//     try {
//         const { imagen_base64, media_type, texto_libre } = req.body;

//         if (!imagen_base64 && !texto_libre)
//             return res.status(400).json({ success: false, message: 'Debe enviar imagen_base64 o texto_libre' });

//         let userContent;

//         if (imagen_base64) {
//             // PDF o imagen
//             const esPDF = media_type === 'application/pdf';
//             userContent = [
//                 esPDF
//                     ? { type: 'document', source: { type: 'base64', media_type, data: imagen_base64 } }
//                     : { type: 'image', source: { type: 'base64', media_type: media_type || 'image/jpeg', data: imagen_base64 } },
//                 { type: 'text', text: 'Analizá este documento y extraé todas las labores y presupuestos que encuentres.' },
//             ];
//         } else {
//             // Texto libre
//             userContent = [{ type: 'text', text: `Analizá este texto y extraé labores y presupuestos:\n\n${texto_libre}` }];
//         }

//         const response = await client.messages.create({
//             model: 'claude-haiku-4-5-20251001',
//             max_tokens: 4096,
//             system: SYSTEM_PROMPT,
//             messages: [{ role: 'user', content: userContent }],
//         });

//         const rawText = response.content.find(b => b.type === 'text')?.text ?? '{}';
//         console.log('RESPUESTA IA RAW:', rawText); // ← agregar esto antes del JSON.parse
//         const cleanText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

//         let parsed;
//         try {
//             parsed = JSON.parse(cleanText);
//         } catch {
//             return res.status(422).json({ success: false, message: 'La IA no pudo estructurar el documento. Intentá con mejor calidad de imagen.' });
//         }

//         // Enriquecer con unidad_id basado en simbolo
//         const { rows: unidades } = await require('../../connection/db.js').query(
//             `SELECT id, simbolo FROM unidades_medida`
//         );
//         const unidadMap = Object.fromEntries(unidades.map(u => [u.simbolo, u.id]));

//         const laboresEnriquecidas = (parsed.labores ?? []).map((labor, idx) => ({
//             _key: idx,
//             descripcion: labor.nombre_corto ?? labor.descripcion_completa ?? '',
//             descripcion_completa: labor.descripcion_completa ?? null,
//             unidad_simbolo: labor.unidad_simbolo ?? null,
//             unidad_id: labor.unidad_simbolo ? (unidadMap[labor.unidad_simbolo] ?? null) : null,
//             cantidad: labor.cantidad ?? null,
//             seleccionada: true,
//             presupuesto: labor.presupuesto
//                 ? {
//                     cotizante_nombre: labor.presupuesto.cotizante_nombre ?? parsed.cotizante_global ?? null,
//                     precio_unitario: labor.presupuesto.precio_unitario ?? null,
//                     precio_total: labor.presupuesto.precio_total ?? null,
//                     plazo_dias: labor.presupuesto.plazo_dias ?? null,
//                     notas: labor.presupuesto.notas ?? null,
//                 }
//                 : null,
//         }));

//         return res.status(200).json({
//             success: true,
//             data: {
//                 labores: laboresEnriquecidas,
//                 cotizante_global: parsed.cotizante_global ?? null,
//             },
//         });
//     } catch (error) {
//         console.error('Error al analizar documento:', error);
//         return res.status(500).json({ success: false, message: 'Error al procesar el documento con IA' });
//     }
// };

// module.exports = { analizarDocumento };

const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../../connection/db.js');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_LABORES_API_KEY });

const SIMBOLOS_UNIDAD = ['m²', 'm³', 'ml', 'kg', 'tn', 'un', 'gl', 'hr', 'lt', 'm'];

const buildSystemPrompt = (especialidades) => {
  const listaEspecialidades = especialidades.map(e => `  { "id": ${e.id}, "nombre": "${e.nombre}" }`).join(',\n');

  return `Sos un asistente especializado en análisis de documentos de construcción argentina.
Tu tarea es extraer labores y presupuestos de documentos como planillas de cómputo, presupuestos de obra, cotizaciones y similares.

Especialidades disponibles en el sistema:
[
${listaEspecialidades}
]

Devolvé ÚNICAMENTE un JSON válido con esta estructura, sin texto adicional, sin markdown, sin explicaciones:
{
  "labores": [
    {
      "nombre_corto": "string — nombre breve de la labor, máximo 6 palabras, que identifique el trabajo (ej: 'Excavación viga fundación', 'Armado hierro encadenado', 'Capa aisladora ladrillo')",
      "descripcion_completa": "string — descripción técnica completa tal como aparece en el documento, con todos los detalles",
      "unidad_simbolo": "m²|m³|ml|kg|tn|un|gl|hr|lt|m|null",
      "cantidad": number|null,
      "especialidad_id": number|null,
      "presupuesto": {
        "cotizante_nombre": "string|null",
        "precio_unitario": number|null,
        "precio_total": number|null,
        "plazo_dias": number|null,
        "notas": "string|null"
      }|null
    }
  ],
  "cotizante_global": "string|null — nombre del contratista/empresa si es único para todo el documento"
}

Reglas para nombre_corto:
- Máximo 6 palabras, idealmente 3-4
- Debe identificar claramente el tipo de trabajo
- No incluir cantidades ni precios
- Ejemplos correctos: "Excavación viga fundación", "Armado hierro encadenado", "Impermeabilización mampostería", "Parrilla base columnas"

Reglas para especialidad_id:
- Analizá el tipo de labor y buscá la especialidad más adecuada de la lista provista
- Solo asignás especialidad_id si estás muy seguro del match (ej: "instalación eléctrica" → Electricista, "excavación" → Albañilería)
- Si no encontrás match claro, dejá especialidad_id en null
- Usá el id numérico exacto de la lista

Reglas para precio_unitario y precio_total — MUY IMPORTANTE:
- Estas son las reglas más importantes del análisis. Un error acá invalida todo el documento.
- Si ves CUALQUIER monto en pesos ($ o números seguidos de "pesos") asociado a una labor, DEBÉS extraerlo. Nunca lo dejes en null si está visible en el documento.
- El campo "cotizante_nombre" es INDEPENDIENTE de "precio_unitario" y "precio_total". Que el cotizante sea global (un solo proveedor para todo el documento) NO significa que haya que omitir los precios — significa únicamente que "cotizante_nombre" queda en null porque ya está en "cotizante_global".
- NUNCA devuelvas el objeto "presupuesto" completo en null si la labor tiene algún monto asociado. En ese caso, "presupuesto" debe existir con "precio_unitario" y/o "precio_total" completos y solo "cotizante_nombre" en null.
- "presupuesto": null se reserva EXCLUSIVAMENTE para labores que no tienen ningún dato económico asociado en el documento (ni precio, ni plazo, ni notas).
- Si el documento muestra precio_unitario y cantidad pero no un total explícito, calculá precio_total = precio_unitario * cantidad.
- Si el documento muestra un precio_total pero no un unitario explícito, calculá precio_unitario = precio_total / cantidad (si cantidad > 0).

Reglas generales:
- Si el documento tiene un solo cotizante para todas las labores, poné ese nombre en "cotizante_global" y dejá "cotizante_nombre" en null en cada labor — pero completá igual precio_unitario y precio_total de cada una.
- unidad_simbolo debe ser exactamente uno de: ${SIMBOLOS_UNIDAD.join(', ')} o null
- Ignorar ítems que no sean labores (materiales puros, gastos administrativos)
- Si no encontrás información, devolvé { "labores": [] }`;
};

const analizarDocumento = async (req, res) => {
  try {
    const { imagen_base64, media_type, texto_libre } = req.body;

    if (!imagen_base64 && !texto_libre)
      return res.status(400).json({ success: false, message: 'Debe enviar imagen_base64 o texto_libre' });

    // Cargar especialidades y unidades en paralelo
    const [{ rows: especialidades }, { rows: unidades }] = await Promise.all([
      pool.query(`SELECT id, nombre FROM especialidades ORDER BY nombre ASC`),
      pool.query(`SELECT id, simbolo FROM unidades_medida`),
    ]);

    const unidadMap = Object.fromEntries(unidades.map(u => [u.simbolo, u.id]));
    const especialidadMap = Object.fromEntries(especialidades.map(e => [e.id, e.nombre]));

    let userContent;
    if (imagen_base64) {
      const esPDF = media_type === 'application/pdf';
      userContent = [
        esPDF
          ? { type: 'document', source: { type: 'base64', media_type, data: imagen_base64 } }
          : { type: 'image', source: { type: 'base64', media_type: media_type || 'image/jpeg', data: imagen_base64 } },
        { type: 'text', text: 'Analizá este documento y extraé todas las labores y presupuestos que encuentres.' },
      ];
    } else {
      userContent = [{ type: 'text', text: `Analizá este texto y extraé labores y presupuestos:\n\n${texto_libre}` }];
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: buildSystemPrompt(especialidades),
      messages: [{ role: 'user', content: userContent }],
    });

    const rawText = response.content.find(b => b.type === 'text')?.text ?? '{}';
    console.log('RESPUESTA IA RAW:', rawText);
    const cleanText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch {
      return res.status(422).json({ success: false, message: 'La IA no pudo estructurar el documento. Intentá con mejor calidad de imagen.' });
    }

    const laboresEnriquecidas = (parsed.labores ?? []).map((labor, idx) => {
      // Validar que especialidad_id existe en nuestro mapa
      const especialidadIdValida = labor.especialidad_id && especialidadMap[labor.especialidad_id]
        ? labor.especialidad_id
        : null;

      let presupuesto = null;
      if (labor.presupuesto) {
        let precio_unitario = labor.presupuesto.precio_unitario ?? null;
        let precio_total    = labor.presupuesto.precio_total ?? null;
        const cantidad = labor.cantidad ?? null;

        // Backup: recalcular si falta uno de los dos y hay cantidad
        if (precio_unitario != null && precio_total == null && cantidad) {
          precio_total = Number((precio_unitario * cantidad).toFixed(2));
        } else if (precio_total != null && precio_unitario == null && cantidad) {
          precio_unitario = Number((precio_total / cantidad).toFixed(2));
        }

        presupuesto = {
          cotizante_nombre: labor.presupuesto.cotizante_nombre ?? parsed.cotizante_global ?? null,
          precio_unitario,
          precio_total,
          plazo_dias: labor.presupuesto.plazo_dias ?? null,
          notas: labor.presupuesto.notas ?? null,
        };
      }

      return {
        _key: idx,
        descripcion: labor.nombre_corto ?? labor.descripcion_completa ?? '',
        descripcion_completa: labor.descripcion_completa ?? null,
        unidad_simbolo: labor.unidad_simbolo ?? null,
        unidad_id: labor.unidad_simbolo ? (unidadMap[labor.unidad_simbolo] ?? null) : null,
        cantidad: labor.cantidad ?? null,
        especialidad_id: especialidadIdValida,
        especialidad_nombre: especialidadIdValida ? especialidadMap[especialidadIdValida] : null,
        seleccionada: true,
        presupuesto,
      };
    });

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