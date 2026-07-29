import { withCors, ApiError } from '../../../_lib/cors.js';
import { requireAuth } from '../../../_lib/auth.js';
import { getDb } from '../../../_lib/mongo.js';
import { loadDocumentWithAccess } from '../../../_lib/documentAccess.js';

// Consulta liviana: ¿este documento ya fue enviado a implementación? La usa
// DocumentExecute.jsx para decidir si muestra el botón "Enviar a
// implementación" o un badge con el estado actual de la tarea.
export default withCors(async (req, res) => {
  if (req.method !== 'GET') throw new ApiError(405, 'Método no permitido');

  const auth = await requireAuth(req);
  const { id: document_id } = req.query;
  await loadDocumentWithAccess(auth, document_id);

  const db = await getDb();
  const implementation = await db.collection('document_implementations').findOne({ document_id });

  return res.status(200).json({
    implementation: implementation
      ? { ...implementation, id: implementation._id.toString(), _id: undefined }
      : null,
  });
});
