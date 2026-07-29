// Valida un valor de campo contra: (1) su propia regla y (2) las validaciones
// globales del proyecto. Se usa tanto en el frontend (UX inmediata) como aquí
// en el backend (fuente de verdad, nunca confiar solo en el cliente).

export function validateFieldValue(field, value, globalValidations = []) {
  const errors = [];
  const strValue = Array.isArray(value) ? value.join(', ') : String(value ?? '');

  if (field.required) {
    const empty =
      value === undefined ||
      value === null ||
      strValue.trim() === '' ||
      (Array.isArray(value) && value.length === 0);
    if (empty) errors.push('Este campo es obligatorio.');
  }

  if (field.type === 'tabla_dinamica' && Array.isArray(value)) {
    if (field.max_filas && value.length > Number(field.max_filas)) {
      errors.push(`Máximo ${field.max_filas} filas.`);
    }
    errors.push(...validateTableRows(field.columnas || [], value));
  }

  const v = field.validation;
  if (v?.enabled) {
    if (v.min_length && strValue.length < Number(v.min_length)) {
      errors.push(`La longitud mínima es de ${v.min_length} caracteres.`);
    }
    if (v.max_length && strValue.length > Number(v.max_length)) {
      errors.push(`La longitud máxima permitida es de ${v.max_length} caracteres.`);
    }
    if (v.pattern) {
      const ok = testPattern(v.pattern, strValue, v.mode || 'must_match');
      if (!ok) {
        errors.push(
          v.custom_message?.trim() || `No cumple la regla de validación: ${v.description || 'formato inválido'}`
        );
      }
    }
  }

  for (const gv of globalValidations) {
    if (!gv.activo) continue;
    const ok = testPattern(gv.pattern, strValue, gv.mode || 'must_not_match');
    if (!ok) {
      errors.push(`Validación global incumplida: ${gv.descripcion}`);
    }
  }

  return errors;
}

// El mensaje de error personalizado es obligatorio para cualquier campo que
// tenga la validación activa (regex/longitud), para no mostrarle al usuario
// el mensaje genérico de fallback.
export function findFieldsMissingCustomMessage(fields) {
  return (fields || []).filter((f) => f.validation?.enabled && !f.validation?.custom_message?.trim());
}

// Cada columna de una tabla dinámica puede tener su propia validación (igual
// forma que la de un campo normal); si está activa, también necesita su
// propio mensaje de error personalizado.
export function findTableColumnsMissingCustomMessage(fields) {
  return (fields || []).filter(
    (f) =>
      f.type === 'tabla_dinamica' &&
      (f.columnas || []).some((c) => c.validation?.enabled && !c.validation?.custom_message?.trim())
  );
}

// Valida cada celda de cada fila contra la regla de su columna (si la tiene
// activa). Los mensajes incluyen el número de fila y la columna para que se
// pueda ubicar el error dentro de la tabla.
function validateTableRows(columnas, rows) {
  const errors = [];
  rows.forEach((row, rowIdx) => {
    columnas.forEach((col) => {
      const v = col.validation;
      if (!v?.enabled) return;
      const cellValue = String(row?.[col.variable] ?? '');
      if (v.min_length && cellValue.length < Number(v.min_length)) {
        errors.push(`Fila ${rowIdx + 1}, ${col.etiqueta}: la longitud mínima es de ${v.min_length} caracteres.`);
      }
      if (v.max_length && cellValue.length > Number(v.max_length)) {
        errors.push(`Fila ${rowIdx + 1}, ${col.etiqueta}: la longitud máxima permitida es de ${v.max_length} caracteres.`);
      }
      if (v.pattern) {
        const ok = testPattern(v.pattern, cellValue, v.mode || 'must_match');
        if (!ok) {
          errors.push(
            `Fila ${rowIdx + 1}, ${col.etiqueta}: ${
              v.custom_message?.trim() || `no cumple la regla de validación: ${v.description || 'formato inválido'}`
            }`
          );
        }
      }
    });
  });
  return errors;
}

// Las instrucciones de diligenciamiento son obligatorias en todo campo: le
// dicen tanto a un Creador Experto humano como a un agente sintético qué se
// espera diligenciar ahí, sin depender solo de interpretar la etiqueta.
export function findFieldsMissingInstrucciones(fields) {
  return (fields || []).filter((f) => !f.instrucciones?.trim());
}

// Un campo "tabla_dinamica" (ver FieldEditor.jsx) necesita al menos una
// columna, y cada columna necesita etiqueta + variable propias (no pueden
// repetirse entre sí dentro de la misma tabla: son las claves de cada fila
// guardada en document_data.values).
export function findInvalidTableFields(fields) {
  return (fields || []).filter((f) => {
    if (f.type !== 'tabla_dinamica') return false;
    const columnas = f.columnas || [];
    if (columnas.length === 0) return true;
    if (columnas.some((c) => !c.etiqueta?.trim() || !c.variable?.trim())) return true;
    const variables = columnas.map((c) => c.variable);
    return new Set(variables).size !== variables.length;
  });
}

// Reglas de límite de instancias de subformulario por tipo, definidas a
// nivel de TODO el formulario (ver FormBuilder.jsx: "Límites de
// subformularios"), no por campo — porque el mismo tipo de subformulario
// (ej: "Video") puede usarse desde más de un campo/sección, y el límite debe
// contar todas las instancias juntas dentro de su alcance.
export function findInvalidSubformLimits(limites) {
  return (limites || []).filter((l) => !l.subform_id || !l.maximo || Number(l.maximo) < 1);
}

// Cuenta las instancias de subformulario por tipo, agrupadas por campo y
// sección, y las compara contra cada regla de `form.limites_subformularios`.
// Alcance "formulario" = suma en todo el formulario; "seccion" = cada
// sección se evalúa por separado contra el mismo máximo. Los errores se
// asocian a cada campo que aporta instancias del tipo que se pasó del
// límite, para que se vean justo donde se están agregando.
export function validateSubformLimits(form, values) {
  const rules = form?.limites_subformularios || [];
  if (rules.length === 0) return {};

  const entries = [];
  for (const section of form.sections || []) {
    for (const field of section.fields || []) {
      if (field.type !== 'subform') continue;
      const fv = values?.[field.variable];
      if (!fv?.subform_id) continue;
      entries.push({
        sectionId: section.id,
        variable: field.variable,
        subformId: fv.subform_id,
        count: Array.isArray(fv.instances) ? fv.instances.length : 0,
      });
    }
  }

  const errors = {};
  const addError = (variable, message) => {
    errors[variable] = errors[variable] || [];
    errors[variable].push(message);
  };

  for (const rule of rules) {
    const matching = entries.filter((e) => e.subformId === rule.subform_id);
    if (matching.length === 0) continue;
    const nombre = rule.subform_nombre || 'este subformulario';
    const maximo = Number(rule.maximo);

    if (rule.alcance === 'seccion') {
      const bySection = new Map();
      for (const e of matching) {
        bySection.set(e.sectionId, [...(bySection.get(e.sectionId) || []), e]);
      }
      for (const group of bySection.values()) {
        const total = group.reduce((sum, e) => sum + e.count, 0);
        if (total > maximo) {
          group.forEach((e) =>
            addError(e.variable, `Máximo ${maximo} instancias de "${nombre}" por sección (hay ${total} en esta sección).`)
          );
        }
      }
    } else {
      const total = matching.reduce((sum, e) => sum + e.count, 0);
      if (total > maximo) {
        matching.forEach((e) =>
          addError(e.variable, `Máximo ${maximo} instancias de "${nombre}" en todo el formulario (hay ${total}).`)
        );
      }
    }
  }

  return errors;
}

// El nombre de variable ({{variable}}) identifica el campo dentro de los
// valores diligenciados y de la plantilla de vaciamiento: no puede repetirse
// dentro del mismo formulario (o subformulario).
export function findDuplicateVariables(fields) {
  const counts = new Map();
  for (const f of fields || []) {
    if (!f.variable) continue;
    counts.set(f.variable, (counts.get(f.variable) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([variable]) => variable);
}

function testPattern(pattern, value, mode) {
  try {
    const rx = new RegExp(pattern, 'i');
    const matches = rx.test(value);
    return mode === 'must_not_match' ? !matches : matches;
  } catch {
    // patrón inválido: no bloquear al usuario por un error de configuración
    return true;
  }
}
