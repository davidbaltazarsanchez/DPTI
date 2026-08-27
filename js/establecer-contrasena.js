(() => {
  "use strict";

  const porId = (id) => document.getElementById(id);
  const elementos = {
    verificando: porId("contrasena-verificando"),
    invalido: porId("contrasena-invalido"),
    contenido: porId("contrasena-formulario-contenido"),
    form: porId("contrasena-form"),
    nueva: porId("contrasena-nueva"),
    confirmar: porId("contrasena-confirmar"),
    mostrar: porId("contrasena-mostrar"),
    mensaje: porId("contrasena-mensaje"),
    guardar: porId("contrasena-guardar"),
  };

  const urlInicial = new URL(window.location.href);
  const fragmentoInicial = new URLSearchParams(
    urlInicial.hash.replace(/^#/, ""),
  );
  const tipoInicial =
    fragmentoInicial.get("type") ?? urlInicial.searchParams.get("type");
  const tieneTipoValido = ["invite", "recovery"].includes(tipoInicial);
  const tieneFlujoDeEnlace =
    tieneTipoValido ||
    fragmentoInicial.has("access_token") ||
    urlInicial.searchParams.has("code") ||
    urlInicial.searchParams.has("token_hash");

  let procesando = false;
  let clienteRecuperacion = null;

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

  function mostrarEnlaceInvalido() {
    configurarFormulario(false);
    elementos.verificando.hidden = true;
    elementos.contenido.hidden = true;
    elementos.invalido.hidden = false;
  }

  function limpiarUrl() {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  function crearClienteAislado() {
    const configuracion = window.supabasePublicConfig;
    if (!window.supabase?.createClient || !configuracion) return null;

    return window.supabase.createClient(
      configuracion.url,
      configuracion.publishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: true,
          storageKey: "recuperacion-temporal",
        },
      },
    );
  }

  function esperarSesionDelEnlace(cliente) {
    return new Promise((resolve, reject) => {
      let terminado = false;
      let temporizador;
      let suscripcion;

      const finalizar = (resultado) => {
        if (terminado) return;
        terminado = true;
        window.clearTimeout(temporizador);
        suscripcion?.unsubscribe();
        resolve(resultado);
      };

      temporizador = window.setTimeout(() => finalizar(null), 7000);

      const { data: listener } = cliente.auth.onAuthStateChange(
        (evento, session) => {
          const eventoPermitido =
            evento === "PASSWORD_RECOVERY" ||
            evento === "SIGNED_IN" ||
            (evento === "INITIAL_SESSION" && tieneFlujoDeEnlace);

          if (eventoPermitido && session) finalizar({ evento, session });
        },
      );
      suscripcion = listener.subscription;
      if (terminado) suscripcion.unsubscribe();

      cliente.auth.getSession().then(({ error }) => {
        if (error && !terminado) {
          terminado = true;
          window.clearTimeout(temporizador);
          suscripcion?.unsubscribe();
          reject(error);
        }
      });
    });
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

    if (!clienteRecuperacion || !formularioValido()) {
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
      const { error } = await clienteRecuperacion.auth.updateUser({
        password: elementos.nueva.value,
      });
      if (error) throw error;

      const { error: errorActivacion } = await clienteRecuperacion.rpc(
        "registrar_activacion_usuario",
      );
      if (errorActivacion) {
        registrarError(
          "La contraseña cambió, pero no fue posible registrar la activación.",
          errorActivacion,
        );
      }

      const { error: errorSalida } =
        await clienteRecuperacion.auth.signOut();
      if (errorSalida) {
        registrarError(
          "No fue posible cerrar la sesión temporal.",
          errorSalida,
        );
      }

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
      mostrarMensaje(
        "No fue posible establecer la contraseña. Solicita al administrador un nuevo enlace.",
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

    clienteRecuperacion = crearClienteAislado();
    if (!clienteRecuperacion) {
      mostrarEnlaceInvalido();
      return;
    }

    try {
      const resultado = await esperarSesionDelEnlace(clienteRecuperacion);
      limpiarUrl();
      if (!resultado?.session) {
        mostrarEnlaceInvalido();
        return;
      }

      const {
        data: { user },
        error: errorUsuario,
      } = await clienteRecuperacion.auth.getUser();

      if (errorUsuario || !user) {
        if (errorUsuario) {
          registrarError(
            "No fue posible confirmar el usuario del enlace.",
            errorUsuario,
          );
        }
        mostrarEnlaceInvalido();
        return;
      }

      elementos.verificando.hidden = true;
      elementos.invalido.hidden = true;
      elementos.contenido.hidden = false;
      configurarFormulario(true);
      elementos.nueva.focus();
    } catch (error) {
      registrarError("No fue posible validar el enlace.", error);
      limpiarUrl();
      mostrarEnlaceInvalido();
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
