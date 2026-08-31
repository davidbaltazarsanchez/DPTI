(() => {
  "use strict";

  const cliente = window.supabaseClient;
  const porId = (id) => document.getElementById(id);
  const elementos = {
    form: porId("solicitud-form"),
    nombre: porId("solicitud-nombre"),
    email: porId("solicitud-email"),
    dependencia: porId("solicitud-dependencia"),
    dependenciaEstado: porId("solicitud-dependencias-estado"),
    dependenciaOtraCampo: porId("solicitud-dependencia-otra-campo"),
    dependenciaOtra: porId("solicitud-dependencia-otra"),
    cargo: porId("solicitud-cargo"),
    comentarios: porId("solicitud-comentarios"),
    comentariosContador: porId("solicitud-comentarios-contador"),
    sitioWeb: porId("solicitud-sitio-web"),
    mensaje: porId("solicitud-mensaje"),
    enviar: porId("solicitud-enviar"),
  };

  const camposFormulario = [
    elementos.nombre,
    elementos.email,
    elementos.dependencia,
    elementos.dependenciaOtra,
    elementos.cargo,
    elementos.comentarios,
    elementos.sitioWeb,
  ];
  const EXPRESION_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const NOMBRE_DEPENDENCIA_OTRA = "otra";
  let dependenciasDisponibles = false;
  let idDependenciaOtra = null;
  let envioEnCurso = false;

  function registrarError(contexto, error) {
    // No se registran cuerpos, datos personales, sesiones ni credenciales.
    console.error(`[Solicitud de acceso] ${contexto}`, {
      codigo: error?.code ?? "desconocido",
    });
  }

  function mostrarMensaje(mensaje = "", tipo = "error") {
    elementos.mensaje.textContent = mensaje;
    elementos.mensaje.hidden = !mensaje;
    elementos.mensaje.classList.toggle(
      "solicitud-mensaje--exito",
      Boolean(mensaje) && tipo === "exito",
    );
  }

  function datosNormalizados() {
    const dependenciaId = Number(elementos.dependencia.value);
    const seleccionoOtra = dependenciaId === idDependenciaOtra;
    return {
      nombre: elementos.nombre.value.trim(),
      email: elementos.email.value.trim().toLowerCase(),
      dependencia_id: dependenciaId,
      dependencia_otra: seleccionoOtra
        ? elementos.dependenciaOtra.value.trim()
        : null,
      cargo: elementos.cargo.value.trim(),
      comentarios: elementos.comentarios.value.trim(),
      sitio_web: elementos.sitioWeb.value,
    };
  }

  function validarFormulario(mostrarError = false) {
    const datos = datosNormalizados();
    let campo = null;
    let mensaje = "";

    if (datos.nombre.length < 3 || datos.nombre.length > 200) {
      campo = elementos.nombre;
      mensaje = "Captura un nombre completo de entre 3 y 200 caracteres.";
    } else if (
      datos.email.length > 254 ||
      !EXPRESION_EMAIL.test(datos.email)
    ) {
      campo = elementos.email;
      mensaje = "Captura un correo electrónico válido.";
    } else if (
      !Number.isInteger(datos.dependencia_id) ||
      datos.dependencia_id <= 0
    ) {
      campo = elementos.dependencia;
      mensaje = "Selecciona una dependencia.";
    } else if (
      datos.dependencia_id === idDependenciaOtra &&
      !datos.dependencia_otra
    ) {
      campo = elementos.dependenciaOtra;
      mensaje = "Especifica el nombre de la dependencia.";
    } else if (
      datos.dependencia_otra !== null &&
      datos.dependencia_otra.length > 150
    ) {
      campo = elementos.dependenciaOtra;
      mensaje = "La dependencia no puede exceder 150 caracteres.";
    } else if (datos.cargo.length > 150) {
      campo = elementos.cargo;
      mensaje = "El cargo o área no puede exceder 150 caracteres.";
    } else if (datos.comentarios.length > 1000) {
      campo = elementos.comentarios;
      mensaje = "Los comentarios no pueden exceder 1000 caracteres.";
    }

    if (mostrarError && mensaje) {
      mostrarMensaje(mensaje);
      campo.focus();
    }

    return {
      datos,
      valido: !mensaje,
    };
  }

  function actualizarEstadoBoton() {
    const { valido } = validarFormulario();
    elementos.enviar.disabled =
      envioEnCurso || !dependenciasDisponibles || !valido;
  }

  function actualizarContador() {
    elementos.comentariosContador.textContent =
      `${elementos.comentarios.value.length}/1000`;
  }

  function actualizarCampoDependenciaOtra() {
    const seleccionoOtra =
      idDependenciaOtra !== null &&
      Number(elementos.dependencia.value) === idDependenciaOtra;
    elementos.dependenciaOtraCampo.hidden = !seleccionoOtra;
    elementos.dependenciaOtra.required = seleccionoOtra;
    if (!seleccionoOtra) {
      elementos.dependenciaOtra.value = "";
    }
  }

  function establecerFormularioDeshabilitado(deshabilitado) {
    camposFormulario.forEach((campo) => {
      campo.disabled = deshabilitado;
    });
  }

  function establecerEnvio(enviando) {
    envioEnCurso = enviando;
    establecerFormularioDeshabilitado(enviando);
    if (!enviando) {
      elementos.dependencia.disabled = !dependenciasDisponibles;
    }
    elementos.enviar.setAttribute("aria-busy", String(enviando));
    elementos.enviar.textContent = enviando
      ? "Enviando solicitud…"
      : "Enviar solicitud";
    actualizarEstadoBoton();
  }

  async function mostrarConfirmacion() {
    const titulo = "Solicitud enviada correctamente";
    const mensaje =
      "Tu información será revisada por el administrador. Posteriormente recibirás indicaciones en el correo registrado.";

    if (typeof window.Swal?.fire !== "function") {
      mostrarMensaje(`${titulo}. ${mensaje}`, "exito");
      return;
    }

    await window.Swal.fire({
      icon: "success",
      title: titulo,
      text: mensaje,
      confirmButtonText: "Aceptar",
      buttonsStyling: false,
      heightAuto: false,
      customClass: {
        popup: "solicitud-alerta",
        title: "solicitud-alerta__titulo",
        confirmButton: "solicitud-alerta__boton",
      },
    });
  }

  async function cargarDependencias() {
    elementos.dependencia.disabled = true;
    elementos.dependenciaEstado.hidden = false;
    elementos.dependenciaEstado.textContent = "Cargando dependencias…";
    actualizarEstadoBoton();

    if (!cliente) {
      establecerFormularioDeshabilitado(true);
      elementos.dependenciaEstado.textContent =
        "No fue posible preparar el servicio. Recarga la página para intentarlo nuevamente.";
      return;
    }

    try {
      const { data, error } = await cliente.rpc(
        "listar_dependencias_solicitud",
      );
      if (error) {
        throw error;
      }

      const dependencias = (data ?? [])
        .map((dependencia) => ({
          id: Number(dependencia.id_dependencia),
          nombre: String(dependencia.nombre ?? "").trim(),
        }))
        .filter(
          (dependencia) =>
            Number.isInteger(dependencia.id) &&
            dependencia.id > 0 && dependencia.nombre,
        );

      if (!dependencias.length) {
        throw new Error("No hay dependencias disponibles.");
      }

      const dependenciaOtra = dependencias.find(
        (dependencia) =>
          dependencia.nombre.toLocaleLowerCase("es") ===
          NOMBRE_DEPENDENCIA_OTRA,
      );
      idDependenciaOtra = dependenciaOtra?.id ?? null;
      const dependenciasOrdenadas = dependenciaOtra
        ? [
            ...dependencias.filter(
              (dependencia) => dependencia.id !== dependenciaOtra.id,
            ),
            dependenciaOtra,
          ]
        : dependencias;

      dependenciasOrdenadas.forEach((dependencia) => {
        const opcion = document.createElement("option");
        opcion.value = String(dependencia.id);
        opcion.textContent = dependencia.nombre;
        elementos.dependencia.append(opcion);
      });

      dependenciasDisponibles = true;
      elementos.dependencia.disabled = false;
      elementos.dependenciaEstado.textContent = "";
      elementos.dependenciaEstado.hidden = true;
      actualizarEstadoBoton();
    } catch (error) {
      registrarError("No fue posible cargar las dependencias.", error);
      dependenciasDisponibles = false;
      establecerFormularioDeshabilitado(true);
      elementos.dependenciaEstado.textContent =
        "No fue posible cargar las dependencias. Inténtalo nuevamente más tarde.";
      mostrarMensaje(
        "El formulario no está disponible porque no fue posible cargar el catálogo de dependencias.",
      );
    }
  }

  async function enviarSolicitud(event) {
    event.preventDefault();
    if (envioEnCurso || elementos.enviar.disabled) {
      return;
    }

    mostrarMensaje();
    const { datos, valido } = validarFormulario(true);
    if (!valido) {
      actualizarEstadoBoton();
      return;
    }

    establecerEnvio(true);
    let solicitudEnviada = false;

    try {
      const { data, error } = await cliente.functions.invoke(
        "solicitar-acceso",
        {
          body: datos,
        },
      );
      if (error || data?.ok !== true) {
        throw error ?? new Error("Respuesta no válida del servicio.");
      }

      solicitudEnviada = true;
      elementos.form.reset();
      actualizarCampoDependenciaOtra();
      actualizarContador();
      await mostrarConfirmacion();
    } catch (error) {
      registrarError("No fue posible enviar la solicitud.", error);
      mostrarMensaje(
        "No fue posible enviar la solicitud. Inténtalo nuevamente más tarde.",
      );
    } finally {
      establecerEnvio(false);
      if (solicitudEnviada) {
        elementos.dependencia.value = "";
        actualizarEstadoBoton();
      }
    }
  }

  elementos.form.addEventListener("submit", enviarSolicitud);
  [
    elementos.nombre,
    elementos.email,
    elementos.cargo,
  ].forEach((campo) => {
    campo.addEventListener("input", () => {
      mostrarMensaje();
      actualizarEstadoBoton();
    });
  });
  elementos.dependencia.addEventListener("change", () => {
    mostrarMensaje();
    actualizarCampoDependenciaOtra();
    actualizarEstadoBoton();
  });
  elementos.dependenciaOtra.addEventListener("input", () => {
    mostrarMensaje();
    actualizarEstadoBoton();
  });
  elementos.comentarios.addEventListener("input", () => {
    mostrarMensaje();
    actualizarContador();
    actualizarEstadoBoton();
  });

  actualizarContador();
  actualizarCampoDependenciaOtra();
  actualizarEstadoBoton();
  void cargarDependencias();
})();
