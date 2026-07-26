import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth, requireAdmin, roleInProject } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { STAGE_ROLE, autoAssignIfNeeded } from '../../_lib/groupAssignment.js';

const DOCUMENT_COLUMNS =
  'id, codigo, estado, form_id, document_type_id, poblacion_objetivo_id, creador_id, revisor_pedagogico_id, revisor_estilo_id, vaciado_at, created_at, updated_at,' +
  'creador:creador_id(nombre, apellido, email, is_synthetic),' +
  'revisor_pedagogico:revisor_pedagogico_id(nombre, apellido, email),' +
  'revisor_estilo:revisor_estilo_id(nombre, apellido, email),' +
  'document_types(nombre),' +
  'poblaciones_objetivo(id, nombre, edad_min, edad_max)';

export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();
  const { id: project_id } = req.query;

  const role = roleInProject(auth, project_id);
  if (!role) throw new ApiError(403, 'Sin acceso al proyecto');

  if (req.method === 'GET') {
    // trashed=1 -> solo documentos en la papelera (estado Eliminado); por
    // defecto se excluyen (vista normal de documentos).
    const trashed = req.query.trashed === '1' || req.query.trashed === 'true';
    if (trashed) requireAdmin(auth); // la papelera es exclusiva del Administrador

    if (auth.isAdmin) {
      let query = admin
        .from('documents')
        .select(DOCUMENT_COLUMNS)
        .eq('project_id', project_id)
        .order('created_at', { ascending: false });
      query = trashed ? query.eq('estado', 'Eliminado') : query.neq('estado', 'Eliminado');
      const { data, error } = await query;
      if (error) throw new ApiError(500, error.message);
      return res.status(200).json({ documents: data, my_role: role });
    }

    // No-admin: se combina, para cada rol que tenga en este proyecto, sus
    // documentos ya asignados con los que estén SIN asignar en la(s)
    // etapa(s) de ese rol (disponibles para tomar, ver claim.js).
    const myRoles = [
      ...new Set(auth.projectRoles.filter((pr) => pr.project_id === project_id).map((pr) => pr.role)),
    ];

    const byId = new Map();
    for (const roleName of myRoles) {
      const cfg = STAGE_ROLE.find((s) => s.role === roleName);
      if (!cfg) continue;

      const { data: assigned } = await admin
        .from('documents')
        .select(DOCUMENT_COLUMNS)
        .eq('project_id', project_id)
        .neq('estado', 'Eliminado')
        .eq(cfg.field, auth.profile.id);
      for (const d of assigned || []) {
        byId.set(d.id, { ...d, assigned_to_me: true, can_claim: false });
      }

      const { data: claimable } = await admin
        .from('documents')
        .select(DOCUMENT_COLUMNS)
        .eq('project_id', project_id)
        .neq('estado', 'Eliminado')
        .in('estado', cfg.estados)
        .is(cfg.field, null);
      for (const d of claimable || []) {
        if (!byId.has(d.id)) byId.set(d.id, { ...d, assigned_to_me: false, can_claim: true });
      }
    }

    const documents = [...byId.values()].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    return res.status(200).json({ documents, my_role: role, my_roles: myRoles });
  }

  if (req.method === 'POST') {
    requireAdmin(auth);
    const {
      codigo,
      form_id,
      document_type_id,
      poblacion_objetivo_id,
      creador_id,
      revisor_pedagogico_id,
      revisor_estilo_id,
    } = req.body || {};

    if (!codigo || !form_id) throw new ApiError(400, 'codigo y form_id son obligatorios');

    const { data: projectRow } = await admin
      .from('projects')
      .select('parametrizacion')
      .eq('id', project_id)
      .single();
    const allowedPoblacionIds = projectRow?.parametrizacion?.poblacion_objetivo?.poblacion_ids || [];
    if (allowedPoblacionIds.length === 0) {
      throw new ApiError(
        422,
        'Este proyecto no tiene poblaciones objetivo configuradas. Configúralas en Parametrización → Población objetivo antes de crear documentos.'
      );
    }
    if (!poblacion_objetivo_id || !allowedPoblacionIds.includes(poblacion_objetivo_id)) {
      throw new ApiError(400, 'poblacion_objetivo_id es obligatorio y debe ser una de las poblaciones configuradas para este proyecto');
    }

    const { data, error } = await admin
      .from('documents')
      .insert({
        project_id,
        codigo,
        form_id,
        document_type_id: document_type_id || null,
        poblacion_objetivo_id,
        creador_id: creador_id || null,
        revisor_pedagogico_id: revisor_pedagogico_id || null,
        revisor_estilo_id: revisor_estilo_id || null,
        estado: 'Pendiente',
      })
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);

    await admin.from('document_history').insert({
      document_id: data.id,
      estado_anterior: null,
      estado_nuevo: 'Pendiente',
      actor_id: auth.profile.id,
      nota: 'Documento creado',
    });

    // Si se creó sin Creador Experto asignado, según la configuración del
    // proyecto se asigna solo o queda disponible para que alguien lo tome.
    const { data: project } = await admin
      .from('projects')
      .select('asignacion_creador, asignacion_revisor_pedagogico, asignacion_revisor_estilo, criterio_carga')
      .eq('id', project_id)
      .single();
    await autoAssignIfNeeded(admin, data, project);

    return res.status(201).json({ document: data });
  }

  throw new ApiError(405, 'Método no permitido');
});
