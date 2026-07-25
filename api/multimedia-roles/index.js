import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireMultimediaCoordinator } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

// Catálogo global de roles multimedia (ej. "Diseñador videos multimedia"),
// cada uno asociado a qué plantillas de subformulario puede trabajar
// (subform_ids). Lo administran el Administrador y cualquier Coordinador
// Multimedia (de cualquier proyecto); cualquier usuario autenticado puede
// listarlo (se usa para los selectores de equipo por proyecto).
export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();

  if (req.method === 'GET') {
    const { data, error } = await admin.from('multimedia_roles').select('*').order('nombre');
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ multimedia_roles: data });
  }

  if (req.method === 'POST') {
    requireMultimediaCoordinator(auth);
    const { nombre, subform_ids } = req.body || {};
    if (!nombre) throw new ApiError(400, 'nombre es obligatorio');

    const { data, error } = await admin
      .from('multimedia_roles')
      .insert({ nombre, subform_ids: Array.isArray(subform_ids) ? subform_ids : [] })
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(201).json({ multimedia_role: data });
  }

  throw new ApiError(405, 'Método no permitido');
});
