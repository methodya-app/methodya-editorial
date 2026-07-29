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

// Las instrucciones de diligenciamiento son obligatorias en todo campo: le
// dicen tanto a un Creador Experto humano como a un agente sintético qué se
// espera diligenciar ahí, sin depender solo de interpretar la etiqueta.
export function findFieldsMissingInstrucciones(fields) {
  return (fields || []).filter((f) => !f.instrucciones?.trim());
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
