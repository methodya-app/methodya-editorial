import { randomUUID } from 'node:crypto';
import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

// Correo/clave de un agente sintético: el Administrador no los digita, se
// generan solos (el agente nunca inicia sesión por su cuenta; lo "opera" el
// Administrador desde el botón "Generar con IA").
function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

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
    const { email, password, nombre, apellido, is_admin, is_synthetic, persona_prompt, persona_model } =
      req.body || {};

    if (!nombre || !apellido) throw new ApiError(400, 'nombre y apellido son obligatorios');

    let finalEmail = email;
    let finalPassword = password;
    if (is_synthetic) {
      // El agente nunca inicia sesión por su cuenta; el Administrador lo
      // "opera" desde el botón "Generar con IA", así que correo/clave son
      // solo un requisito técnico de Supabase Auth, no algo que se use.
      const slug = slugify(`${nombre}-${apellido}`) || 'agente';
      finalEmail = `agente-${slug}-${Date.now().toString(36)}@methodya.synthetic`;
      finalPassword = `${randomUUID()}${randomUUID()}`;
    } else if (!email || !password) {
      throw new ApiError(400, 'nombre, apellido, email y clave son obligatorios');
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: finalEmail,
      password: finalPassword,
      email_confirm: true,
    });
    if (createError) throw new ApiError(400, createError.message);

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .insert({
        id: created.user.id,
        email: finalEmail,
        nombre,
        apellido,
        is_admin: !!is_admin,
        is_synthetic: !!is_synthetic,
        persona_prompt: is_synthetic ? persona_prompt || null : null,
        persona_model: is_synthetic ? persona_model || null : null,
      })
      .select()
      .single();

    if (profileError) throw new ApiError(500, profileError.message);
    return res.status(201).json({ user: profile });
  }

  throw new ApiError(405, 'Método no permitido');
});
