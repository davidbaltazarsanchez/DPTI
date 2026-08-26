(() => {
  "use strict";
  const cliente = window.supabaseClient;
  const porId = (id) => document.getElementById(id);
  const elementos = {
    verificando: porId("contrasena-verificando"), invalido: porId("contrasena-invalido"),
    contenido: porId("contrasena-formulario-contenido"), form: porId("contrasena-form"),
    nueva: porId("contrasena-nueva"), confirmar: porId("contrasena-confirmar"),
    mostrar: porId("contrasena-mostrar"), mensaje: porId("contrasena-mensaje"), guardar: porId("contrasena-guardar"),
  };
  let procesando = false;
  function registrarError(contexto, error) { console.error(`[Establecer contraseña] ${contexto}`, { codigo: error?.code ?? "desconocido" }); }
  function mostrarMensaje(mensaje = "") { elementos.mensaje.textContent = mensaje; elementos.mensaje.hidden = !mensaje; }
  function formularioValido() { return elementos.nueva.value.length >= 8 && elementos.nueva.value === elementos.confirmar.value && !procesando; }
  function actualizarBoton() { elementos.guardar.disabled = !formularioValido(); }
  function mostrarEnlaceInvalido() { elementos.verificando.hidden = true; elementos.contenido.hidden = true; elementos.invalido.hidden = false; }
  function limpiarUrl() { window.history.replaceState({}, document.title, window.location.pathname); }
  async function esperarSession() {
    const { data, error } = await cliente.auth.getSession();
    if (error) throw error;
    if (data.session) return data.session;
    return new Promise((resolve) => {
      let terminado = false;
      let suscripcion;
      let temporizador;
      const finalizar = (session) => { if (terminado) return; terminado = true; window.clearTimeout(temporizador); suscripcion?.unsubscribe(); resolve(session ?? null); };
      const { data: listener } = cliente.auth.onAuthStateChange((evento, session) => { if (session && ["SIGNED_IN", "PASSWORD_RECOVERY", "INITIAL_SESSION"].includes(evento)) finalizar(session); });
      suscripcion = listener.subscription;
      temporizador = window.setTimeout(() => finalizar(null), 5000);
    });
  }
  function alternarVisibilidad() {
    const mostrar = elementos.nueva.type === "password";
    elementos.nueva.type = mostrar ? "text" : "password"; elementos.confirmar.type = mostrar ? "text" : "password";
    elementos.mostrar.textContent = mostrar ? "Ocultar" : "Mostrar"; elementos.mostrar.setAttribute("aria-pressed", String(mostrar)); elementos.mostrar.setAttribute("aria-label", mostrar ? "Ocultar contraseñas" : "Mostrar contraseñas");
  }
  async function guardar(event) {
    event.preventDefault(); mostrarMensaje();
    if (!formularioValido()) { mostrarMensaje(elementos.nueva.value.length < 8 ? "La contraseña debe tener al menos 8 caracteres." : "Las contraseñas no coinciden."); (elementos.nueva.value.length < 8 ? elementos.nueva : elementos.confirmar).focus(); return; }
    procesando = true; elementos.nueva.disabled = true; elementos.confirmar.disabled = true; elementos.mostrar.disabled = true; elementos.guardar.disabled = true; elementos.guardar.setAttribute("aria-busy", "true"); elementos.guardar.textContent = "Guardando contraseña…";
    try {
      const { error } = await cliente.auth.updateUser({ password: elementos.nueva.value });
      if (error) throw error;
      const { error: errorActivacion } = await cliente.rpc("registrar_activacion_usuario");
      if (errorActivacion) registrarError("La contraseña cambió, pero no fue posible registrar la activación.", errorActivacion);
      const { error: errorSalida } = await cliente.auth.signOut();
      if (errorSalida) registrarError("No fue posible cerrar la sesión temporal.", errorSalida);
      if (typeof window.Swal?.fire === "function") await window.Swal.fire({ icon: "success", title: "Contraseña establecida correctamente", text: "Ya puedes iniciar sesión con tu correo y nueva contraseña.", confirmButtonText: "Ir al inicio", allowOutsideClick: false, allowEscapeKey: false, heightAuto: false });
      window.location.replace("index.html");
    } catch (error) { registrarError("No fue posible actualizar la contraseña.", error); mostrarMensaje("No fue posible establecer la contraseña. Solicita al administrador un nuevo enlace."); procesando = false; elementos.nueva.disabled = false; elementos.confirmar.disabled = false; elementos.mostrar.disabled = false; elementos.guardar.setAttribute("aria-busy", "false"); elementos.guardar.textContent = "Guardar contraseña"; actualizarBoton(); }
  }
  async function inicializar() {
    if (!cliente) { mostrarEnlaceInvalido(); return; }
    try {
      const session = await esperarSession(); limpiarUrl();
      if (!session) { mostrarEnlaceInvalido(); return; }
      elementos.verificando.hidden = true; elementos.invalido.hidden = true; elementos.contenido.hidden = false; elementos.nueva.focus();
    } catch (error) { registrarError("No fue posible validar el enlace.", error); limpiarUrl(); mostrarEnlaceInvalido(); }
  }
  elementos.nueva.addEventListener("input", () => { mostrarMensaje(); actualizarBoton(); }); elementos.confirmar.addEventListener("input", () => { mostrarMensaje(); actualizarBoton(); }); elementos.mostrar.addEventListener("click", alternarVisibilidad); elementos.form.addEventListener("submit", guardar); actualizarBoton(); void inicializar();
})();
