import { supabaseAdmin } from './supabaseAdmin.js';
import { ApiError } from './cors.js';

// Baraja una copia del arreglo (Fisher-Yates). Se usa para que el orden en
// que se listan opciones en el prompt (ej. tipos de subformulario) no quede
// siempre igual — los modelos tienden a favorecer la primera opción de una
// lista cuando no hay una razón fuerte para elegir otra, así que un orden
// fijo termina sesgando siempre hacia el mismo tipo.
function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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

// Arma el texto de longitud/patrón de una validación para el prompt: antes
// solo se mandaba `description` (texto libre que escribe el admin, que no
// siempre menciona los números), así que el modelo podía no enterarse de un
// min_length/max_length aunque sí estuviera activo y se fuera a exigir en la
// validación real — causando que generara contenido con la longitud
// correcta según su propio criterio pero fuera de rango.
function describeValidation(v) {
  if (!v?.enabled) return null;
  const parts = [];
  if (v.min_length) parts.push(`mínimo ${v.min_length} caracteres`);
  if (v.max_length) parts.push(`máximo ${v.max_length} caracteres`);
  if (v.description) parts.push(v.description);
  return parts.length ? parts.join(', ') : null;
}

// Describe un campo para el prompt del agente sintético. Recursivo: una
// "tabla_dinamica" describe sus columnas (con su propia regla de
// validación), y un "subform" describe cada tipo de subformulario permitido
// (de subformsLibrary) con sus propios campos, incluida cualquier
// tabla_dinamica anidada. `depth` evita recursión descontrolada si algún día
// un subformulario llegara a incluirse a sí mismo; en la práctica nunca pasa
// de 1 nivel (los subformularios de la biblioteca no anidan subformularios).
function describeField(f, ctx, depth = 0) {
  const { projectPoblaciones, projectTemas, projectDotacionReferencias, subformsLibrary, limitesSubformularios } = ctx;
  const parts = [`- "${f.variable}" (${f.label}): tipo ${f.type}`];
  if (f.required) parts.push('OBLIGATORIO');
  if (f.instrucciones?.trim()) parts.push(`instrucciones: ${f.instrucciones.trim()}`);

  // Los tipos "poblacion_objetivo" / "temas_focos" / "dotacion" no traen sus
  // opciones en field.options (se toman en vivo de la Parametrización del
  // proyecto), así que se describen aparte con el mismo id/texto exacto que
  // se debe guardar como valor.
  if (f.type === 'poblacion_objetivo') {
    const opts = projectPoblaciones.map((p) => `"${p.id}" = ${p.nombre}`).join(' | ');
    parts.push(`selección única, valor = el id exacto entre comillas de UNA de estas opciones: ${opts || '(el proyecto no tiene poblaciones configuradas)'}`);
  } else if (f.type === 'temas_focos') {
    const opts = projectTemas.join(' | ');
    parts.push(`selección múltiple, valor = array JSON con 0 o más de estos textos EXACTOS: ${opts || '(el proyecto no tiene temas configurados)'}`);
  } else if (f.type === 'dotacion') {
    const opts = projectDotacionReferencias.map((r) => `"${r.id}" = ${r.nombre} (${r.referencia})`).join(' | ');
    parts.push(`selección múltiple, valor = array JSON con 0 o más ids EXACTOS entre comillas de estas opciones: ${opts || '(el proyecto no tiene dotación configurada)'}`);
  } else if (f.options?.length) {
    parts.push(`opciones válidas: ${f.options.join(' | ')}`);
  }
  if (f.placeholder) parts.push(`ejemplo/placeholder: ${f.placeholder}`);
  const validationText = describeValidation(f.validation);
  if (validationText) parts.push(`regla de validación: ${validationText}`);

  let line = parts.join(', ');

  if (f.type === 'tabla_dinamica') {
    const maxFilas = f.max_filas ? ` (máximo ${f.max_filas} filas)` : '';
    line += `, valor = array JSON de filas${maxFilas}, cada fila un objeto con estas claves:`;
    const cols = (f.columnas || [])
      .map((c) => {
        const colParts = [`  - "${c.variable}" (${c.etiqueta}, tipo ${c.tipo})`];
        const colValidationText = describeValidation(c.validation);
        if (colValidationText) colParts.push(`regla de validación: ${colValidationText}`);
        return colParts.join(', ');
      })
      .join('\n');
    return cols ? `${line}\n${cols}` : line;
  }

  if (f.type === 'subform') {
    const allowedIds = f.subform_ids || [];
    const allowedTypes = shuffle(subformsLibrary.filter((sf) => allowedIds.includes(sf._id)));
    const maxInstancias = f.allow_multiple_instances ? 'puede tener varias instancias' : 'como máximo 1 instancia';
    line +=
      `, valor = {"subform_id": "<id EXACTO de uno de los tipos listados abajo>", "instances": [{"values": {...}}]}` +
      ` (${maxInstancias}). Elige el tipo que mejor comunique ESTE contenido específico — no elijas siempre ` +
      `el mismo tipo por defecto, decide caso a caso. Tipos de subformulario permitidos (elige uno por instancia):`;
    if (depth >= 2 || allowedTypes.length === 0) {
      return `${line} (sin tipos configurados)`;
    }
    const typeBlocks = allowedTypes
      .map((sf) => {
        const rule = (limitesSubformularios || []).find((r) => r.subform_id === sf._id);
        const limitNote = rule
          ? ` LÍMITE: máximo ${rule.maximo} instancias de este tipo ${
              rule.alcance === 'seccion' ? 'por sección' : 'en todo el formulario'
            } (cuenta todas las instancias de este tipo en el formulario, no solo las de este campo).`
          : '';
        const subfieldLines = (sf.fields || [])
          .map((subfield) =>
            '  ' + describeField(subfield, ctx, depth + 1).split('\n').join('\n  ')
          )
          .join('\n');
        return `  Tipo "${sf._id}" = ${sf.nombre}:${limitNote}\n${subfieldLines}`;
      })
      .join('\n');
    return `${line}\n${typeBlocks}`;
  }

  return line;
}

// Genera los valores de un formulario (todos los campos, incluidos
// "tabla_dinamica" y "subform") en la voz/expertise de un agente sintético
// (Creador Experto operado por IA), usando el contexto real de
// parametrización ya armado por buildContextText
// (api/_lib/parametrizacion.js). Si `previousErrors` viene informado, le
// pide al modelo corregir esos campos puntuales sin repetir el error. Sin
// heurística de respaldo: sin clave de Gemini no es posible generar
// contenido real, nunca se produce contenido falso.
export async function generateDocumentValues({
  form,
  personaPrompt,
  contextText,
  previousErrors,
  model: modelOverride,
  projectPoblaciones = [],
  projectTemas = [],
  projectDotacionReferencias = [],
  subformsLibrary = [],
}) {
  const apiKey = await resolveGeminiKey();
  const model = modelOverride || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    throw new ApiError(
      422,
      'No hay una clave de Gemini configurada en Parámetros del servidor; no es posible generar contenido automáticamente.'
    );
  }

  const fields = (form?.sections || []).flatMap((s) => s.fields || []);

  const ctx = {
    projectPoblaciones,
    projectTemas,
    projectDotacionReferencias,
    subformsLibrary,
    limitesSubformularios: form?.limites_subformularios || [],
  };
  const fieldsSchema = fields.map((f) => describeField(f, ctx)).join('\n');

  let errorsSection = '';
  if (previousErrors && Object.keys(previousErrors).length > 0) {
    const lines = Object.entries(previousErrors).map(([variable, errs]) => {
      const label = fields.find((f) => f.variable === variable)?.label || variable;
      const errText = Array.isArray(errs) ? errs.join('; ') : String(errs);
      return `- ${label} ("${variable}"): ${errText}`;
    });
    errorsSection =
      '\n\nEl intento anterior tuvo estos errores de validación; corrígelos campo por campo, sin repetirlos:\n' +
      lines.join('\n');
  }

  const promptText =
    'Eres el Creador Experto (operado por IA) de la plataforma editorial educativa METHODYA. Tu tarea es ' +
    'diligenciar un formulario educativo exactamente como lo haría una persona real en tu rol, con tu propia ' +
    'voz y expertise.\n\n' +
    (personaPrompt ? `TU VOZ/EXPERTISE: ${personaPrompt}\n\n` : '') +
    (contextText ? `CONTEXTO DEL PROYECTO Y DEL DOCUMENTO:\n${contextText}\n\n` : '') +
    `CAMPOS DEL FORMULARIO A DILIGENCIAR:\n${fieldsSchema}` +
    errorsSection +
    '\n\nResponde ÚNICAMENTE un JSON válido (sin markdown, sin texto extra) con una clave por cada variable ' +
    'del formulario y su valor generado. Para campos "select" o "checkbox" usa exactamente una (o, en ' +
    'checkbox, varias) de las opciones válidas listadas. Para "poblacion_objetivo" y "dotacion" usa ' +
    'exactamente el/los id(s) entre comillas indicados (nunca el nombre). Para "temas_focos" usa exactamente ' +
    'el/los texto(s) indicados. Para "number" usa un valor numérico. Para "tabla_dinamica" genera un array de ' +
    'filas (objetos) con exactamente las claves de columna indicadas. Para "subform" usa el id EXACTO de uno ' +
    'de los tipos permitidos y genera cada instancia con sus propios valores según los campos de ese tipo ' +
    'descritos (sin incluir "id" ni "codigo", se asignan automáticamente), respetando la cantidad de ' +
    'instancias permitida y cualquier LÍMITE indicado. Respeta las reglas de validación descritas en todos los niveles.';

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        // temperature por defecto del modelo tiende a converger siempre a la
        // respuesta "más típica" sin importar la persona del agente; se sube
        // un poco para que distintos agentes (y distintos intentos del mismo
        // agente) generen contenido más variado entre sí.
        generationConfig: { responseMimeType: 'application/json', temperature: 1.2 },
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

  let values;
  try {
    values = JSON.parse(cleanJson);
  } catch {
    throw new ApiError(502, 'Gemini no devolvió un JSON válido para este formulario');
  }
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw new ApiError(502, 'Gemini no devolvió un objeto de valores utilizable');
  }

  // usageMetadata viene en toda respuesta de Gemini; se registra para poder
  // calcular el consumo de tokens del agente sintético (ver
  // api/documents/[id]/generate.js, que lo guarda en document_generations).
  const usage = result?.usageMetadata || {};
  return {
    values,
    model,
    source: 'gemini',
    usage: {
      promptTokens: usage.promptTokenCount ?? null,
      completionTokens: usage.candidatesTokenCount ?? null,
      totalTokens: usage.totalTokenCount ?? null,
    },
  };
}
