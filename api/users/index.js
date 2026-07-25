import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();

  if (req.method === 'GET') {
    requireAdmin(auth);
    const trashed = req.query.trashed === '1';
    const { data, error } = await admin
      .from('profiles')
      .select('*')
      .eq('eliminado', trashed)
      .order('created_at', { ascending: false });
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ users: data });
  }

  if (req.method === 'POST') {
    requireAdmin(auth);
    const { email, password, nombre, apellido, is_admin } = req.body || {};
    if (!email || !password || !nombre || !apellido) {
      throw new ApiError(400, 'nombre, apellido, email y clave son obligatorios');
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) throw new ApiError(400, createError.message);

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .insert({
        id: created.user.id,
        email,
        nombre,
        apellido,
        is_admin: !!is_admin,
      })
      .select()
      .single();

    if (profileError) throw new ApiError(500, profileError.message);
    return res.status(201).json({ user: profile });
  }

  throw new ApiError(405, 'Método no permitido');
});
