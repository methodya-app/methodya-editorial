import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();
  const { id } = req.query;

  if (req.method === 'PUT') {
    requireAdmin(auth);
    const { texto } = req.body || {};
    const updates = {};
    if (texto !== undefined) {
      if (!texto.trim()) throw new ApiError(400, 'texto no puede quedar vacío');
      updates.texto = texto.trim();
    }

    const { data, error } = await admin
      .from('enfoques_narrativos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ enfoque_narrativo: data });
  }

  if (req.method === 'DELETE') {
    requireAdmin(auth);
    // Eliminación lógica: deja de listarse/ofrecerse en el catálogo, pero
    // los proyectos que lo excluyeron explícitamente conservan ese id sin
    // ningún problema (ya no aparece de todas formas, esté excluido o no).
    const { error } = await admin.from('enfoques_narrativos').update({ activo: false }).eq('id', id);
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
