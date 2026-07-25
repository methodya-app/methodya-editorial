import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { loadAssignmentWithAccess } from '../[id].js';
import { extractDriveId, findOrCreateSubfolder, startResumableUpload } from '../../_lib/googleDrive.js';

// Inicia una subida directa del navegador a Google Drive (sin pasar el
// archivo por nuestro backend). La carpeta destino sigue la misma carpeta
// del proyecto que usan los documentos: {carpeta del proyecto}/{código del
// documento}/recursos multimedia/{nombre del subformulario}/.
export default withCors(async (req, res) => {
  if (req.method !== 'POST') throw new ApiError(405, 'Método no permitido');
  const auth = await requireAuth(req);
  const { id } = req.query;
  const { db, assignment, isMine, isCoordinator } = await loadAssignmentWithAccess(auth, id);

  if (!isMine && !isCoordinator) {
    throw new ApiError(403, 'Solo quien tiene la tarea asignada puede cargar el recurso');
  }
  if (assignment.estado === 'Eliminado') throw new ApiError(423, 'Esta tarea está en la papelera');

  const { filename, mime_type, size_bytes } = req.body || {};
  if (!filename) throw new ApiError(400, 'filename es obligatorio');

  const admin = supabaseAdmin();
  const { data: project } = await admin
    .from('projects')
    .select('drive_folder_url')
    .eq('id', assignment.project_id)
    .single();
  const folderId = extractDriveId(project?.drive_folder_url);
  if (!folderId) throw new ApiError(400, 'El proyecto no tiene carpeta de Drive configurada');

  const subfolderId = await findOrCreateSubfolder(folderId, assignment.document_codigo);
  const resourcesFolderId = await findOrCreateSubfolder(subfolderId, 'recursos multimedia');
  const typeFolderId = await findOrCreateSubfolder(resourcesFolderId, assignment.subform_nombre);

  const uploadUrl = await startResumableUpload({
    name: filename,
    mimeType: mime_type,
    parentId: typeFolderId,
    sizeBytes: size_bytes,
  });

  return res.status(200).json({ upload_url: uploadUrl });
});
