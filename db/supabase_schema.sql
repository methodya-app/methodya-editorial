-- =====================================================================
-- METHODYA BETA - Esquema Supabase (PostgreSQL)
-- Ejecutar completo en: Supabase Dashboard > SQL Editor > New query
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PERFILES (extiende auth.users de Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  apellido text not null,
  email text not null unique,
  is_admin boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. PROYECTOS
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  fecha_inicio date,
  fecha_fin date,
  estado text not null default 'Pendiente'
    check (estado in ('Pendiente','Activo','Detenido','Finalizado','Eliminado')),
  plantilla_tipo text check (plantilla_tipo in ('slides','docs')),
  plantilla_url text,
  drive_folder_url text,
  plantilla_texto_simulado text, -- texto base con {{variables}} usado para simular el "vaciamiento" (Fase 1, sin API real de Google)
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un proyecto Detenido/Finalizado/Eliminado implica documentos de solo lectura (se valida en la API)

-- ---------------------------------------------------------------------
-- 3. USUARIOS POR PROYECTO (rol depende del proyecto)
-- ---------------------------------------------------------------------
create table if not exists public.project_users (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('Creador Experto','Revisor Pedagógico','Revisor de Estilo')),
  created_at timestamptz not null default now(),
  unique(project_id, user_id, role)
);

-- ---------------------------------------------------------------------
-- 4. TIPOS DE DOCUMENTO (tipificación administrable)
-- ---------------------------------------------------------------------
create table if not exists public.document_types (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.document_types (nombre) values
  ('Guía de diseño'), ('Manual de usuario'), ('Curso'), ('Clase'),
  ('Guía metodológica'), ('Guía paso a paso'), ('Formulario de recurso')
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------
-- 5. VALIDACIONES GLOBALES DEL PROYECTO
--    Se aplican a TODOS los campos de TODOS los formularios del proyecto,
--    además de la validación propia de cada campo.
--    mode = 'must_not_match' (ej. lista negra de palabras) o 'must_match'
-- ---------------------------------------------------------------------
create table if not exists public.global_validations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  descripcion text not null,
  pattern text not null,
  mode text not null default 'must_not_match' check (mode in ('must_match','must_not_match')),
  activo boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. DOCUMENTOS
--    form_id y sub_data viven en MongoDB (colección document_data);
--    aquí solo se guarda el estado transaccional / asignaciones / auditoría.
-- ---------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  codigo text not null,
  document_type_id uuid references public.document_types(id),
  form_id text not null, -- ObjectId de MongoDB (colección forms)
  estado text not null default 'Pendiente' check (estado in (
    'Pendiente','En proceso','Devuelto','Revisión Pedagógica',
    'Revisión Estilo','Producción Multimedia','Detenido','Finalizado','Eliminado'
  )),
  creador_id uuid references public.profiles(id),
  revisor_pedagogico_id uuid references public.profiles(id),
  revisor_estilo_id uuid references public.profiles(id),
  vaciado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, codigo)
);

create index if not exists idx_documents_project on public.documents(project_id);
create index if not exists idx_documents_creador on public.documents(creador_id);
create index if not exists idx_documents_rev_pedagogico on public.documents(revisor_pedagogico_id);
create index if not exists idx_documents_rev_estilo on public.documents(revisor_estilo_id);

-- ---------------------------------------------------------------------
-- 7. HISTORIAL / TRAZA DE ESTADOS (auditoría simple)
-- ---------------------------------------------------------------------
create table if not exists public.document_history (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  estado_anterior text,
  estado_nuevo text not null,
  actor_id uuid references public.profiles(id),
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists idx_history_document on public.document_history(document_id);

-- ---------------------------------------------------------------------
-- 8. PARÁMETROS DEL SERVIDOR (fila única, editable por Administrador)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id int primary key default 1,
  gemini_api_key text,
  backend_endpoint text,
  languagetool_username text,
  languagetool_api_key text,
  -- Validación ortográfica automática al enviar un documento a la siguiente
  -- etapa: 'off' (no valida), 'warn' (avisa pero permite continuar) o
  -- 'block' (no deja avanzar hasta revisar los campos señalados).
  spellcheck_submit_mode text not null default 'off'
    check (spellcheck_submit_mode in ('off','warn','block')),
  -- Conexión OAuth2 con Google (Drive/Docs/Slides) para el vaciamiento real
  -- de plantillas: client_id/secret del OAuth Client de Google Cloud, y el
  -- refresh_token obtenido al conectar una cuenta de Google desde
  -- Parámetros del servidor (botón "Conectar cuenta de Google").
  google_oauth_client_id text,
  google_oauth_client_secret text,
  google_oauth_refresh_token text,
  google_oauth_connected_email text,
  google_oauth_pending_state text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

-- Por si la tabla ya existía de una instalación previa (create table if not
-- exists no agrega columnas nuevas a una tabla ya creada).
alter table public.settings add column if not exists languagetool_username text;
alter table public.settings add column if not exists languagetool_api_key text;
alter table public.settings add column if not exists spellcheck_submit_mode text not null default 'off';
alter table public.settings drop constraint if exists settings_spellcheck_submit_mode_check;
alter table public.settings add constraint settings_spellcheck_submit_mode_check
  check (spellcheck_submit_mode in ('off','warn','block'));
alter table public.settings drop column if exists google_service_account_email;
alter table public.settings drop column if exists google_service_account_private_key;
alter table public.settings add column if not exists google_oauth_client_id text;
alter table public.settings add column if not exists google_oauth_client_secret text;
alter table public.settings add column if not exists google_oauth_refresh_token text;
alter table public.settings add column if not exists google_oauth_connected_email text;
alter table public.settings add column if not exists google_oauth_pending_state text;

insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 9. ASIGNACIÓN GRUPAL POR ROL
--    Cuando un documento no tiene a nadie asignado en el campo que le
--    corresponde según su estado (creador_id / revisor_pedagogico_id /
--    revisor_estilo_id), este modo decide qué pasa: queda disponible para
--    que cualquiera con ese rol lo tome ('manual'), se asigna solo a quien
--    tenga menos carga ('carga'), o se asigna al azar ('aleatoria').
-- ---------------------------------------------------------------------
alter table public.projects add column if not exists asignacion_creador text not null default 'manual';
alter table public.projects add column if not exists asignacion_revisor_pedagogico text not null default 'manual';
alter table public.projects add column if not exists asignacion_revisor_estilo text not null default 'manual';
-- Qué cuenta como "carga" para el modo 'carga': solo documentos activos
-- (no Finalizado/Eliminado) o todo el histórico asignado a esa persona.
alter table public.projects add column if not exists criterio_carga text not null default 'activos';

alter table public.projects drop constraint if exists projects_asignacion_creador_check;
alter table public.projects add constraint projects_asignacion_creador_check
  check (asignacion_creador in ('manual','carga','aleatoria'));
alter table public.projects drop constraint if exists projects_asignacion_revisor_pedagogico_check;
alter table public.projects add constraint projects_asignacion_revisor_pedagogico_check
  check (asignacion_revisor_pedagogico in ('manual','carga','aleatoria'));
alter table public.projects drop constraint if exists projects_asignacion_revisor_estilo_check;
alter table public.projects add constraint projects_asignacion_revisor_estilo_check
  check (asignacion_revisor_estilo in ('manual','carga','aleatoria'));
alter table public.projects drop constraint if exists projects_criterio_carga_check;
alter table public.projects add constraint projects_criterio_carga_check
  check (criterio_carga in ('activos','historico'));

-- ---------------------------------------------------------------------
-- 10. FORMATO DE EXPORTACIÓN DEL VACIAMIENTO
--    Además de la copia en Google Docs/Slides, se puede generar también
--    (o en cambio) una copia en PDF, usando la exportación nativa de
--    Google Drive sobre esa misma copia ya rellenada.
-- ---------------------------------------------------------------------
alter table public.projects add column if not exists vaciado_formato text not null default 'google';
alter table public.projects drop constraint if exists projects_vaciado_formato_check;
alter table public.projects add constraint projects_vaciado_formato_check
  check (vaciado_formato in ('google','pdf','ambos'));

-- ---------------------------------------------------------------------
-- 11. EQUIPO MULTIMEDIA
--    Roles multimedia (catálogo global, ej. "Diseñador videos multimedia"),
--    asociados a qué plantillas de subformulario puede trabajar cada uno.
--    La membresía (quién tiene cada rol, y quién es Coordinador Multimedia)
--    es por proyecto, igual que project_users, pero en tabla aparte porque
--    el catálogo de roles es dinámico (no un check fijo de 3 valores).
-- ---------------------------------------------------------------------
create table if not exists public.multimedia_roles (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  subform_ids text[] not null default '{}', -- ObjectId (string) de subforms en Mongo
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.multimedia_roles (nombre) values
  ('Diseñador videos multimedia'), ('Diseñador imágenes multimedia')
on conflict (nombre) do nothing;

create table if not exists public.multimedia_project_users (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  es_coordinador boolean not null default false,
  multimedia_role_id uuid references public.multimedia_roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint multimedia_project_users_role_xor check (
    (es_coordinador and multimedia_role_id is null) or
    (not es_coordinador and multimedia_role_id is not null)
  ),
  unique(project_id, user_id, multimedia_role_id)
);

create index if not exists idx_mpu_project on public.multimedia_project_users(project_id);
create index if not exists idx_mpu_user on public.multimedia_project_users(user_id);
create unique index if not exists idx_mpu_coordinador_unico
  on public.multimedia_project_users(project_id, user_id) where es_coordinador;

-- Modo de asignación (manual/carga/aleatoria) por rol multimedia y proyecto,
-- mismo mecanismo que ya existe para Creador/Revisor (ver sección 9); el
-- criterio de carga (activos/histórico) reutiliza projects.criterio_carga.
create table if not exists public.multimedia_role_assignment_config (
  project_id uuid not null references public.projects(id) on delete cascade,
  multimedia_role_id uuid not null references public.multimedia_roles(id) on delete cascade,
  modo text not null default 'manual' check (modo in ('manual','carga','aleatoria')),
  primary key (project_id, multimedia_role_id)
);

-- =====================================================================
-- Nota sobre RLS: en esta beta el acceso a datos se realiza EXCLUSIVAMENTE
-- a través de las funciones serverless de Vercel usando la Service Role Key
-- de Supabase (nunca se expone la base de datos directamente al navegador).
-- Por eso no se definen políticas RLS de lectura pública; se deja Row Level
-- Security activado por defecto y sin políticas, de forma que ninguna
-- petición directa desde el cliente con la anon key pueda leer ni escribir.
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_users enable row level security;
alter table public.document_types enable row level security;
alter table public.global_validations enable row level security;
alter table public.documents enable row level security;
alter table public.document_history enable row level security;
alter table public.settings enable row level security;
alter table public.multimedia_roles enable row level security;
alter table public.multimedia_project_users enable row level security;
alter table public.multimedia_role_assignment_config enable row level security;
-- (Sin policies = sin acceso vía anon key; solo la Service Role Key del backend puede operar)

-- Nota: en versiones recientes del CLI de Supabase, las tablas nuevas ya NO se
-- exponen automáticamente a los roles de la API (antes sí, por defecto). Sin
-- estos GRANT explícitos, la Service Role Key recibe "permission denied" al
-- usarla desde supabase-js (aunque haga bypass de RLS, igual necesita el
-- privilegio SQL sobre la tabla).
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
