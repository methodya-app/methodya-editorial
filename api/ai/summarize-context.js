import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { summarizeDocumentContext } from '../_lib/gemini.js';

// Formatos soportados vía comprensión de documentos nativa de Gemini (envío
// directo como inline_data, sin librería propia de extracción de PDF/DOCX).
const ALLOWED_MIME_TYPES = ['application/pdf', 'text/plain', 'text/markdown'];

// ~4MB de texto base64 (~3MB de archivo original), para quedar cómodo bajo
// el límite de payload de las funciones serverless.
const MAX_BASE64_LENGTH = 4 * 1024 * 1024;

export default withCors(async (req, res) => {
  if (req.method !== 'POST') throw new ApiError(405, 'Método no permitido');
  await requireAuth(req);

  const { file_base64, mime_type } = req.body || {};
  if (!file_base64) throw new ApiError(400, 'file_base64 es obligatorio');
  if (!ALLOWED_MIME_TYPES.includes(mime_type)) {
    throw new ApiError(400, 'Formato no soportado. Usa PDF, TXT o Markdown.');
  }
  if (file_base64.length > MAX_BASE64_LENGTH) {
    throw new ApiError(413, 'El archivo es demasiado grande (máximo aproximado de 3MB).');
  }

  const result = await summarizeDocumentContext({ base64Data: file_base64, mimeType: mime_type });
  return res.status(200).json(result);
});
