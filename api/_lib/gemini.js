import { supabaseAdmin } from './supabaseAdmin.js';
import { ApiError } from './cors.js';

// Heurística offline: se usa como respaldo si no hay API key configurada o
// si la llamada a Gemini falla, para que el módulo nunca deje de funcionar.
function heuristicRegex(ruleText) {
  const text = ruleText.toLowerCase();
  if (text.includes('correo') || text.includes('email')) {
    return '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
  }
  if (text.includes('solo letras') || text.includes('mayúscula') || text.includes('mayuscula')) {
    return '^[A-ZÁÉÍÓÚÑ][a-zA-ZáéíóúÁÉÍÓÚñÑ\\s]+$';
  }
  if (text.includes('número') || text.includes('numero') || text.includes('entero')) {
    return '^\\d+$';
  }
  if (text.includes('fecha')) {
    return '^\\d{4}-\\d{2}-\\d{2}$';
  }
  if (text.includes('url') || text.includes('enlace') || text.includes('link')) {
    return '^https?:\\/\\/[\\w.-]+(\\/\\S*)?$';
  }
  return '^.{1,}$';
}

// Lee la clave de Gemini: primero la tabla settings (editable en caliente por
// el Administrador), y si no existe usa la variable de entorno de Vercel.
async function resolveGeminiKey() {
  try {
    const admin = supabaseAdmin();
    const { data } = await admin.from('settings').select('gemini_api_key').eq('id', 1).single();
    if (data?.gemini_api_key) return data.gemini_api_key;
  } catch {
    // ignore, cae a variable de entorno
  }
  return process.env.GEMINI_API_KEY || null;
}

// Convierte una descripción en lenguaje natural en una expresión regular,
// usando Google Gemini. Devuelve { pattern, explanation, source }.
export async function generateRegexFromDescription(ruleText) {
  if (!ruleText || !ruleText.trim()) {
    throw new ApiError(400, 'Debes describir la regla de validación');
  }

  const apiKey = await resolveGeminiKey();
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    return {
      pattern: heuristicRegex(ruleText),
      explanation: 'Generado con heurística local (no hay clave de Gemini configurada).',
      source: 'heuristic',
    };
  }

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    'Eres un asistente experto de la plataforma editorial educativa METHODYA. ' +
                    'Analiza la siguiente regla de validación en lenguaje natural y tradúcela a ' +
                    'una expresión regular estándar (compatible con JavaScript RegExp), en texto ' +
                    `plano, sin barras iniciales ni finales. REGLA: "${ruleText}". ` +
                    'Responde ÚNICAMENTE un JSON válido (sin markdown, sin texto extra) con el ' +
                    'formato: {"pattern": "expresion_regular", "explanation": "explicación breve"}',
                },
              ],
            },
          ],
        }),
      }
    );

    if (!resp.ok) throw new Error(`Gemini respondió ${resp.status}`);
    const result = await resp.json();
    const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanJson = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (!parsed.pattern) throw new Error('Respuesta de Gemini sin patrón');

    // Validar que el patrón compile antes de devolverlo
    new RegExp(parsed.pattern);

    return {
      pattern: parsed.pattern,
      explanation: parsed.explanation || '',
      source: 'gemini',
    };
  } catch (err) {
    console.error('Error generando regex con Gemini, usando heurística:', err.message);
    return {
      pattern: heuristicRegex(ruleText),
      explanation: `Generado con heurística local (falló Gemini: ${err.message}).`,
      source: 'heuristic',
    };
  }
}

// Analiza un documento (PDF, TXT o Markdown, recibido en base64) usando la
// comprensión de documentos nativa de Gemini (se envía como inline_data, sin
// necesidad de una librería propia de extracción de PDF/DOCX) y devuelve un
// resumen breve en español, pensado para poblar el campo "Región/contexto"
// de una población objetivo. No hay heurística de respaldo: sin una clave de
// Gemini configurada, simplemente no es posible resumir el documento.
export async function summarizeDocumentContext({ base64Data, mimeType }) {
  if (!base64Data) throw new ApiError(400, 'El archivo es obligatorio');

  const apiKey = await resolveGeminiKey();
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    throw new ApiError(
      422,
      'No hay una clave de Gemini configurada en Parámetros del servidor; no es posible resumir el documento automáticamente.'
    );
  }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  'Eres un asistente experto de la plataforma editorial educativa METHODYA. Analiza el ' +
                  'documento adjunto (describe el contexto/región de una población objetivo educativa) y ' +
                  'redacta un resumen breve en español (máximo 6-8 líneas), en prosa corrida, listo para ' +
                  'usarse tal cual como el campo "Región/contexto" de esa población. No agregues títulos, ' +
                  'listas ni markdown, responde únicamente el texto del resumen.',
              },
              { inline_data: { mime_type: mimeType, data: base64Data } },
            ],
          },
        ],
      }),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new ApiError(502, `Gemini respondió ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const result = await resp.json();
  const summary = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!summary) throw new ApiError(502, 'Gemini no devolvió un resumen utilizable para este documento');

  return { summary, source: 'gemini' };
}

// Analiza el manual/ficha técnica de un equipo de dotación educativa (PDF,
// TXT o Markdown, recibido en base64) y extrae su información técnica UNA
// sola vez: un objeto de especificaciones (clave-valor, solo lo que el
// documento realmente menciona) y un resumen breve. Se guarda en
// dotacion_referencias para no tener que releer el manual completo en cada
// ejecución. Igual que summarizeDocumentContext, sin heurística de
// respaldo: sin clave de Gemini no es posible extraer nada.
export async function extractDotacionSpecs({ base64Data, mimeType }) {
  if (!base64Data) throw new ApiError(400, 'El archivo es obligatorio');

  const apiKey = await resolveGeminiKey();
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    throw new ApiError(
      422,
      'No hay una clave de Gemini configurada en Parámetros del servidor; no es posible analizar el documento automáticamente.'
    );
  }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  'Eres un asistente experto de la plataforma editorial educativa METHODYA. Analiza el manual ' +
                  'o ficha técnica adjunta de un equipo de dotación educativa (ej. un kit STEAM, un kit IoT, ' +
                  'una pantalla interactiva) y extrae su información técnica relevante. Responde ÚNICAMENTE ' +
                  'un JSON válido (sin markdown, sin texto extra) con el formato: {"especificaciones": ' +
                  '{"<clave>": "<valor>", ...}, "resumen": "<resumen breve en español, 4-6 líneas, en prosa ' +
                  'corrida>"}. En "especificaciones" incluye únicamente los campos técnicos que el documento ' +
                  'realmente menciona (ej. sensores, componentes, conectividad, alimentación, requisitos, ' +
                  'contenido de la caja), con nombres de clave cortos en español, minúsculas y con guiones ' +
                  'bajos en vez de espacios.',
              },
              { inline_data: { mime_type: mimeType, data: base64Data } },
            ],
          },
        ],
      }),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new ApiError(502, `Gemini respondió ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const result = await resp.json();
  const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleanJson = rawText.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleanJson);
  } catch {
    throw new ApiError(502, 'Gemini no devolvió un JSON válido para este documento');
  }
  if (!parsed.resumen) throw new ApiError(502, 'Gemini no devolvió un resumen utilizable para este documento');

  return {
    especificaciones:
      parsed.especificaciones && typeof parsed.especificaciones === 'object' ? parsed.especificaciones : {},
    resumen: parsed.resumen,
    source: 'gemini',
  };
}
