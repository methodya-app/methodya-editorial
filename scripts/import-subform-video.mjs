import { MongoClient, ObjectId } from 'mongodb';

// Inserta el subformulario "Video" (con su tabla dinámica de escenas y la
// validación de formato por columna) en la base de Mongo que indiquen las
// variables de entorno, para no tener que recrearlo campo por campo en
// cada ambiente.
//
// Uso (PowerShell, desde la raíz del repo):
//   $env:MONGODB_URI="<uri del cluster>"; $env:MONGODB_DB="methodya_staging"; node scripts/import-subform-video.mjs
//
// Es idempotente: si ya existe un subformulario con ese id o con ese
// nombre, no hace nada (no duplica ni sobrescribe).

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

if (!uri || !dbName) {
  console.error('Faltan MONGODB_URI y/o MONGODB_DB. Ver el encabezado de este archivo.');
  process.exit(1);
}

// Mismo id que en los demás ambientes, a propósito (ver comentario arriba).
const SUBFORM_ID = '6a5f0fc296581e812f7edd58';

const SUBFORM = {
    "nombre": "Video",
    "descripcion": "",
    "fields": [
      {
        "id": "field_titulo",
        "label": "Título",
        "variable": "titulo",
        "type": "text",
        "required": true,
        "placeholder": "",
        "instrucciones": "Escribe un título breve que identifique esta instancia (ej: nombre del recurso).",
        "options": [],
        "validation": {
          "enabled": false,
          "description": "",
          "pattern": "",
          "mode": "must_match",
          "min_length": "",
          "max_length": "",
          "custom_message": ""
        }
      },
      {
        "id": "field_1784614854880_6ixh",
        "label": "Objetivo",
        "variable": "objetivo_video",
        "type": "text",
        "required": true,
        "placeholder": "",
        "options": [],
        "validation": {
          "enabled": false,
          "description": "",
          "pattern": "",
          "mode": "must_match",
          "min_length": "",
          "max_length": "",
          "custom_message": ""
        },
        "instrucciones": "Describe brevemente qué se busca lograr con este video."
      },
      {
        "id": "field_1784614895995_fo7y",
        "label": "Duracion",
        "variable": "duracion_video",
        "type": "text",
        "required": true,
        "placeholder": "",
        "options": [],
        "validation": {
          "enabled": true,
          "description": "el valor debe ser en formato de hora, definienda la duracion en minutos y segundos mm:ss",
          "pattern": "^([0-5]\\d):([0-5]\\d)$",
          "mode": "must_match",
          "min_length": "",
          "max_length": "",
          "custom_message": "Debes usar formato de minutos y segundos mm:ss",
          "generated_by_ai": false
        },
        "instrucciones": "Duración estimada del video, en formato minutos:segundos (mm:ss)."
      },
      {
        "id": "field_1784615122567_xmat",
        "label": "Sugerencias (opcional)",
        "variable": "sugerencias_video",
        "type": "text",
        "required": false,
        "placeholder": "",
        "options": [],
        "validation": {
          "enabled": false,
          "description": "",
          "pattern": "",
          "mode": "must_match",
          "min_length": "5",
          "max_length": "150",
          "custom_message": ""
        },
        "instrucciones": "Sugerencias adicionales de estilo o enfoque para el video (opcional)."
      },
      {
        "id": "field_1784615156379_hns0",
        "label": "Titulo del video",
        "variable": "titulo_video",
        "type": "text",
        "required": true,
        "placeholder": "",
        "options": [],
        "validation": {
          "enabled": false,
          "description": "",
          "pattern": "",
          "mode": "must_match",
          "min_length": "5",
          "max_length": "150",
          "custom_message": ""
        },
        "instrucciones": "Título con el que se identificará este video."
      },
      {
        "id": "field_1784615184642_rpef",
        "label": "Escenas",
        "variable": "escena1",
        "type": "tabla_dinamica",
        "required": true,
        "placeholder": "Describe duración , video y audio en cada escena",
        "options": [],
        "validation": {
          "enabled": false,
          "description": "",
          "pattern": "",
          "mode": "must_match",
          "min_length": "10",
          "max_length": "500",
          "custom_message": ""
        },
        "columnas": [
          {
            "id": "col_1785295676308_2cqw",
            "etiqueta": "Escena/tiempo",
            "variable": "escena_tiempo",
            "tipo": "text",
            "validation": {
              "enabled": true,
              "pattern": "^Escena \\d+ \\(\\d{1,2}:\\d{2}-\\d{1,2}:\\d{2}\\)$",
              "custom_message": "Usa el formato: Escena N (m:ss-m:ss), ej: Escena 1 (0:00-0:10)."
            }
          },
          {
            "id": "col_1785295704110_26ci",
            "etiqueta": "Audio (Narración)",
            "variable": "audio_narracion",
            "tipo": "textarea"
          },
          {
            "id": "col_1785295732795_kb40",
            "etiqueta": "Apoyo gráfico (Qué se ve en pantalla)",
            "variable": "apoyo_grafico",
            "tipo": "textarea"
          }
        ],
        "max_filas": "12",
        "instrucciones": "Agrega una fila por cada escena del video, en orden. Indica el tiempo aproximado, la narración/audio y qué se debe ver en pantalla en esa escena."
      }
    ],
    "created_by": null,
    "prefijo": "VID"
  };

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);
const coleccion = db.collection('subforms');

const existente =
  (await coleccion.findOne({ _id: new ObjectId(SUBFORM_ID) })) ||
  (await coleccion.findOne({ nombre: SUBFORM.nombre }));

if (existente) {
  console.log(`Ya existe el subformulario "${existente.nombre}" en ${dbName}; no se hizo nada.`);
} else {
  await coleccion.insertOne({ _id: new ObjectId(SUBFORM_ID), ...SUBFORM, created_at: new Date() });
  console.log(`Subformulario "${SUBFORM.nombre}" insertado en ${dbName} (${SUBFORM.fields.length} campos).`);
}

await client.close();
