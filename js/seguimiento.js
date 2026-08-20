(() => {
  "use strict";

  const cliente = window.supabaseClient;
  const porId = (id) => document.getElementById(id);

  const elementos = {
    login: porId("seguimiento-login"),
    loginForm: porId("seguimiento-login-form"),
    correo: porId("seguimiento-correo"),
    contrasena: porId("seguimiento-contrasena"),
    mostrarContrasena: porId("seguimiento-mostrar-contrasena"),
    loginMensaje: porId("seguimiento-login-mensaje"),
    ingresar: porId("seguimiento-ingresar"),
    cargando: porId("seguimiento-cargando"),
    cargandoTexto: porId("seguimiento-cargando-texto"),
    bloqueo: porId("seguimiento-bloqueo"),
    bloqueoTitulo: porId("seguimiento-bloqueo-titulo"),
    bloqueoMensaje: porId("seguimiento-bloqueo-mensaje"),
    bloqueoSalir: porId("seguimiento-bloqueo-salir"),
    tablero: porId("seguimiento-tablero"),
    aviso: porId("seguimiento-aviso"),
    headerUsuario: porId("seguimiento-header-usuario"),
    headerNombre: porId("seguimiento-header-nombre"),
    headerRol: porId("seguimiento-header-rol"),
    headerSalir: porId("seguimiento-cerrar-sesion"),
    menuSalir: porId("cerrar-sesion"),
    contextoRol: porId("seguimiento-contexto-rol"),
    temasEstado: porId("seguimiento-temas-estado"),
    temasLista: porId("seguimiento-temas-lista"),
    subtemasEstado: porId("seguimiento-subtemas-estado"),
    subtemasLista: porId("seguimiento-subtemas-lista"),
    accionesEstado: porId("seguimiento-acciones-estado"),
    accionesLista: porId("seguimiento-acciones-lista"),
    temaSeleccionado: porId("seguimiento-tema-seleccionado"),
    breadcrumbTema: porId("seguimiento-breadcrumb-tema"),
    accionesContador: porId("seguimiento-acciones-contador"),
    detalleBackdrop: porId("seguimiento-detalle-backdrop"),
    detalleModal: porId("seguimiento-detalle-modal"),
    detalleCerrar: porId("seguimiento-detalle-cerrar"),
    detalleTitulo: porId("seguimiento-detalle-titulo"),
    detalleDescripcion: porId("seguimiento-detalle-descripcion"),
    detalleDependencias: porId("seguimiento-detalle-dependencias"),
    capturaPanel: porId("seguimiento-captura-panel"),
    actualizacionForm: porId("seguimiento-actualizacion-form"),
    estatus: porId("seguimiento-estatus"),
    avanceRango: porId("seguimiento-avance-rango"),
    avanceNumero: porId("seguimiento-avance-numero"),
    avanceAyuda: porId("seguimiento-avance-ayuda"),
    comentarios: porId("seguimiento-comentarios"),
    archivoCampo: porId("seguimiento-archivo-campo"),
    archivo: porId("seguimiento-archivo"),
    actualizacionMensaje: porId("seguimiento-actualizacion-mensaje"),
    guardarActualizacion: porId("seguimiento-guardar-actualizacion"),
    historialEstado: porId("seguimiento-historial-estado"),
    historialLista: porId("seguimiento-historial-lista"),
  };

  const etiquetasRol = {
    ADMINISTRADOR: "Administrador",
    CENTRAL: "Usuario central",
    DEPENDENCIA: "Usuario de dependencia",
  };

  const BUCKET_EVIDENCIAS = "evidencias-seguimiento";
  const TAMANO_MAXIMO_ARCHIVO = 2.5 * 1024 * 1024;
  const EXTENSIONES_PERMITIDAS = new Set([
    "pdf",
    "jpg",
    "jpeg",
    "png",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "kml",
    "kmz",
  ]);
  const MIME_POR_EXTENSION = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kml: "application/vnd.google-earth.kml+xml",
    kmz: "application/vnd.google-earth.kmz",
  };

  const estado = {
    session: null,
    perfil: null,
    temas: [],
    subtemas: [],
    acciones: [],
    temaId: null,
    subtemaId: null,
    accionDetalle: null,
    elementoFocoAnterior: null,
    solicitudHistorial: 0,
    formularioEditado: false,
    guardandoActualizacion: false,
    novedades: {
      acciones: new Set(),
      subtemas: new Set(),
      temas: new Set(),
    },
    solicitudNovedades: 0,
    sessionInicializada: false,
    sessionUsuarioId: null,
    revisionAutenticacion: 0,
    solicitudes: {
      temas: 0,
      subtemas: 0,
      acciones: 0,
    },
  };

  let cierreEnCurso = null;
  let avisoTemporizador = null;
  let suscripcionAutenticacion = null;

  function etiquetaRol(tipoUsuario) {
    return etiquetasRol[tipoUsuario] ?? "Usuario autorizado";
  }

  function registrarError(contexto, error) {
    // Nunca se imprimen sesiones, tokens ni credenciales.
    console.error(`[Seguimiento] ${contexto}`, error);
  }

  function mostrarVista(vista) {
    const vistas = {
      login: elementos.login,
      cargando: elementos.cargando,
      bloqueo: elementos.bloqueo,
      tablero: elementos.tablero,
    };

    Object.entries(vistas).forEach(([nombre, elemento]) => {
      elemento.hidden = nombre !== vista;
    });
  }

  function mostrarCarga(mensaje) {
    elementos.cargandoTexto.textContent = mensaje;
    mostrarVista("cargando");
  }

  function mostrarMensajeLogin(mensaje = "") {
    elementos.loginMensaje.textContent = mensaje;
    elementos.loginMensaje.hidden = !mensaje;
  }

  function mostrarAviso(mensaje) {
    window.clearTimeout(avisoTemporizador);
    elementos.aviso.textContent = mensaje;
    elementos.aviso.hidden = false;
    avisoTemporizador = window.setTimeout(() => {
      elementos.aviso.hidden = true;
    }, 6000);
  }

  function mostrarBloqueo(titulo, mensaje) {
    elementos.bloqueoTitulo.textContent = titulo;
    elementos.bloqueoMensaje.textContent = mensaje;
    mostrarVista("bloqueo");
  }

  function cambiarEstadoPanel(elemento, mensaje, visible = true) {
    elemento.textContent = mensaje;
    elemento.hidden = !visible;
  }

  function invalidarSolicitudes() {
    estado.solicitudes.temas += 1;
    estado.solicitudes.subtemas += 1;
    estado.solicitudes.acciones += 1;
  }

  function limpiarColecciones() {
    invalidarSolicitudes();
    estado.temas = [];
    estado.subtemas = [];
    estado.acciones = [];
    estado.temaId = null;
    estado.subtemaId = null;
    estado.novedades.acciones.clear();
    estado.novedades.subtemas.clear();
    estado.novedades.temas.clear();

    elementos.temasLista.replaceChildren();
    elementos.subtemasLista.replaceChildren();
    elementos.accionesLista.replaceChildren();
    elementos.temaSeleccionado.textContent = "Selecciona un tema";
    elementos.breadcrumbTema.textContent = "Tema";
    elementos.accionesContador.textContent = "0";
    cambiarEstadoPanel(elementos.temasEstado, "Consultando temas autorizados…");
    cambiarEstadoPanel(elementos.subtemasEstado, "Selecciona un tema.");
    cambiarEstadoPanel(elementos.accionesEstado, "Selecciona un subtema.");
  }

  function limpiarIdentidad() {
    estado.perfil = null;
    elementos.headerNombre.textContent = "";
    elementos.headerRol.textContent = "";
    elementos.contextoRol.textContent = "";
    elementos.headerUsuario.hidden = true;
    document.body.classList.remove("seguimiento-autenticado");
  }

  function prepararIdentidad(perfil) {
    const rol = etiquetaRol(perfil.tipo_usuario);
    elementos.headerNombre.textContent = perfil.nombre;
    elementos.headerRol.textContent = rol;
    elementos.contextoRol.textContent = rol;
    elementos.headerUsuario.hidden = false;
    document.body.classList.add("seguimiento-autenticado");
  }

  function actualizarBotonesSeleccionados(selector, idSeleccionado) {
    document.querySelectorAll(selector).forEach((boton) => {
      boton.setAttribute(
        "aria-pressed",
        String(Number(boton.dataset.id) === Number(idSeleccionado)),
      );
    });
  }

  function agregarContenidoCatalogo(boton, texto, tieneNovedad) {
    const etiqueta = document.createElement("span");
    etiqueta.className = "seguimiento-catalogo__texto";
    etiqueta.textContent = texto;

    const indicador = document.createElement("span");
    indicador.className = "seguimiento-novedad-indicador";
    indicador.setAttribute("aria-hidden", "true");
    indicador.hidden = !tieneNovedad;

    boton.classList.toggle("seguimiento-tiene-novedad", tieneNovedad);
    boton.setAttribute(
      "aria-label",
      tieneNovedad ? `${texto}. Tiene actualizaciones nuevas.` : texto,
    );
    boton.append(etiqueta, indicador);
  }

  function configurarBotonAccionNovedad(boton, accionId) {
    const tieneNovedad =
      estado.perfil?.tipo_usuario === "CENTRAL" &&
      estado.novedades.acciones.has(Number(accionId));
    const texto = document.createElement("span");
    texto.textContent = "Abrir";
    boton.replaceChildren(texto);
    boton.classList.toggle("seguimiento-accion__abrir--nuevo", tieneNovedad);
    boton.setAttribute(
      "aria-label",
      tieneNovedad ? "Abrir acción con actualizaciones nuevas" : "Abrir acción",
    );
    if (tieneNovedad) {
      const nuevo = document.createElement("span");
      nuevo.className = "seguimiento-accion__nuevo";
      nuevo.textContent = "Nuevo";
      boton.append(nuevo);
    }
  }

  function actualizarIndicadoresNovedad() {
    document.querySelectorAll(".seguimiento-tema").forEach((boton) => {
      const tieneNovedad = estado.novedades.temas.has(Number(boton.dataset.id));
      boton.classList.toggle("seguimiento-tiene-novedad", tieneNovedad);
      const indicador = boton.querySelector(".seguimiento-novedad-indicador");
      if (indicador) {
        indicador.hidden = !tieneNovedad;
      }
      const texto =
        boton.querySelector(".seguimiento-catalogo__texto")?.textContent ??
        "Tema";
      boton.setAttribute(
        "aria-label",
        tieneNovedad ? `${texto}. Tiene actualizaciones nuevas.` : texto,
      );
    });
    document.querySelectorAll(".seguimiento-subtema").forEach((boton) => {
      const tieneNovedad = estado.novedades.subtemas.has(
        Number(boton.dataset.id),
      );
      boton.classList.toggle("seguimiento-tiene-novedad", tieneNovedad);
      const indicador = boton.querySelector(".seguimiento-novedad-indicador");
      if (indicador) {
        indicador.hidden = !tieneNovedad;
      }
      const texto =
        boton.querySelector(".seguimiento-catalogo__texto")?.textContent ??
        "Subtema";
      boton.setAttribute(
        "aria-label",
        tieneNovedad ? `${texto}. Tiene actualizaciones nuevas.` : texto,
      );
    });
    document.querySelectorAll(".seguimiento-accion__abrir").forEach((boton) => {
      configurarBotonAccionNovedad(boton, boton.dataset.accionId);
    });
  }

  async function cargarNovedadesCentral() {
    const solicitud = ++estado.solicitudNovedades;
    estado.novedades.acciones.clear();
    estado.novedades.subtemas.clear();
    estado.novedades.temas.clear();
    if (estado.perfil?.tipo_usuario !== "CENTRAL") {
      return;
    }
    try {
      const { data, error } = await cliente.rpc("obtener_novedades_central");
      if (error) {
        throw error;
      }
      if (solicitud !== estado.solicitudNovedades) {
        return;
      }
      (data ?? []).forEach((novedad) => {
        estado.novedades.acciones.add(Number(novedad.id_accion));
        estado.novedades.subtemas.add(Number(novedad.id_subtema));
        estado.novedades.temas.add(Number(novedad.id_tema));
      });
    } catch (error) {
      if (solicitud !== estado.solicitudNovedades) {
        return;
      }
      registrarError("No fue posible consultar las novedades.", error);
    }
  }

  async function marcarAccionRevisada(accionId) {
    if (
      estado.perfil?.tipo_usuario !== "CENTRAL" ||
      !estado.novedades.acciones.has(Number(accionId))
    ) {
      return;
    }
    try {
      const { data, error } = await cliente.rpc("marcar_accion_revisada", {
        p_accion_id: Number(accionId),
      });
      if (error) {
        throw error;
      }
      if (data !== true) {
        return;
      }
      await cargarNovedadesCentral();
      actualizarIndicadoresNovedad();
    } catch (error) {
      registrarError("No fue posible marcar la acción como revisada.", error);
    }
  }

  function renderizarTemas() {
    elementos.temasLista.replaceChildren();

    estado.temas.forEach((tema) => {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "seguimiento-tema";
      boton.dataset.id = String(tema.id_tema);
      boton.setAttribute("aria-pressed", "false");
      agregarContenidoCatalogo(
        boton,
        tema.nombre,
        estado.novedades.temas.has(Number(tema.id_tema)),
      );
      boton.addEventListener("click", () => {
        void seleccionarTema(tema);
      });
      elementos.temasLista.append(boton);
    });
  }

  function renderizarSubtemas() {
    elementos.subtemasLista.replaceChildren();

    estado.subtemas.forEach((subtema) => {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "seguimiento-subtema";
      boton.dataset.id = String(subtema.id_subtema);
      boton.setAttribute("aria-pressed", "false");
      agregarContenidoCatalogo(
        boton,
        subtema.nombre,
        estado.novedades.subtemas.has(Number(subtema.id_subtema)),
      );
      boton.addEventListener("click", () => {
        void seleccionarSubtema(subtema);
      });
      elementos.subtemasLista.append(boton);
    });
  }

  function agregarEtiqueta(contenedor, texto, clase) {
    const etiqueta = document.createElement("span");
    etiqueta.className = clase;
    etiqueta.textContent = texto;
    contenedor.append(etiqueta);
  }

  function renderizarAcciones() {
    elementos.accionesLista.replaceChildren();
    elementos.accionesContador.textContent = String(estado.acciones.length);

    estado.acciones.forEach((accion) => {
      const tarjeta = document.createElement("li");
      tarjeta.className = "seguimiento-accion";

      const titulo = document.createElement("h3");
      titulo.textContent = accion.nombre;
      tarjeta.append(titulo);

      const metadatos = document.createElement("div");
      metadatos.className = "seguimiento-accion__meta";

      if (accion.dependencias.length) {
        accion.dependencias.forEach((dependencia) => {
          agregarEtiqueta(
            metadatos,
            dependencia,
            "seguimiento-accion__dependencia",
          );
        });
      } else {
        agregarEtiqueta(
          metadatos,
          "Sin dependencia visible",
          "seguimiento-accion__dependencia",
        );
      }

      if (accion.permite_archivo) {
        agregarEtiqueta(metadatos);
      }

      tarjeta.append(metadatos);

      const pie = document.createElement("div");
      pie.className = "seguimiento-accion__pie";
      const abrir = document.createElement("button");
      abrir.type = "button";
      abrir.className = "seguimiento-accion__abrir";
      abrir.dataset.accionId = String(accion.id_accion);
      configurarBotonAccionNovedad(abrir, accion.id_accion);
      abrir.addEventListener("click", () => {
        void abrirDetalleAccion(accion, abrir);
      });
      pie.append(abrir);
      tarjeta.append(pie);

      elementos.accionesLista.append(tarjeta);
    });
  }

  function puedeCapturarActualizaciones() {
    return ["ADMINISTRADOR", "DEPENDENCIA"].includes(
      estado.perfil?.tipo_usuario,
    );
  }

  function mostrarMensajeActualizacion(mensaje = "") {
    elementos.actualizacionMensaje.textContent = mensaje;
    elementos.actualizacionMensaje.hidden = !mensaje;
  }

  function reglasAvance(estatus) {
    if (!estatus) {
      return {
        min: 0,
        max: 100,
        valor: 0,
        bloqueado: true,
        ayuda: "Selecciona un estatus para capturar el porcentaje de avance.",
      };
    }
    const reglas = {
      "No Iniciado": {
        min: 0,
        max: 0,
        valor: 0,
        bloqueado: true,
        ayuda: "El estatus No Iniciado requiere 0% de avance.",
      },
      Concluido: {
        min: 100,
        max: 100,
        valor: 100,
        bloqueado: true,
        ayuda: "El estatus Concluido requiere 100% de avance.",
      },
      "En Proceso": {
        min: 1,
        max: 99,
        valor: 1,
        bloqueado: false,
        ayuda: "En Proceso permite un avance entre 1% y 99%.",
      },
      "En Planeación": {
        min: 0,
        max: 99,
        valor: 0,
        bloqueado: false,
        ayuda: "En Planeación permite un avance entre 0% y 99%.",
      },
      "Por Iniciar": {
        min: 0,
        max: 99,
        valor: 0,
        bloqueado: false,
        ayuda: "Por Iniciar permite un avance entre 0% y 99%.",
      },
      "Sin Presupuesto": {
        min: 0,
        max: 99,
        valor: 0,
        bloqueado: false,
        ayuda: "Sin Presupuesto permite un avance entre 0% y 99%.",
      },
    };
    return reglas[estatus] ?? reglas["No Iniciado"];
  }

  function configurarAvancePorEstatus(conservarValor = false) {
    const regla = reglasAvance(elementos.estatus.value);
    const valorActual = Number(elementos.avanceNumero.value);
    const valor =
      conservarValor &&
      Number.isFinite(valorActual) &&
      valorActual >= regla.min &&
      valorActual <= regla.max
        ? valorActual
        : regla.valor;

    [elementos.avanceRango, elementos.avanceNumero].forEach((control) => {
      control.min = String(regla.min);
      control.max = String(regla.max);
      control.value = String(valor);
      control.disabled = regla.bloqueado;
    });
    elementos.avanceAyuda.textContent = regla.ayuda;
  }

  function sincronizarAvance(origen, destino) {
    const minimo = Number(origen.min);
    const maximo = Number(origen.max);
    const capturado = Number(origen.value);
    const valor = Math.min(maximo, Math.max(minimo, capturado));
    origen.value = String(valor);
    destino.value = String(valor);
  }

  function actualizarEstadoBotonGuardar() {
    const estatusSeleccionado = Boolean(elementos.estatus.value);
    const comentarioCapturado = Boolean(elementos.comentarios.value.trim());
    elementos.guardarActualizacion.disabled = !(
      estatusSeleccionado &&
      comentarioCapturado &&
      !estado.guardandoActualizacion
    );
  }

  function extensionArchivo(nombre) {
    const partes = nombre.toLowerCase().split(".");
    return partes.length > 1 ? partes.pop() : "";
  }

  function validarArchivo(archivo) {
    if (!archivo) {
      return "";
    }
    const extension = extensionArchivo(archivo.name);
    if (!EXTENSIONES_PERMITIDAS.has(extension)) {
      return "El formato del archivo no está permitido.";
    }
    if (archivo.size > TAMANO_MAXIMO_ARCHIVO) {
      return "El archivo no puede superar los 2.5 MB.";
    }
    if (archivo.size <= 0) {
      return "El archivo seleccionado está vacío.";
    }
    return "";
  }

  function nombreArchivoSeguro(nombre) {
    return (
      nombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-.]+|[-.]+$/g, "")
        .slice(-120) || "evidencia"
    );
  }

  function identificadorAleatorio() {
    return (
      window.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
  }

  function formatearFecha(fecha) {
    if (!fecha) {
      return "Fecha no disponible";
    }
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(fecha));
  }

  async function descargarEvidencia(archivo, boton) {
    boton.disabled = true;
    boton.textContent = "Preparando…";
    try {
      const { data, error } = await cliente.storage
        .from(BUCKET_EVIDENCIAS)
        .createSignedUrl(archivo.ruta_storage, 60, {
          download: archivo.nombre_original,
        });
      if (error || !data?.signedUrl) {
        throw error ?? new Error("No se generó el enlace de descarga.");
      }
      const enlace = document.createElement("a");
      enlace.href = data.signedUrl;
      enlace.download = archivo.nombre_original;
      enlace.rel = "noopener";
      document.body.append(enlace);
      enlace.click();
      enlace.remove();
    } catch (error) {
      registrarError("No fue posible descargar la evidencia.", error);
      mostrarAviso("No fue posible descargar la evidencia.");
    } finally {
      boton.disabled = false;
      boton.textContent = archivo.nombre_original;
    }
  }

  function renderizarHistorial(actualizaciones, archivos, perfiles) {
    elementos.historialLista.replaceChildren();
    const archivosPorActualizacion = new Map();
    archivos.forEach((archivo) => {
      const lista =
        archivosPorActualizacion.get(archivo.actualizacion_id) ?? [];
      lista.push(archivo);
      archivosPorActualizacion.set(archivo.actualizacion_id, lista);
    });
    const nombresPorUsuario = new Map(
      perfiles.map((perfil) => [perfil.usuario_id, perfil.nombre]),
    );

    actualizaciones.forEach((actualizacion) => {
      const item = document.createElement("li");
      item.className = "seguimiento-historial__item";

      const cabecera = document.createElement("div");
      cabecera.className = "seguimiento-historial__cabecera";
      const estatus = document.createElement("strong");
      estatus.className = "seguimiento-historial__estatus";
      estatus.textContent = actualizacion.estatus;
      const porcentaje = document.createElement("span");
      porcentaje.className = "seguimiento-historial__porcentaje";
      porcentaje.textContent = `${Number(actualizacion.porcentaje_avance)}%`;
      cabecera.append(estatus, porcentaje);

      const datos = document.createElement("p");
      datos.className = "seguimiento-historial__datos";
      const nombre =
        nombresPorUsuario.get(actualizacion.usuario_id) ??
        (actualizacion.usuario_id === estado.perfil?.usuario_id
          ? estado.perfil.nombre
          : "Usuario autorizado");
      datos.textContent = `${nombre} · ${formatearFecha(actualizacion.fecha_actualizacion)}`;
      item.append(cabecera, datos);

      if (actualizacion.comentarios) {
        const comentarios = document.createElement("p");
        comentarios.className = "seguimiento-historial__comentarios";
        comentarios.textContent = actualizacion.comentarios;
        item.append(comentarios);
      }

      const evidencias =
        archivosPorActualizacion.get(actualizacion.id_act) ?? [];
      if (evidencias.length) {
        const contenedor = document.createElement("div");
        contenedor.className = "seguimiento-historial__archivos";
        evidencias.forEach((archivo) => {
          const boton = document.createElement("button");
          boton.type = "button";
          boton.className = "seguimiento-historial__archivo";
          boton.textContent = archivo.nombre_original;
          boton.addEventListener("click", () => {
            void descargarEvidencia(archivo, boton);
          });
          contenedor.append(boton);
        });
        item.append(contenedor);
      }
      elementos.historialLista.append(item);
    });
  }

  async function cargarHistorial(accionId) {
    const solicitud = ++estado.solicitudHistorial;
    elementos.historialLista.replaceChildren();
    cambiarEstadoPanel(elementos.historialEstado, "Consultando historial…");
    try {
      const { data: actualizaciones, error } = await cliente
        .from("actualizaciones")
        .select(
          "id_act,accion_id,usuario_id,estatus,porcentaje_avance,comentarios,fecha_actualizacion,created_at",
        )
        .eq("accion_id", accionId)
        .order("fecha_actualizacion", { ascending: false })
        .order("id_act", { ascending: false });
      if (error) {
        throw error;
      }
      if (solicitud !== estado.solicitudHistorial) {
        return;
      }
      const lista = actualizaciones ?? [];
      if (!lista.length) {
        cambiarEstadoPanel(
          elementos.historialEstado,
          "Todavía no hay actualizaciones para esta acción.",
        );
        return;
      }
      const idsActualizacion = lista.map((item) => item.id_act);
      const idsUsuario = [...new Set(lista.map((item) => item.usuario_id))];
      const [respuestaArchivos, respuestaPerfiles] = await Promise.all([
        cliente
          .from("archivos")
          .select(
            "id_archivo,actualizacion_id,nombre_original,ruta_storage,tipo_mime,tamano_bytes,created_at",
          )
          .in("actualizacion_id", idsActualizacion)
          .order("created_at", { ascending: true }),
        cliente
          .from("perfiles")
          .select("usuario_id,nombre")
          .in("usuario_id", idsUsuario),
      ]);
      if (respuestaArchivos.error) {
        throw respuestaArchivos.error;
      }
      if (respuestaPerfiles.error) {
        registrarError(
          "No fue posible consultar los nombres del historial.",
          respuestaPerfiles.error,
        );
      }
      if (solicitud !== estado.solicitudHistorial) {
        return;
      }
      cambiarEstadoPanel(elementos.historialEstado, "", false);
      renderizarHistorial(
        lista,
        respuestaArchivos.data ?? [],
        respuestaPerfiles.data ?? [],
      );
      await marcarAccionRevisada(accionId);
    } catch (error) {
      if (solicitud !== estado.solicitudHistorial) {
        return;
      }
      registrarError("No fue posible consultar el historial.", error);
      cambiarEstadoPanel(
        elementos.historialEstado,
        "No fue posible consultar el historial de esta acción.",
      );
    }
  }

  function restablecerFormularioActualizacion() {
    elementos.actualizacionForm.reset();
    elementos.estatus.value = "";
    configurarAvancePorEstatus();
    mostrarMensajeActualizacion();
    estado.formularioEditado = false;
    actualizarEstadoBotonGuardar();
  }

  async function abrirDetalleAccion(accion, elementoFoco) {
    estado.accionDetalle = accion;
    estado.elementoFocoAnterior = elementoFoco;
    elementos.detalleTitulo.textContent = accion.nombre;
    elementos.detalleDescripcion.textContent =
      estado.perfil?.tipo_usuario === "CENTRAL"
        ? "Consulta el historial y las evidencias registradas."
        : "Registra un avance nuevo o consulta la bitácora existente.";
    elementos.detalleDependencias.replaceChildren();
    (accion.dependencias.length
      ? accion.dependencias
      : ["Sin dependencia visible"]
    ).forEach((dependencia) => {
      agregarEtiqueta(
        elementos.detalleDependencias,
        dependencia,
        "seguimiento-accion__dependencia",
      );
    });
    elementos.capturaPanel.hidden = !puedeCapturarActualizaciones();
    elementos.archivoCampo.hidden = !accion.permite_archivo;
    restablecerFormularioActualizacion();
    elementos.detalleBackdrop.hidden = false;
    elementos.detalleModal.hidden = false;
    document.body.classList.add("seguimiento-modal-abierto");
    elementos.detalleModal.focus();
    await cargarHistorial(accion.id_accion);
  }

  function cerrarDetalleAccion(devolverFoco = true) {
    if (elementos.detalleModal.hidden) {
      return;
    }
    estado.solicitudHistorial += 1;
    elementos.detalleModal.hidden = true;
    elementos.detalleBackdrop.hidden = true;
    document.body.classList.remove("seguimiento-modal-abierto");
    estado.accionDetalle = null;
    elementos.historialLista.replaceChildren();
    restablecerFormularioActualizacion();
    if (devolverFoco) {
      estado.elementoFocoAnterior?.focus();
    }
    estado.elementoFocoAnterior = null;
  }

  function validarEstatusYAvance(estatus, porcentaje) {
    const regla = reglasAvance(estatus);
    return (
      Number.isFinite(porcentaje) &&
      porcentaje >= regla.min &&
      porcentaje <= regla.max
    );
  }

  async function subirEvidencia(actualizacionId, archivo) {
    const extension = extensionArchivo(archivo.name);
    const ruta = `actualizaciones/${actualizacionId}/${identificadorAleatorio()}-${nombreArchivoSeguro(archivo.name)}`;
    const tipoMime = MIME_POR_EXTENSION[extension] ?? archivo.type;
    const { error: errorCarga } = await cliente.storage
      .from(BUCKET_EVIDENCIAS)
      .upload(ruta, archivo, {
        cacheControl: "3600",
        contentType: tipoMime,
        upsert: false,
      });
    if (errorCarga) {
      throw errorCarga;
    }
    const { error: errorRegistro } = await cliente.from("archivos").insert({
      actualizacion_id: actualizacionId,
      usuario_id: estado.session.user.id,
      nombre_original: archivo.name,
      ruta_storage: ruta,
      tipo_mime: tipoMime || null,
      tamano_bytes: archivo.size,
    });
    if (errorRegistro) {
      throw errorRegistro;
    }
  }

  async function guardarActualizacion(event) {
    event.preventDefault();
    if (
      elementos.guardarActualizacion.disabled ||
      estado.guardandoActualizacion
    ) {
      return;
    }
    const accion = estado.accionDetalle;
    if (!accion || !estado.session?.user || !puedeCapturarActualizaciones()) {
      mostrarMensajeActualizacion("No tienes permiso para registrar avances.");
      return;
    }
    const estatus = elementos.estatus.value;
    const porcentaje = Number(elementos.avanceNumero.value);
    const comentarios = elementos.comentarios.value.trim();
    const archivo = accion.permite_archivo
      ? (elementos.archivo.files?.[0] ?? null)
      : null;
    if (!estatus) {
      mostrarMensajeActualizacion("Selecciona el estatus de la actualización.");
      elementos.estatus.focus();
      return;
    }
    if (!comentarios) {
      mostrarMensajeActualizacion("Captura un comentario para continuar.");
      elementos.comentarios.focus();
      return;
    }
    if (!validarEstatusYAvance(estatus, porcentaje)) {
      mostrarMensajeActualizacion(
        "El porcentaje no corresponde con el estatus seleccionado.",
      );
      elementos.avanceNumero.focus();
      return;
    }
    const errorArchivo = validarArchivo(archivo);
    if (errorArchivo) {
      mostrarMensajeActualizacion(errorArchivo);
      elementos.archivo.focus();
      return;
    }

    estado.guardandoActualizacion = true;
    elementos.guardarActualizacion.disabled = true;
    elementos.guardarActualizacion.textContent = "Guardando…";
    mostrarMensajeActualizacion();
    let actualizacionGuardada = false;
    try {
      const { data: actualizacion, error } = await cliente
        .from("actualizaciones")
        .insert({
          accion_id: accion.id_accion,
          usuario_id: estado.session.user.id,
          estatus,
          porcentaje_avance: porcentaje,
          comentarios: comentarios || null,
        })
        .select("id_act")
        .single();
      if (error || !actualizacion) {
        throw error ?? new Error("No se recibió la actualización guardada.");
      }
      actualizacionGuardada = true;
      if (archivo) {
        elementos.guardarActualizacion.textContent = "Subiendo evidencia…";
        await subirEvidencia(actualizacion.id_act, archivo);
      }
      restablecerFormularioActualizacion();
      mostrarAviso("La actualización se guardó correctamente.");
      await cargarHistorial(accion.id_accion);
    } catch (error) {
      registrarError("No fue posible guardar la actualización.", error);
      mostrarMensajeActualizacion(
        actualizacionGuardada
          ? "El avance quedó guardado, pero no fue posible registrar la evidencia. Comunícate con el administrador."
          : "No fue posible guardar la actualización. Intenta nuevamente.",
      );
      if (actualizacionGuardada) {
        await cargarHistorial(accion.id_accion);
      }
    } finally {
      estado.guardandoActualizacion = false;
      elementos.guardarActualizacion.textContent = "Guardar actualización";
      actualizarEstadoBotonGuardar();
    }
  }

  function extraerDependenciasAnidadas(relaciones) {
    if (!Array.isArray(relaciones)) {
      return [];
    }

    return relaciones
      .flatMap((relacion) => {
        const dependencia = relacion?.dependencias;
        if (Array.isArray(dependencia)) {
          return dependencia.map((item) => item?.nombre).filter(Boolean);
        }
        return dependencia?.nombre ? [dependencia.nombre] : [];
      })
      .filter((nombre, indice, nombres) => nombres.indexOf(nombre) === indice);
  }

  async function consultarDependenciasPorSeparado(acciones) {
    if (!acciones.length) {
      return acciones.map((accion) => ({ ...accion, dependencias: [] }));
    }

    const idsAccion = acciones.map((accion) => accion.id_accion);
    const { data: relaciones, error: errorRelaciones } = await cliente
      .from("accion_dependencias")
      .select("accion_id,dependencia_id,orden_responsabilidad")
      .in("accion_id", idsAccion)
      .order("orden_responsabilidad", { ascending: true });

    if (errorRelaciones) {
      throw errorRelaciones;
    }

    const idsDependencia = [
      ...new Set((relaciones ?? []).map((item) => item.dependencia_id)),
    ];

    if (!idsDependencia.length) {
      return acciones.map((accion) => ({ ...accion, dependencias: [] }));
    }

    const { data: dependencias, error: errorDependencias } = await cliente
      .from("dependencias")
      .select("id_dependencia,nombre")
      .in("id_dependencia", idsDependencia);

    if (errorDependencias) {
      throw errorDependencias;
    }

    const nombresPorId = new Map(
      (dependencias ?? []).map((dependencia) => [
        dependencia.id_dependencia,
        dependencia.nombre,
      ]),
    );

    return acciones.map((accion) => {
      const nombres = (relaciones ?? [])
        .filter((relacion) => relacion.accion_id === accion.id_accion)
        .map((relacion) => nombresPorId.get(relacion.dependencia_id))
        .filter(Boolean);

      return { ...accion, dependencias: [...new Set(nombres)] };
    });
  }

  async function consultarAcciones(subtemaId) {
    const consultaAnidada = await cliente
      .from("acciones")
      .select(
        "id_accion,subtema_id,nombre,permite_archivo,activo,orden,accion_dependencias(orden_responsabilidad,dependencias(nombre))",
      )
      .eq("subtema_id", subtemaId)
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("id_accion", { ascending: true });

    if (!consultaAnidada.error) {
      return (consultaAnidada.data ?? []).map((accion) => ({
        ...accion,
        dependencias: extraerDependenciasAnidadas(accion.accion_dependencias),
      }));
    }

    // Respaldo para proyectos donde PostgREST no exponga la relación anidada.
    const { data: acciones, error: errorAcciones } = await cliente
      .from("acciones")
      .select("id_accion,subtema_id,nombre,permite_archivo,activo,orden")
      .eq("subtema_id", subtemaId)
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("id_accion", { ascending: true });

    if (errorAcciones) {
      throw errorAcciones;
    }

    return consultarDependenciasPorSeparado(acciones ?? []);
  }

  async function cargarAcciones(subtemaId) {
    const solicitud = ++estado.solicitudes.acciones;
    estado.acciones = [];
    elementos.accionesLista.replaceChildren();
    elementos.accionesContador.textContent = "0";
    cambiarEstadoPanel(elementos.accionesEstado, "Consultando acciones…");

    try {
      const acciones = await consultarAcciones(subtemaId);

      if (
        solicitud !== estado.solicitudes.acciones ||
        Number(subtemaId) !== Number(estado.subtemaId)
      ) {
        return;
      }

      estado.acciones = acciones;

      if (!acciones.length) {
        cambiarEstadoPanel(
          elementos.accionesEstado,
          "No hay acciones disponibles para esta selección.",
        );
        return;
      }

      cambiarEstadoPanel(elementos.accionesEstado, "", false);
      renderizarAcciones();
    } catch (error) {
      if (solicitud !== estado.solicitudes.acciones) {
        return;
      }
      registrarError("No fue posible consultar las acciones.", error);
      cambiarEstadoPanel(
        elementos.accionesEstado,
        "No fue posible consultar las acciones autorizadas. Intenta nuevamente.",
      );
    }
  }

  async function seleccionarSubtema(subtema) {
    estado.subtemaId = subtema.id_subtema;
    actualizarBotonesSeleccionados(".seguimiento-subtema", estado.subtemaId);
    await cargarAcciones(subtema.id_subtema);
  }

  async function cargarSubtemas(temaId) {
    const solicitud = ++estado.solicitudes.subtemas;
    estado.solicitudes.acciones += 1;
    estado.subtemas = [];
    estado.acciones = [];
    estado.subtemaId = null;
    elementos.subtemasLista.replaceChildren();
    elementos.accionesLista.replaceChildren();
    elementos.accionesContador.textContent = "0";
    cambiarEstadoPanel(elementos.subtemasEstado, "Consultando subtemas…");
    cambiarEstadoPanel(elementos.accionesEstado, "Selecciona un subtema.");

    try {
      const { data, error } = await cliente
        .from("subtemas")
        .select("id_subtema,tema_id,nombre,activo,orden")
        .eq("tema_id", temaId)
        .eq("activo", true)
        .order("orden", { ascending: true })
        .order("id_subtema", { ascending: true });

      if (error) {
        throw error;
      }

      if (
        solicitud !== estado.solicitudes.subtemas ||
        Number(temaId) !== Number(estado.temaId)
      ) {
        return;
      }

      estado.subtemas = data ?? [];

      if (!estado.subtemas.length) {
        cambiarEstadoPanel(
          elementos.subtemasEstado,
          "No hay subtemas disponibles.",
        );
        cambiarEstadoPanel(
          elementos.accionesEstado,
          "No hay acciones disponibles para esta selección.",
        );
        return;
      }

      cambiarEstadoPanel(elementos.subtemasEstado, "", false);
      renderizarSubtemas();
      await seleccionarSubtema(estado.subtemas[0]);
    } catch (error) {
      if (solicitud !== estado.solicitudes.subtemas) {
        return;
      }
      registrarError("No fue posible consultar los subtemas.", error);
      cambiarEstadoPanel(
        elementos.subtemasEstado,
        "No fue posible consultar los subtemas autorizados.",
      );
    }
  }

  async function seleccionarTema(tema) {
    estado.temaId = tema.id_tema;
    elementos.temaSeleccionado.textContent = tema.nombre;
    elementos.breadcrumbTema.textContent = tema.nombre;
    actualizarBotonesSeleccionados(".seguimiento-tema", estado.temaId);
    await cargarSubtemas(tema.id_tema);
  }

  async function cargarTemas() {
    const solicitud = ++estado.solicitudes.temas;
    cambiarEstadoPanel(elementos.temasEstado, "Consultando temas autorizados…");

    try {
      const { data, error } = await cliente
        .from("temas")
        .select("id_tema,nombre,activo,orden")
        .eq("activo", true)
        .order("orden", { ascending: true })
        .order("id_tema", { ascending: true });

      if (error) {
        throw error;
      }

      if (solicitud !== estado.solicitudes.temas) {
        return;
      }

      estado.temas = data ?? [];

      if (!estado.temas.length) {
        cambiarEstadoPanel(elementos.temasEstado, "No hay temas disponibles.");
        cambiarEstadoPanel(
          elementos.subtemasEstado,
          "No hay subtemas disponibles.",
        );
        cambiarEstadoPanel(
          elementos.accionesEstado,
          "No hay acciones disponibles para esta selección.",
        );
        return;
      }

      cambiarEstadoPanel(elementos.temasEstado, "", false);
      renderizarTemas();
      await seleccionarTema(estado.temas[0]);
    } catch (error) {
      if (solicitud !== estado.solicitudes.temas) {
        return;
      }
      registrarError("No fue posible consultar los temas.", error);
      cambiarEstadoPanel(
        elementos.temasEstado,
        "No fue posible consultar los temas autorizados.",
      );
    }
  }

  async function cargarPerfil(session, revision) {
    const { data: perfil, error } = await cliente
      .from("perfiles")
      .select("usuario_id,nombre,tipo_usuario,activo")
      .eq("usuario_id", session.user.id)
      .maybeSingle();

    if (revision !== estado.revisionAutenticacion) {
      return;
    }

    if (error) {
      registrarError("No fue posible consultar el perfil.", error);
      mostrarBloqueo(
        "No fue posible validar el acceso",
        "No pudimos comprobar los permisos de esta cuenta. Intenta nuevamente más tarde.",
      );
      return;
    }

    if (!perfil) {
      mostrarBloqueo(
        "Perfil no autorizado",
        "Esta cuenta todavía no tiene un perfil autorizado. Solicita al administrador que complete su configuración.",
      );
      return;
    }

    if (!perfil.activo) {
      mostrarBloqueo(
        "Perfil inactivo",
        "El perfil asociado con esta cuenta está inactivo. Comunícate con el administrador.",
      );
      return;
    }

    estado.perfil = perfil;
    prepararIdentidad(perfil);
    mostrarVista("tablero");
    await cargarNovedadesCentral();
    await cargarTemas();
  }

  async function aplicarSession(session, forzar = false) {
    const usuarioId = session?.user?.id ?? null;

    if (
      !forzar &&
      estado.sessionInicializada &&
      estado.sessionUsuarioId === usuarioId
    ) {
      return;
    }

    estado.sessionInicializada = true;
    estado.sessionUsuarioId = usuarioId;
    estado.session = session;
    const revision = ++estado.revisionAutenticacion;

    limpiarColecciones();
    limpiarIdentidad();
    mostrarMensajeLogin();

    if (!session) {
      cerrarDetalleAccion(false);
      elementos.contrasena.value = "";
      mostrarVista("login");
      return;
    }

    mostrarCarga("Preparando tu espacio de trabajo…");
    await cargarPerfil(session, revision);
  }

  function alternarContrasena() {
    const mostrar = elementos.contrasena.type === "password";
    elementos.contrasena.type = mostrar ? "text" : "password";
    elementos.mostrarContrasena.textContent = mostrar ? "Ocultar" : "Mostrar";
    elementos.mostrarContrasena.setAttribute("aria-pressed", String(mostrar));
    elementos.mostrarContrasena.setAttribute(
      "aria-label",
      mostrar ? "Ocultar contraseña" : "Mostrar contraseña",
    );
  }

  async function iniciarSesion(event) {
    event.preventDefault();

    if (elementos.ingresar.disabled) {
      return;
    }

    const email = elementos.correo.value.trim();
    const password = elementos.contrasena.value;
    mostrarMensajeLogin();

    if (!email) {
      mostrarMensajeLogin("Captura tu correo electrónico.");
      elementos.correo.focus();
      return;
    }

    if (!password) {
      mostrarMensajeLogin("Captura tu contraseña.");
      elementos.contrasena.focus();
      return;
    }

    elementos.ingresar.disabled = true;
    elementos.ingresar.textContent = "Verificando…";

    try {
      const { data, error } = await cliente.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.session) {
        mostrarMensajeLogin(
          "No fue posible iniciar sesión. Verifica el correo y la contraseña.",
        );
        return;
      }

      elementos.contrasena.value = "";
      await aplicarSession(data.session);
    } catch (error) {
      registrarError("Falló la solicitud de inicio de sesión.", error);
      mostrarMensajeLogin(
        "No fue posible conectar con el servicio. Intenta nuevamente.",
      );
    } finally {
      elementos.ingresar.disabled = false;
      elementos.ingresar.textContent = "Ingresar";
    }
  }

  async function cerrarSesionCompartido() {
    if (cierreEnCurso) {
      return cierreEnCurso;
    }

    const botones = [
      elementos.headerSalir,
      elementos.bloqueoSalir,
      elementos.menuSalir,
    ].filter(Boolean);
    botones.forEach((boton) => {
      boton.disabled = true;
      boton.setAttribute("aria-busy", "true");
    });

    cierreEnCurso = (async () => {
      try {
        const { error } = await cliente.auth.signOut();
        if (error) {
          throw error;
        }
        await aplicarSession(null, true);
      } catch (error) {
        registrarError("No fue posible cerrar la sesión.", error);
        mostrarAviso(
          "No fue posible cerrar la sesión. Verifica tu conexión e intenta nuevamente.",
        );
      } finally {
        botones.forEach((boton) => {
          boton.disabled = false;
          boton.removeAttribute("aria-busy");
        });
        cierreEnCurso = null;
      }
    })();

    return cierreEnCurso;
  }

  async function inicializar() {
    elementos.loginForm.addEventListener("submit", iniciarSesion);
    elementos.mostrarContrasena.addEventListener("click", alternarContrasena);
    elementos.headerSalir?.addEventListener("click", () => {
      void cerrarSesionCompartido();
    });
    elementos.bloqueoSalir.addEventListener("click", () => {
      void cerrarSesionCompartido();
    });
    elementos.detalleCerrar.addEventListener("click", () => {
      cerrarDetalleAccion();
    });
    elementos.detalleBackdrop.addEventListener("click", () => {
      cerrarDetalleAccion();
    });
    elementos.estatus.addEventListener("change", () => {
      estado.formularioEditado = true;
      configurarAvancePorEstatus();
      actualizarEstadoBotonGuardar();
    });
    elementos.avanceRango.addEventListener("input", () => {
      estado.formularioEditado = true;
      sincronizarAvance(elementos.avanceRango, elementos.avanceNumero);
    });
    elementos.avanceNumero.addEventListener("input", () => {
      estado.formularioEditado = true;
      sincronizarAvance(elementos.avanceNumero, elementos.avanceRango);
    });
    elementos.comentarios.addEventListener("input", () => {
      estado.formularioEditado = true;
      actualizarEstadoBotonGuardar();
    });
    elementos.archivo.addEventListener("change", () => {
      estado.formularioEditado = true;
    });
    elementos.actualizacionForm.addEventListener(
      "submit",
      guardarActualizacion,
    );
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !elementos.detalleModal.hidden) {
        cerrarDetalleAccion();
      }
    });

    // El menú lateral y el header utilizan exactamente el mismo cierre real.
    window.cerrarSesionAplicacion = cerrarSesionCompartido;

    if (!cliente) {
      mostrarBloqueo(
        "Servicio no disponible",
        "No fue posible preparar la conexión segura. Recarga la página para intentarlo nuevamente.",
      );
      return;
    }

    const { data: listener } = cliente.auth.onAuthStateChange(
      (_evento, session) => {
        window.setTimeout(() => {
          void aplicarSession(session);
        }, 0);
      },
    );
    suscripcionAutenticacion = listener.subscription;

    const { data, error } = await cliente.auth.getSession();

    if (error) {
      registrarError("No fue posible comprobar la sesión actual.", error);
      mostrarVista("login");
      mostrarMensajeLogin(
        "No fue posible comprobar tu sesión. Puedes intentar iniciar sesión nuevamente.",
      );
      return;
    }

    await aplicarSession(data.session);
  }

  window.addEventListener("beforeunload", () => {
    suscripcionAutenticacion?.unsubscribe();
  });

  void inicializar();
})();
