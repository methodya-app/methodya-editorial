import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth, requireAdmin } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';

// Referencias (modelos/SKU) concretas de un tipo de dotación. Dos kits del
// mismo tipo pueden traer sensores/componentes distintos según la
// referencia, por eso la ficha técnica vive aquí y no en el tipo.
export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();
  const { id: dotacion_tipo_id } = req.query;

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('dotacion_referencias')
      .select('*')
      .eq('dotacion_tipo_id', dotacion_tipo_id)
      .eq('activo', true)
      .order('nombre');
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ dotacion_referencias: data });
  }

  if (req.method === 'POST') {
    requireAdmin(auth);
    const { referencia, nombre, descripcion, especificaciones, resumen, fuente } = req.body || {};
    if (!referencia || !referencia.trim()) throw new ApiError(400, 'referencia es obligatoria');
    if (!nombre || !nombre.trim()) throw new ApiError(400, 'nombre es obligatorio');

    const { data, error } = await admin
      .from('dotacion_referencias')
      .insert({
        dotacion_tipo_id,
        referencia: referencia.trim(),
        nombre: nombre.trim(),
        descripcion: descripcion || null,
        especificaciones: especificaciones && typeof especificaciones === 'object' ? especificaciones : {},
        resumen: resumen || null,
        fuente: fuente === 'ia_archivo' ? 'ia_archivo' : 'manual',
        created_by: auth.profile.id,
      })
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(201).json({ dotacion_referencia: data });
  }

  throw new ApiError(405, 'Método no permitido');
});
