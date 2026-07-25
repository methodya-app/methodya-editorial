# MongoDB Atlas — Esquema de colecciones (METHODYA Beta)

Base de datos sugerida: `methodya`. No requiere creación manual de colecciones
(MongoDB las crea al primer insert), pero se recomienda crear los índices
indicados abajo desde MongoDB Atlas > Collections > Indexes, o ejecutando
`db/mongo_init.js` con `mongosh "<connection_string>" db/mongo_init.js`.

Todo lo que es "estructura flexible / cambia mucho" vive en Mongo. Todo lo
"transaccional / relacional" vive en Supabase (ver `supabase_schema.sql`).

## Colección `forms`
Definición (diseño) de un formulario asociado a un proyecto.

```json
{
  "_id": ObjectId,
  "project_id": "uuid-de-supabase",
  "titulo": "Clase de Biología - Unidad 2",
  "descripcion": "",
  "document_type_id": "uuid-de-supabase (opcional, tipo de documento por defecto)",
  "sections": [
    {
      "id": "sec_xxx",
      "titulo": "Información general",
      "fields": [
        {
          "id": "field_xxx",
          "label": "Nombre del recurso",
          "variable": "nombre_recurso",
          "type": "text | textarea | number | select | checkbox | predefined_paragraph | subform",
          "required": true,
          "placeholder": "",
          "options": ["..."],
          "paragraph_tags": ["..."],
          "subform_ids": ["ObjectId de subforms permitidos"],
          "allow_multiple_instances": true,
          "validation": {
            "enabled": true,
            "description": "texto en lenguaje natural usado para generar el regex",
            "pattern": "^regex$",
            "mode": "must_match | must_not_match",
            "min_length": null,
            "max_length": null,
            "generated_by_ai": true
          }
        }
      ]
    }
  ],
  "created_by": "uuid-de-supabase",
  "created_at": ISODate,
  "updated_at": ISODate
}
```

Índice recomendado: `{ project_id: 1 }`

## Colección `subforms`
Biblioteca reutilizable de subformularios (independiente de proyecto).

```json
{
  "_id": ObjectId,
  "nombre": "Ficha de video",
  "descripcion": "",
  "prefijo": "VID",
  "fields": [
    /* fields[0] siempre es el campo fijo Título (variable "titulo",
       type "text", required true) — lo agrega/protege el backend */
    /* resto: misma estructura que fields de forms */
  ],
  "created_by": "uuid",
  "created_at": ISODate
}
```

`prefijo`: máximo 5 caracteres, solo letras/números/`-`/`_`, se guarda en mayúsculas.
Se usa para construir el `codigo` de cada instancia de este subformulario
dentro de un documento (ver más abajo).

## Colección `paragraphs`
Biblioteca de párrafos predefinidos, filtrable por tags.

```json
{
  "_id": ObjectId,
  "titulo": "Contexto comunidades andinas",
  "texto": "En muchas comunidades andinas...",
  "tags": ["cultura", "andino", "economia"],
  "created_by": "uuid",
  "created_at": ISODate
}
```
Índice recomendado: `{ tags: 1 }`

## Colección `document_data`
Datos diligenciados de un documento concreto (1:1 con la fila `documents`
de Supabase, enlazado por `document_id`).

```json
{
  "_id": ObjectId,
  "document_id": "uuid-de-supabase",
  "form_id": "ObjectId de forms",
  "values": {
    "nombre_recurso": "texto capturado...",
    "campo_subform_x": {
      "subform_id": "ObjectId",
      "instances": [
        {
          "id": "uuid (generado en cliente, backfilled en el backend si falta)",
          "codigo": "código del documento + prefijo del subformulario + consecutivo, ej: G1-001-VID-1 (generado por el backend al guardar, no se reasigna una vez asignado)",
          "values": { "titulo": "texto obligatorio de toda instancia", "...": "..." }
        }
      ]
    }
  },
  "comments": [
    {
      "id": "uuid",
      "field_id": "field_xxx",
      "author_id": "uuid",
      "author_nombre": "María Pérez",
      "text": "Revisar el término 'sistema'",
      "mentions": ["uuid_usuario_etiquetado"],
      "resolved": false,
      "replies": [
        {
          "id": "uuid",
          "author_id": "uuid",
          "author_nombre": "Juan Gómez",
          "text": "Corregido, ya quedó como 'proceso'",
          "mentions": ["uuid_del_autor_del_comentario"],
          "resolves": true,
          "created_at": ISODate
        }
      ],
      "created_at": ISODate
    }
  ],
  "vaciado_resultado": "texto simulado, o link de Google Docs/Slides si el proyecto exporta a Google (o null)",
  "vaciado_drive_file_id": "id del archivo de Google Docs/Slides (o null)",
  "vaciado_pdf_resultado": "link del PDF en Drive, si el proyecto exporta a PDF (o null)",
  "vaciado_pdf_file_id": "id del archivo PDF en Drive (o null)",
  "updated_at": ISODate
}
```
Índice recomendado: `{ document_id: 1 }` (único)

## Colección `subform_assignments`
Una instancia de subformulario liberada al equipo multimedia como tarea
independiente (creada por `POST /documents/:id/subforms/release`).

```json
{
  "_id": ObjectId,
  "document_id": "uuid-de-supabase",
  "document_codigo": "G1-001",
  "project_id": "uuid-de-supabase",
  "field_variable": "campo_subform_x",
  "instance_id": "uuid (coincide con instances[].id en document_data)",
  "subform_id": "ObjectId de subforms",
  "subform_nombre": "Ficha de video",
  "subform_codigo": "G1-001-VID-1",
  "titulo": "valor del campo Título de esa instancia",
  "multimedia_role_id": "uuid-de-supabase (multimedia_roles)",
  "assigned_user_id": "uuid-de-supabase o null (disponible para tomar)",
  "estado": "Asignado | En proceso | Finalizado | Eliminado",
  "comments": [ /* mismo formato que document_data.comments */ ],
  "recursos": [
    {
      "id": "uuid",
      "nombre": "video_final.mp4",
      "drive_file_id": "id de Drive",
      "url": "webViewLink de Drive",
      "mime_type": "video/mp4",
      "size": 12345,
      "uploaded_by": "uuid",
      "uploaded_at": ISODate
    }
  ],
  "released_by": "uuid",
  "released_at": ISODate,
  "created_at": ISODate,
  "updated_at": ISODate
}
```
Índice recomendado: `{ document_id: 1, field_variable: 1, instance_id: 1 }` (evita liberar la misma instancia dos veces)

## Notas de diseño

- Mongo se accede únicamente desde las funciones serverless de `/api` con el
  driver oficial `mongodb`, usando el connection string de MongoDB Atlas
  (variable de entorno `MONGODB_URI`). El frontend nunca se conecta
  directamente a Mongo.
- Las validaciones (`validation.pattern`) se evalúan en el backend al guardar
  `document_data.values`, combinando: (a) el patrón del propio campo y
  (b) todas las `global_validations` activas del proyecto (tabla en Supabase).
- El "vaciamiento" (punto 2.1.4 del documento de la beta) en esta primera
  versión NO llama a la API real de Google Slides/Docs (requiere OAuth de
  Google Cloud, fuera de alcance de esta fase). En su lugar, si el proyecto
  tiene `plantilla_texto_simulado`, el backend reemplaza `{{variable}}` por
  los valores capturados y guarda el resultado en `vaciado_resultado` como
  simulación funcional del motor de reemplazo descrito en el documento.
