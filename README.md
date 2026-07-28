# METHODYA — Beta

Primera versión funcional (light) de la plataforma de gestión editorial de
contenidos educativos METHODYA, según lo descrito en `descripcion version
beta.md`: 4 perfiles (Administrador, Creador Experto, Revisor Pedagógico,
Revisor de Estilo), proyectos, formularios dinámicos con validación por
expresión regular generada con IA, flujo editorial con estados y
comentarios, subformularios y párrafos predefinidos reutilizables,
validaciones globales por proyecto, cambios masivos y un motor de
"vaciamiento" simulado.

## Arquitectura

```
methodya-editorial/
├── api/             Backend: funciones serverless de Vercel (Node, ESM)
├── web/             Frontend: React + Vite + Tailwind, se despliega en GitHub Pages
├── db/              Esquema SQL de Supabase + esquema de colecciones de MongoDB
├── scripts/         Script de seed del usuario Administrador para desarrollo local
├── dev-server.js    Servidor local que enruta /api/* igual que Vercel (sin CLI/cuenta)
└── docker-compose.yml   MongoDB local (+ mongo-express) para desarrollo
```

- **Supabase (PostgreSQL)**: autenticación (Supabase Auth) y todo lo
  transaccional/relacional — perfiles, proyectos, usuarios por proyecto,
  documentos, historial de estados, validaciones globales, parámetros.
- **MongoDB Atlas**: todo lo de estructura flexible — definición de
  formularios (secciones/campos), biblioteca de subformularios, biblioteca
  de párrafos predefinidos, y los datos diligenciados de cada documento
  (valores de campos + comentarios).
- **Backend (Vercel Functions)**: única capa que habla con Supabase y con
  MongoDB. El frontend nunca se conecta directamente a ninguna base de
  datos; todo pasa por `/api/*`. También aquí vive la integración con
  Google Gemini para traducir lenguaje natural a expresiones regulares.
- **Frontend (GitHub Pages)**: sitio estático (React + Vite), usa
  `HashRouter` para funcionar sin configuración de servidor en Pages.

## Alcance de esta beta (y lo que queda para la siguiente fase)

Incluido: los 4 perfiles y sus flujos, Proyectos, Formularios (con
secciones, 7 tipos de campo incluyendo *Párrafo predefinido* y
*Sub-formulario*), validación de campo por regex manual o generada con IA,
Validaciones Globales del proyecto, Documentos con flujo de estados y
comentarios estilo Word/Google Docs, Cambios Masivos, biblioteca de
Subformularios y de Párrafos, Usuarios, Parámetros del servidor.

**NO incluido en esta fase** (se simula o se deja preparado, ver
`db/mongo_schema.md`): la integración real con la API de Google
Slides/Docs para el "vaciamiento" (requiere credenciales OAuth de Google
Cloud); en su lugar se implementó el mismo motor de reemplazo de
`{{variable}}` operando sobre un texto de plantilla configurado
manualmente por proyecto, para que el módulo sea funcional de extremo a
extremo sin esa integración.

---

## Modo A — Correr todo en local (recomendado antes de desplegar)

Puedes probar la aplicación completa en tu máquina, sustituyendo las tres
piezas de nube por sus equivalentes locales, sin necesidad de cuenta en
Vercel, Supabase Cloud ni MongoDB Atlas:

| Pieza de nube | Sustituto local |
|---|---|
| Vercel Functions | `dev-server.js` (Node puro, incluido en este repo) |
| Supabase Cloud | Supabase CLI + Docker (`supabase start`) |
| MongoDB Atlas | Mongo en Docker (`docker-compose.yml` incluido) |
| GitHub Pages | `npm run dev` de Vite |

### Requisitos

- Node.js 20+
- Docker Desktop (o Docker Engine) corriendo
- Supabase CLI: no hace falta instalarla globalmente, se usa con `npx supabase`

### Pasos

**1. Levantar Supabase local**

```bash
npx supabase init      # solo la primera vez, crea la carpeta supabase/
npx supabase start     # descarga y levanta Postgres + Auth + Studio en Docker
```

Al terminar, el comando imprime algo como:

```
API URL: http://localhost:54321
anon key: eyJhbGciOi...
service_role key: eyJhbGciOi...
Studio URL: http://localhost:54323
```

Guarda esos tres valores, los necesitas en el paso 3.

**2. Aplicar el esquema SQL**

Abre `http://localhost:54323` (Supabase Studio local) → **SQL Editor** →
pega y ejecuta el contenido completo de `db/supabase_schema.sql`. (También
puedes hacerlo con `npx supabase db execute -f db/supabase_schema.sql`.)

**3. Levantar MongoDB local**

```bash
docker compose up -d
```

Esto deja Mongo en `localhost:27017` y una interfaz web en
`http://localhost:8081` (mongo-express) para inspeccionar las colecciones.

**4. Configurar variables y crear el usuario Administrador**

```bash
cp .env.local.example .env.local
# edita .env.local: pega la API URL / anon key / service_role key del paso 1

npm install
npm run seed:local
```

Esto crea el usuario `admin@methodya.local` / `Methodya2026!` (o los que
hayas puesto en `SEED_ADMIN_*` dentro de `.env.local`) ya con perfil de
Administrador.

**5. Levantar el backend**

```bash
npm run dev
```

Arranca `dev-server.js` en `http://localhost:3000`, enrutando `/api/*`
exactamente igual que lo haría Vercel (incluye las rutas dinámicas `[id]`),
leyendo las variables de `.env.local`.

**6. Levantar el frontend**

```bash
cd web
npm install
cp .env.example .env   # ya trae VITE_API_BASE_URL=http://localhost:3000
npm run dev
```

Abre la URL que imprime Vite (normalmente `http://localhost:5173`) e inicia
sesión con el usuario creado en el paso 4.

Con esto tienes el flujo completo probado en local. Cuando quieras
compartirlo con el primer cliente real, sigue el **Modo B** de abajo: solo
tienes que repetir el mismo `supabase_schema.sql` en un proyecto de
Supabase Cloud y apuntar `MONGODB_URI` a un clúster de Atlas — el código de
`/api` y `/web` no cambia en absoluto.

---

## Modo B — Desplegar a producción (Supabase Cloud + MongoDB Atlas + Vercel + GitHub Pages)

### 1. Crear el proyecto en Supabase

1. Crea una cuenta/proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor** y ejecuta el contenido completo de `db/supabase_schema.sql`.
3. Ve a **Authentication > Providers** y confirma que "Email" esté habilitado
   (por defecto lo está). Desactiva la confirmación por correo si quieres
   poder crear usuarios de prueba sin verificar email (Authentication >
   Settings > "Confirm email").
4. Ve a **Project Settings > API** y copia:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (¡mantenla secreta!)
5. Crea tu primer usuario Administrador:
   - Ve a **Authentication > Users > Add user**, crea el usuario con correo
     y clave.
   - Ve a **Table Editor > profiles** y agrega una fila con ese mismo `id`
     (cópialo del usuario creado), `email`, `nombre`, `apellido`, y
     `is_admin = true`.

### 2. Crear el clúster en MongoDB Atlas

1. Crea una cuenta/clúster gratuito en [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. En **Database Access**, crea un usuario de base de datos con permisos de
   lectura/escritura.
3. En **Network Access**, agrega `0.0.0.0/0` (o las IPs salientes de Vercel)
   para que el backend pueda conectarse.
4. En **Database > Connect > Drivers**, copia el connection string →
   `MONGODB_URI`. La base de datos se llama `methodya` (o cambia
   `MONGODB_DB`).
5. Opcional: ejecuta `db/mongo_init.js` con `mongosh` para crear los índices
   recomendados (ver `db/mongo_schema.md`).

### 3. Obtener una clave de Google Gemini

1. Ve a [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
   y genera una API key → `GEMINI_API_KEY`.
2. Si no configuras esta clave, el generador de expresiones regulares sigue
   funcionando con una heurística local de respaldo (menos precisa, pero
   nunca deja el módulo bloqueado).

### 4. Desplegar el backend en Vercel

1. Sube este repositorio a GitHub.
2. En [vercel.com](https://vercel.com), **Add New > Project**, importa el
   repositorio.
3. **Root Directory**: deja la raíz del repo (donde está `vercel.json` y el
   `package.json` con las dependencias de `api/`).
4. **Framework Preset**: "Other". Build Command y Output Directory: vacíos
   (no aplica, son solo funciones).
5. En **Environment Variables**, agrega todas las de `.env.example`:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`,
   `MONGODB_URI`, `MONGODB_DB`, `GEMINI_API_KEY`, `GEMINI_MODEL`,
   `ALLOWED_ORIGIN` (la URL de tu GitHub Pages, ver paso 5).
6. Despliega. Anota la URL resultante, ej.
   `https://methodya-editorial-api.vercel.app`.

### 5. Desplegar el frontend en GitHub Pages

1. En el repositorio de GitHub: **Settings > Pages > Build and deployment >
   Source: GitHub Actions**.
2. En **Settings > Secrets and variables > Actions > New repository
   secret**, crea `VITE_API_BASE_URL` con la URL de Vercel del paso 4 (sin
   slash final).
3. Haz push a `main` (o ejecuta el workflow manualmente desde la pestaña
   Actions): `.github/workflows/deploy-pages.yml` compila `web/` y publica
   `web/dist` en Pages automáticamente.
4. Tu app quedará en `https://tu-usuario.github.io/tu-repo/`.
5. Vuelve a Vercel y actualiza `ALLOWED_ORIGIN` con esa URL exacta (para que
   el backend acepte peticiones CORS del frontend), y vuelve a desplegar.

### 6. Primer uso

1. Entra a la URL de GitHub Pages e inicia sesión con el usuario
   Administrador que creaste en el paso 1.
2. Como Administrador: crea Tipos de documento (o usa los que vienen por
   defecto), crea un Proyecto, dentro de él crea un Formulario (agrega
   secciones y campos), crea usuarios con perfil Creador
   Experto/Revisor Pedagógico/Revisor de Estilo y asígnalos al proyecto,
   y finalmente crea un Documento indicando el formulario y los tres
   responsables.
3. Cada usuario, al iniciar sesión, verá en "Mis proyectos" únicamente los
   proyectos donde tiene documentos asignados, y podrá diligenciar/revisar
   según su rol.

## Alternativa: `vercel dev` en vez de `dev-server.js`

Si prefieres usar directamente la CLI oficial de Vercel en local (requiere
`npm i -g vercel` y `vercel login`, es decir, sí necesita cuenta de Vercel
aunque no despliegues nada), también funciona sin cambiar código:

```bash
npm install
npx vercel dev   # sirve /api en http://localhost:3000, lee .env.local igual
```

`dev-server.js` (Modo A) existe justamente para poder probar todo sin crear
ninguna cuenta en la nube; usa el que prefieras, ambos exponen la misma API
en el mismo puerto.

## Notas de seguridad

- El frontend nunca ve las claves de Supabase (service role) ni de Mongo ni
  de Gemini: todas viven como variables de entorno del backend (`.env.local`
  en desarrollo, variables de entorno de Vercel en producción).
- RLS de Supabase está activado sin políticas: solo la Service Role Key
  (usada exclusivamente por el backend) puede leer/escribir. Es una postura
  deliberadamente restrictiva para una beta; en producción conviene además
  restringir `ALLOWED_ORIGIN` y considerar rate limiting.
- `.env.local`, `.env` y la carpeta `supabase/` que genera `supabase init`
  están en `.gitignore`: no se suben al repositorio.
