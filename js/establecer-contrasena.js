(() => {
  "use strict";

  const porId = (id) => document.getElementById(id);
  const elementos = {
    verificando: porId("contrasena-verificando"),
    invalido: porId("contrasena-invalido"),
    invalidoTitulo: porId("contrasena-invalido-titulo"),
    invalidoTexto: porId("contrasena-invalido-texto"),
    contenido: porId("contrasena-formulario-contenido"),
    form: porId("contrasena-form"),
    nueva: porId("contrasena-nueva"),
    confirmar: porId("contrasena-confirmar"),
    mostrar: porId("contrasena-mostrar"),
    mensaje: porId("contrasena-mensaje"),
    guardar: porId("contrasena-guardar"),
    destinatario: porId("establecer-destinatario"),
    correo: porId("establecer-correo"),
  };

  const urlInicial = new URL(window.location.href);
  const tokenEnlace = urlInicial.searchParams.get("token")?.trim() ?? "";
  const tieneFlujoDeEnlace = /^[A-Za-z0-9_-]{40,100}$/.test(tokenEnlace);

  let procesando = false;
  let clienteEnlace = null;

  function registrarError(contexto, error) {
    console.error(`[Establecer contraseña] ${contexto}`, {
      codigo: error?.code ?? "desconocido",
    });
  }

  function mostrarMensaje(mensaje = "") {
    elementos.mensaje.textContent = mensaje;
    elementos.mensaje.hidden = !mensaje;
  }

  function formularioValido() {
    return (
      elementos.nueva.value.length >= 8 &&
      elementos.nueva.value === elementos.confirmar.value &&
      !procesando
    );
  }

  function configurarFormulario(habilitado) {
    elementos.nueva.disabled = !habilitado;
    elementos.confirmar.disabled = !habilitado;
    elementos.mostrar.disabled = !habilitado;
    elementos.guardar.disabled = !habilitado || !formularioValido();
  }

  function actualizarBoton() {
    elementos.guardar.disabled = !formularioValido();
  }

  function mostrarEnlaceInvalido(codigo = "ENLACE_INVALIDO") {
    configurarFormulario(false);
    elementos.correo.textContent = "";
    elementos.destinatario.hidden = true;
    const utilizado = codigo === "ENLACE_UTILIZADO";
    elementos.invalidoTitulo.textContent = utilizado
      ? "Este enlace ya fue utilizado"
      : "El enlace es inválido o ha vencido";
    elementos.invalidoTexto.textContent = utilizado
      ? "Solicita al administrador un nuevo enlace si necesitas cambiar nuevamente tu contraseña."
      : "Solicita al administrador un nuevo enlace.";
    elementos.verificando.hidden = true;
    elementos.contenido.hidden = true;
    elementos.invalido.hidden = false;
  }

  function limpiarUrl() {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  function crearClienteEnlace() {
    const configuracion = window.supabasePublicConfig;
    if (!window.supabase?.createClient || !configuracion) return null;

    return window.supabase.createClient(
      configuracion.url,
      configuracion.publishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: "enlace-contrasena-temporal",
        },
      },
    );
  }

  async function invocarEnlace(body) {
    const { data, error } = await clienteEnlace.functions.invoke(
      "procesar-enlace-contrasena",
      { body },
    );

    if (!error) return data;

    let detalle = data;
    if (!detalle && typeof error.context?.json === "function") {
      try {
        detalle = await error.context.json();
      } catch {
        detalle = null;
      }
    }

    const fallo = new Error(
      detalle?.mensaje ?? "No fue posible procesar el enlace.",
    );
    fallo.codigo = detalle?.codigo ?? error.code ?? "ERROR_FUNCION";
    throw fallo;
  }

  function alternarVisibilidad() {
    const mostrar = elementos.nueva.type === "password";
    elementos.nueva.type = mostrar ? "text" : "password";
    elementos.confirmar.type = mostrar ? "text" : "password";
    elementos.mostrar.textContent = mostrar ? "Ocultar" : "Mostrar";
    elementos.mostrar.setAttribute("aria-pressed", String(mostrar));
    elementos.mostrar.setAttribute(
      "aria-label",
      mostrar ? "Ocultar contraseñas" : "Mostrar contraseñas",
    );
  }

  async function guardar(event) {
    event.preventDefault();
    mostrarMensaje();

    if (!clienteEnlace || !formularioValido()) {
      mostrarMensaje(
        elementos.nueva.value.length < 8
          ? "La contraseña debe tener al menos 8 caracteres."
          : "Las contraseñas no coinciden.",
      );
      (elementos.nueva.value.length < 8
        ? elementos.nueva
        : elementos.confirmar).focus();
      return;
    }

    procesando = true;
    configurarFormulario(false);
    elementos.guardar.setAttribute("aria-busy", "true");
    elementos.guardar.textContent = "Guardando contraseña…";

    try {
      const resultado = await invocarEnlace({
        accion: "CAMBIAR",
        token: tokenEnlace,
        contrasena: elementos.nueva.value,
      });
      if (resultado?.ok !== true) throw new Error("Respuesta no válida.");

      elementos.form.reset();
      if (typeof window.Swal?.fire === "function") {
        await window.Swal.fire({
          icon: "success",
          title: "Contraseña establecida correctamente",
          text: "Ya puedes iniciar sesión con tu correo y nueva contraseña.",
          confirmButtonText: "Ir al inicio",
          allowOutsideClick: false,
          allowEscapeKey: false,
          heightAuto: false,
        });
      }
      window.location.replace("index.html");
    } catch (error) {
      registrarError("No fue posible actualizar la contraseña.", error);
      if (
        ["ENLACE_UTILIZADO", "ENLACE_VENCIDO", "ENLACE_INVALIDO"].includes(
          error?.codigo,
        )
      ) {
        procesando = false;
        elementos.guardar.setAttribute("aria-busy", "false");
        elementos.guardar.textContent = "Guardar contraseña";
        mostrarEnlaceInvalido(error.codigo);
        return;
      }
      mostrarMensaje(
        error?.codigo === "ENLACE_EN_PROCESO"
          ? "Este enlace está siendo utilizado en otra ventana. Espera un momento e intenta nuevamente."
          : "No fue posible establecer la contraseña. Puedes volver a intentarlo mientras el enlace siga vigente.",
      );
      procesando = false;
      configurarFormulario(true);
      elementos.guardar.setAttribute("aria-busy", "false");
      elementos.guardar.textContent = "Guardar contraseña";
    }
  }

  async function inicializar() {
    configurarFormulario(false);

    if (!tieneFlujoDeEnlace) {
      mostrarEnlaceInvalido();
      return;
    }

    clienteEnlace = crearClienteEnlace();
    if (!clienteEnlace) {
      mostrarEnlaceInvalido();
      return;
    }

    try {
      const resultado = await invocarEnlace({
        accion: "VALIDAR",
        token: tokenEnlace,
      });
      const correoUsuario = resultado?.email?.trim();

      if (resultado?.ok !== true || !correoUsuario) {
        mostrarEnlaceInvalido();
        return;
      }

      limpiarUrl();
      // El correo procede exclusivamente del usuario asociado al token validado en servidor.
      elementos.correo.textContent = correoUsuario;
      elementos.destinatario.hidden = false;
      elementos.verificando.hidden = true;
      elementos.invalido.hidden = true;
      elementos.contenido.hidden = false;
      configurarFormulario(true);
      elementos.nueva.focus();
    } catch (error) {
      registrarError("No fue posible validar el enlace.", error);
      mostrarEnlaceInvalido(error?.codigo);
    }
  }

  elementos.nueva.addEventListener("input", () => {
    mostrarMensaje();
    actualizarBoton();
  });
  elementos.confirmar.addEventListener("input", () => {
    mostrarMensaje();
    actualizarBoton();
  });
  elementos.mostrar.addEventListener("click", alternarVisibilidad);
  elementos.form.addEventListener("submit", guardar);
  void inicializar();
})();
