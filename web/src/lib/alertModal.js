// Reemplazo de window.alert(): un solo <AlertModal/> montado en la raíz de
// la app (ver App.jsx) se registra acá al montarse; showAlert() es la
// función que importa el resto del código, como un reemplazo directo de
// alert(mensaje). No usa contexto de React para no tener que envolver cada
// árbol de componentes que necesite mostrar un mensaje.
let _setState = null;

export function registerAlertModal(setState) {
  _setState = setState;
}

export function showAlert(mensaje, tipo = 'info') {
  if (!_setState) {
    // Nunca debería pasar (AlertModal se monta en App.jsx antes que
    // cualquier página), pero si pasara, no perder el mensaje.
    window.alert(mensaje);
    return;
  }
  _setState({ mensaje, tipo });
}
