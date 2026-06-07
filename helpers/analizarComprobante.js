const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_MARKET_API_KEY });

async function analizarComprobante(imageBase64, mediaType, totalTransaccion, moneda) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `Analizá esta imagen y determiná si es un comprobante de pago/transferencia válido.
            
El monto esperado de la transacción es: ${totalTransaccion} ${moneda}.

Respondé SOLO con un JSON con este formato exacto, sin texto adicional:
{
  "es_comprobante": true/false,
  "monto_detectado": número o null,
  "monto_coincide": true/false/null,
  "confianza": "alta"/"media"/"baja",
  "motivo": "explicación breve en español"
}

Criterios:
- es_comprobante: true si la imagen muestra claramente un comprobante de transferencia, pago o transacción bancaria
- monto_detectado: el monto que aparece en el comprobante (null si no se puede leer)
- monto_coincide: true si el monto detectado coincide con ${totalTransaccion}, null si no se pudo detectar el monto
- confianza: qué tan seguro estás del análisis
- motivo: explicación de por qué es o no válido`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].text;
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

module.exports = { analizarComprobante };