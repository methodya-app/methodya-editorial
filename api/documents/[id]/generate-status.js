import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth, requireAdmin } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { loadDocumentWithAccess } from '../../_lib/documentAccess.js';

// Estado de la última generación por IA encolada para este documento. Lo
// consulta el frontend con polling mientras el worker trabaja, en vez de
// mantener abierta una petición larga (ver generate.js / generate-worker.js).
export default withCors(async (req, res) => {
  if (req.method !== 'GET') throw new ApiError(405, 'Método no permitido');

  const auth = await requireAuth(req);
  requireAdmin(auth);
  const { id } = req.query;
  await loadDocumentWithAccess(auth, id);

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('document_generation_jobs')
    .select('*')
    .eq('document_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);

  return res.status(200).json({ job: data || null });
});
