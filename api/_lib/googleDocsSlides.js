import { getGoogleAccessToken } from './googleAuth.js';
import { ApiError } from './cors.js';

const DOCS_API = 'https://docs.googleapis.com/v1/documents';
const SLIDES_API = 'https://slides.googleapis.com/v1/presentations';

// Convierte { variable: valor } en las peticiones replaceAllText que
// entienden tanto la API de Docs como la de Slides (mismo formato en
// ambas): busca literalmente "{{variable}}" y lo reemplaza por el texto
// capturado en el formulario.
function buildReplaceRequests(values) {
  return Object.entries(values).map(([key, val]) => {
    const text = Array.isArray(val) ? val.join(', ') : val && typeof val === 'object' ? '' : String(val ?? '');
    return {
      replaceAllText: {
        containsText: { text: `{{${key}}}`, matchCase: true },
        replaceText: text,
      },
    };
  });
}

async function batchUpdate(baseUrl, fileId, requests) {
  if (requests.length === 0) return;
  const token = await getGoogleAccessToken();
  const resp = await fetch(`${baseUrl}/${fileId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
  if (!resp.ok) {
    let message = `respondió con error ${resp.status}`;
    try {
      const errBody = await resp.json();
      message = errBody?.error?.message || message;
    } catch {
      // ignore
    }
    throw new ApiError(502, `Google ${baseUrl.includes('docs') ? 'Docs' : 'Slides'}: ${message}`);
  }
}

export async function replaceVariablesInDoc(fileId, values) {
  await batchUpdate(DOCS_API, fileId, buildReplaceRequests(values));
}

export async function replaceVariablesInSlides(fileId, values) {
  await batchUpdate(SLIDES_API, fileId, buildReplaceRequests(values));
}

// Inserta texto plano al comienzo de un Google Doc recién creado (vacío).
// Se usa para el export de un subformulario individual, que no parte de
// ninguna plantilla (a diferencia del vaciamiento del documento completo).
export async function insertTextInDoc(fileId, text) {
  await batchUpdate(DOCS_API, fileId, [{ insertText: { location: { index: 1 }, text } }]);
}
