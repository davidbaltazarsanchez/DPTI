(() => {
  "use strict";

  const cliente = window.supabaseClient;
  const porId = (id) => document.getElementById(id);
  const elementos = {
    verificando: porId("cambiar-verificando"),
    contenido: porId("cambiar-contenido"),
    identidadHeader: porId("cambiar-identidad-header"),
    nombreHeader: porId("cambiar-nombre-header"),
    rolHeader: porId("cambiar-rol-header"),
    correo: porId("cambiar-correo"),
    menuAdministracion: porId("cambiar-menu-administracion"),
    form: porId("cambiar-form"),
    actual: porId("cambiar-actual"),
    nueva: porId("cambiar-nueva"),
    confirmar: porId("cambiar-confirmar"),
    mostrar: document.querySelectorAll(".cambiar-contrasena-mostrar"),
    mensaje: porId("cambiar-mensaje"),
    guardar: porId("cambiar-guardar"),
    cancelar: porId("cambiar-cancelar"),
  };

  let procesando = false;

  function registrarError(contexto, error) {
    console.error(`[Cambiar contraseña] ${contexto}`, {
      codigo: error?.code ?? "desconocido",
    });
  }

  function mostrarMensaje(mensaje = "") {
    elementos.mensaje.textContent = mensaje;
    elementos.mensaje.hidden = !mensaje;
  }

  function formularioValido() {
    const actual = elementos.actual.value;
    const nueva = elementos.nueva.value;
    return (
      actual.trim().length > 0 &&
      nueva.trim().length > 0 &&
      nueva.length >= 8 &&
      nueva === elementos.confirmar.value &&
      nueva !== actual &&
      !procesando
    );
  }

  function actualizarBoton() {
    elementos.guardar.disabled = !formularioValido();
  }

  function configurarFormulario(habilitado) {
    elementos.actual.disabled = !habilitado;
    elementos.nueva.disabled = !habilitado;
    elementos.confirmar.disabled = !habilitado;
    elementos.mostrar.forEach((boton) => {
      boton.disabled = !habilitado;
    });
    elementos.cancelar.disabled = !habilitado;
    elementos.guardar.disabled = !habilitado || !formularioValido();
  }

  function limpiarFormulario() {
    elementos.form.reset();
    elementos.actual.type = "password";
    elementos.nueva.type = "password";
    elementos.confirmar.type = "password";
    elementos.mostrar.forEach((boton) => {
      boton.textContent = "Mostrar";
      boton.setAttribute("aria-pressed", "false");
    });
    mostrarMensaje();
    actualizarBoton();
  }

  async function alerta(configuracion) {
    if (typeof window.Swal?.fire === "function") {
      return window.Swal.fire({
        confirmButtonText: "Aceptar",
        heightAuto: false,
        ...configuracion,
      });
    }
    return null;
  }

  async function cerrarSesionGlobal() {
    try {
      const { error } = await cliente.auth.signOut({ scope: "global" });
      if (error) throw error;
    } catch (errorGlobal) {
      registrarError("No fue posible cerrar globalmente la sesión.", errorGlobal);
      const { error } = await cliente.auth.signOut();
      if (error) registrarError("No fue posible cerrar la sesión.", error);
    }
  }

  async function cerrarSesionAplicacion() {
    if (!cliente) return;
    const { error } = await cliente.auth.signOut();
    if (error) {
      registrarError("No fue posible cerrar la sesión.", error);
      await alerta({ icon: "error", title: "No fue posible cerrar la sesión" });
      return;
    }
    window.location.replace("index.html");
  }

  function alternarVisibilidad(boton) {
    const campo = porId(boton.dataset.target);
    if (!campo) return;
    const mostrar = campo.type === "password";
    campo.type = mostrar ? "text" : "password";
    boton.textContent = mostrar ? "Ocultar" : "Mostrar";
    boton.setAttribute("aria-pressed", String(mostrar));
    boton.setAttribute(
      "aria-label",
      `${mostrar ? "Ocultar" : "Mostrar"} ${campo.labels?.[0]?.textContent?.toLocaleLowerCase("es") ?? "contraseña"}`,
    );
  }

  function mensajeValidacion() {
    const actual = elementos.actual.value;
    const nueva = elementos.nueva.value;
    if (!actual.trim()) return "Captura tu contraseña actual.";
    if (!nueva.trim() || nueva.length < 8) return "La nueva contraseña debe tener al menos 8 caracteres.";
    if (nueva !== elementos.confirmar.value) return "La confirmación no coincide con la nueva contraseña.";
    if (nueva === actual) return "La nueva contraseña debe ser diferente de la contraseña actual.";
    return "Revisa los datos capturados.";
  }

  async function guardar(event) {
    event.preventDefault();
    mostrarMensaje();

    if (!formularioValido()) {
      mostrarMensaje(mensajeValidacion());
      return;
    }

    let contrasenaActual = elementos.actual.value;
    let nuevaContrasena = elementos.nueva.value;
    let cambioCompletado = false;
    let identidadInconsistente = false;
    procesando = true;
    configurarFormulario(false);
    elementos.guardar.setAttribute("aria-busy", "true");
    elementos.guardar.textContent = "Actualizando…";

    try {
      const {
        data: { user },
        error: errorUsuario,
      } = await cliente.auth.getUser();
      if (errorUsuario || !user?.id || !user.email) {
        throw errorUsuario ?? new Error("Usuario no disponible.");
      }

      const usuarioId = user.id;
      const correo = user.email;
      const { data: datosReautenticacion, error: errorReautenticacion } =
        await cliente.auth.signInWithPassword({
          email: correo,
          password: contrasenaActual,
        });

      if (errorReautenticacion) {
        if (
          errorReautenticacion.code === "invalid_credentials" ||
          errorReautenticacion.status === 400
        ) {
          await alerta({
            icon: "error",
            title: "Contraseña incorrecta",
            text: "La contraseña actual no es correcta.",
          });
          return;
        }
        throw errorReautenticacion;
      }

      if (datosReautenticacion.user?.id !== usuarioId) {
        identidadInconsistente = true;
        await cerrarSesionGlobal();
        await alerta({
          icon: "error",
          title: "No fue posible confirmar tu identidad",
          text: "La sesión no coincide con la cuenta esperada. Inicia sesión nuevamente.",
        });
        window.location.replace("index.html");
        return;
      }

      const { error: errorActualizacion } = await cliente.auth.updateUser({
        password: nuevaContrasena,
      });
      if (errorActualizacion) {
        if (
          errorActualizacion.code === "weak_password" ||
          /password.{0,20}(weak|short|characters)/i.test(
            errorActualizacion.message ?? "",
          )
        ) {
          await alerta({
            icon: "error",
            title: "La contraseña no cumple los requisitos",
            text: "Elige una contraseña aceptada por la configuración de seguridad del sistema.",
          });
          return;
        }
        throw errorActualizacion;
      }

      cambioCompletado = true;
      limpiarFormulario();
      await alerta({
        icon: "success",
        title: "Contraseña actualizada",
        text: "Tu contraseña se actualizó correctamente. Inicia sesión nuevamente.",
        confirmButtonText: "Ir al inicio",
        allowOutsideClick: false,
        allowEscapeKey: false,
      });
      await cerrarSesionGlobal();
      window.location.replace("index.html");
    } catch (error) {
      registrarError("No fue posible cambiar la contraseña.", error);
      await alerta({
        icon: "error",
        title: "No fue posible actualizar la contraseña",
        text: "Intenta nuevamente en unos momentos.",
      });
    } finally {
      contrasenaActual = "";
      nuevaContrasena = "";
      if (!cambioCompletado && !identidadInconsistente) {
        limpiarFormulario();
        procesando = false;
        configurarFormulario(true);
        elementos.guardar.setAttribute("aria-busy", "false");
        elementos.guardar.textContent = "Cambiar contraseña";
        actualizarBoton();
      }
    }
  }

  async function inicializar() {
    configurarFormulario(false);
    if (!cliente) {
      window.location.replace("index.html");
      return;
    }

    const {
      data: { user },
      error: errorUsuario,
    } = await cliente.auth.getUser();
    if (errorUsuario || !user?.id) {
      window.location.replace("index.html");
      return;
    }

    const { data: perfil, error: errorPerfil } = await cliente
      .from("perfiles")
      .select("usuario_id,nombre,tipo_usuario,activo")
      .eq("usuario_id", user.id)
      .maybeSingle();

    if (errorPerfil || !perfil || perfil.activo !== true) {
      if (errorPerfil) registrarError("No fue posible validar el perfil.", errorPerfil);
      await cliente.auth.signOut();
      window.location.replace("index.html");
      return;
    }

    elementos.nombreHeader.textContent = perfil.nombre;
    elementos.rolHeader.textContent = perfil.tipo_usuario;
    elementos.correo.textContent = user.email ?? "Correo no disponible";
    elementos.menuAdministracion.hidden =
      perfil.tipo_usuario !== "ADMINISTRADOR";
    elementos.identidadHeader.hidden = false;
    elementos.verificando.hidden = true;
    elementos.contenido.hidden = false;
    configurarFormulario(true);
    elementos.actual.focus();
  }

  [elementos.actual, elementos.nueva, elementos.confirmar].forEach((campo) => {
    campo.addEventListener("input", () => {
      mostrarMensaje();
      actualizarBoton();
    });
  });
  elementos.mostrar.forEach((boton) => {
    boton.addEventListener("click", () => alternarVisibilidad(boton));
  });
  elementos.cancelar.addEventListener("click", () => {
    if (procesando) return;
    limpiarFormulario();
    window.location.assign("captura-seguimiento.html");
  });
  elementos.form.addEventListener("submit", guardar);
  window.cerrarSesionAplicacion = cerrarSesionAplicacion;
  void inicializar();
})();
