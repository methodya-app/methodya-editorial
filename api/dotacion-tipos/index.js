import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

// Catálogo global de tipos de dotación (ej. "KIT STEAM", "KIT IoT",
// "Pantalla interactiva"). Cualquier usuario autenticado puede listarlo
// (se usa para seleccionar dotación desde la Parametrización del
// proyecto); solo el Administrador puede crear/editar/retirar tipos.
export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();

  if (req.method === 'GET') {
    const { data, error } = await admin.from('dotacion_tipos').select('*').eq('activo', true).order('nombre');
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ dotacion_tipos: data });
  }

  if (req.method === 'POST') {
    requireAdmin(auth);
    const { nombre, descripcion } = req.body || {};
    if (!nombre || !nombre.trim()) throw new ApiError(400, 'nombre es obligatorio');

    const { data, error } = await admin
      .from('dotacion_tipos')
      .insert({ nombre: nombre.trim(), descripcion: descripcion || null, created_by: auth.profile.id })
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(201).json({ dotacion_tipo: data });
  }

  throw new ApiError(405, 'Método no permitido');
});
