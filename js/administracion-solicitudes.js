(() => {
  "use strict";
  const cliente = window.supabaseClient;
  const porId = (id) => document.getElementById(id);
  const DURACION_ENLACE_SEGUNDOS = 86400;
  const elementos = {
    verificando: porId("administracion-verificando"), contenido: porId("administracion-contenido"),
    identidad: porId("administracion-identidad"), usuario: porId("administracion-usuario"),
    badge: porId("administracion-menu-badge"), recargar: porId("administracion-recargar"),
    filtros: porId("administracion-filtros"), buscar: porId("administracion-buscar"),
    estado: porId("administracion-listado-estado"), tabla: porId("administracion-tabla-contenedor"),
    cuerpo: porId("administracion-tabla-cuerpo"), salir: porId("cerrar-sesion"),
    backdrop: porId("administracion-modal-backdrop"), modal: porId("administracion-modal"),
    modalTitulo: porId("administracion-modal-titulo"), modalCerrar: porId("administracion-modal-cerrar"),
    detalle: porId("administracion-detalle"), acciones: porId("administracion-acciones"),
    historial: porId("administracion-historial-lista"),
    enlaceBackdrop: porId("administracion-enlace-backdrop"), enlaceModal: porId("administracion-enlace-modal"),
    enlace: porId("administracion-enlace"), copiar: porId("administracion-copiar"),
    marcarEnviada: porId("administracion-marcar-enviada"), enlaceCerrar: porId("administracion-enlace-cerrar"),
    enlaceVigencia: porId("administracion-enlace-vigencia"),
  };
  const estado = { solicitudes: [], historiales: new Map(), filtro: "PENDIENTE", operando: false, actual: null, foco: null, enlace: "", enlaceSolicitudId: null, enlaceEventoId: null };

  function registrarError(contexto, error) {
    console.error(`[Administración] ${contexto}`, { codigo: error?.code ?? "desconocido" });
  }
  async function registrarErrorFuncion(contexto, error, data) {
    let respuesta = data && typeof data === "object" ? data : null;
    const codigoHttp = Number(error?.context?.status) || null;
    if (!respuesta && typeof error?.context?.clone === "function") {
      try {
        respuesta = await error.context.clone().json();
      } catch {
        respuesta = null;
      }
    }
    console.error(`[Administración] ${contexto}`, {
      codigoHttp,
      mensaje: typeof respuesta?.mensaje === "string" ? respuesta.mensaje : error?.message ?? "Respuesta no disponible",
      codigo: typeof respuesta?.codigo === "string" ? respuesta.codigo : error?.code ?? "desconocido",
    });
  }
  function texto(valor) { return valor == null || valor === "" ? "—" : String(valor); }
  function fecha(valor) {
    if (!valor) return "—";
    const dato = new Date(valor);
    return Number.isNaN(dato.getTime()) ? "—" : new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(dato);
  }
  function nombreDependencia(solicitud) {
    const relacion = solicitud.dependencias;
    if (Array.isArray(relacion)) return texto(relacion[0]?.nombre);
    return texto(relacion?.nombre);
  }
  function estadoVisual(solicitud) {
    if (solicitud.fecha_activacion) return { texto: "Cuenta activada", clase: "estado-activada" };
    if (solicitud.estado === "RECHAZADA") return { texto: "Rechazada", clase: "estado-rechazada" };
    if (solicitud.estado === "ERROR") return { texto: "Error", clase: "estado-error" };
    if (solicitud.estado === "PENDIENTE") return { texto: "Pendiente", clase: "estado-pendiente" };
    if (solicitud.estado === "APROBADA") {
      const ultimo = solicitud.fecha_ultimo_enlace ? new Date(solicitud.fecha_ultimo_enlace).getTime() : 0;
      const vencido = ultimo && Date.now() - ultimo >= DURACION_ENLACE_SEGUNDOS * 1000;
      if (vencido) return { texto: "Enlace vencido", clase: "estado-vencida" };
      if (solicitud.fecha_invitacion) return { texto: "Invitación enviada", clase: "estado-enviada" };
      return { texto: "Aprobada, invitación pendiente", clase: "estado-aprobada" };
    }
    return { texto: texto(solicitud.estado), clase: "estado-pendiente" };
  }
  function eventosSolicitud(idSolicitud) { return estado.historiales.get(Number(idSolicitud)) ?? []; }
  function tipoEvento(evento) { return evento.tipo_enlace === "INVITE" ? "Invitación" : "Recuperación"; }
  function motivoEvento(evento) {
    return { ALTA: "Alta", REENVIO: "Reenvío", OLVIDO_CONTRASENA: "Contraseña olvidada" }[evento.motivo] ?? texto(evento.motivo);
  }
  function estadoEvento(evento) {
    if (evento.fecha_envio) return { texto: "Correo enviado", clase: "evento-enviado" };
    const expiracion = new Date(evento.fecha_expiracion).getTime();
    if (Number.isFinite(expiracion) && expiracion <= Date.now()) return { texto: "Enlace vencido", clase: "evento-vencido" };
    return { texto: "Correo pendiente de envío", clase: "evento-pendiente" };
  }
  async function alertaError(mensaje = "No fue posible completar la operación.") {
    if (typeof window.Swal?.fire === "function") await window.Swal.fire({ icon: "error", title: "Ocurrió un problema", text: mensaje, confirmButtonText: "Aceptar", heightAuto: false });
  }
  async function alertaExito(mensaje) {
    if (typeof window.Swal?.fire === "function") await window.Swal.fire({ icon: "success", title: "Operación completada", text: mensaje, confirmButtonText: "Aceptar", heightAuto: false });
  }
  function actualizarBadge() {
    const total = estado.solicitudes.filter((item) => item.estado === "PENDIENTE").length;
    elementos.badge.textContent = String(total); elementos.badge.hidden = total === 0;
  }
  function solicitudesVisibles() {
    const termino = elementos.buscar.value.trim().toLocaleLowerCase("es");
    return estado.solicitudes.filter((item) => {
      if (estado.filtro !== "TODAS" && item.estado !== estado.filtro) return false;
      if (!termino) return true;
      return [item.nombre, item.email, nombreDependencia(item)].some((valor) => String(valor ?? "").toLocaleLowerCase("es").includes(termino));
    });
  }
  function celda(fila, etiqueta, valor) { const td = document.createElement("td"); td.dataset.label = etiqueta; td.textContent = texto(valor); fila.append(td); }
  function renderizar() {
    elementos.cuerpo.replaceChildren();
    const lista = solicitudesVisibles();
    if (!lista.length) { elementos.tabla.hidden = true; elementos.estado.hidden = false; elementos.estado.textContent = "No hay solicitudes que coincidan con los filtros seleccionados."; return; }
    lista.forEach((solicitud) => {
      const fila = document.createElement("tr");
      celda(fila, "Nombre", solicitud.nombre); celda(fila, "Correo", solicitud.email); celda(fila, "Dependencia", nombreDependencia(solicitud)); celda(fila, "Cargo", solicitud.cargo); celda(fila, "Solicitud", fecha(solicitud.fecha_solicitud));
      const tdEstado = document.createElement("td"); tdEstado.dataset.label = "Estado"; const etiqueta = document.createElement("span"); const visual = estadoVisual(solicitud); etiqueta.className = `administracion-estado-etiqueta ${visual.clase}`; etiqueta.textContent = visual.texto; tdEstado.append(etiqueta); fila.append(tdEstado);
      celda(fila, "Revisión", fecha(solicitud.fecha_revision)); celda(fila, "Invitación", fecha(solicitud.fecha_invitacion)); celda(fila, "Último enlace", fecha(solicitud.fecha_ultimo_enlace)); celda(fila, "Activación", fecha(solicitud.fecha_activacion)); celda(fila, "Enlaces", solicitud.numero_enlaces ?? 0);
      const tdAccion = document.createElement("td"); tdAccion.dataset.label = "Acciones"; const abrir = document.createElement("button"); abrir.type = "button"; abrir.className = "administracion-tabla__abrir"; abrir.textContent = "Revisar"; abrir.addEventListener("click", () => abrirDetalle(solicitud, abrir)); tdAccion.append(abrir); fila.append(tdAccion); elementos.cuerpo.append(fila);
    });
    elementos.estado.hidden = true; elementos.tabla.hidden = false;
  }
  async function cargarSolicitudes() {
    elementos.recargar.disabled = true; elementos.tabla.hidden = true; elementos.estado.hidden = false; elementos.estado.textContent = "Consultando solicitudes…";
    try {
      const { data, error } = await cliente.from("solicitudes_acceso").select("id_solicitud,nombre,email,dependencia_id,cargo,comentarios,estado,fecha_solicitud,fecha_revision,fecha_invitacion,fecha_ultimo_enlace,numero_enlaces,fecha_activacion,motivo_rechazo,mensaje_error,usuario_id,dependencias(nombre)").order("fecha_solicitud", { ascending: false });
      if (error) throw error;
      estado.solicitudes = data ?? [];
      estado.historiales = new Map();
      const ids = estado.solicitudes.map((solicitud) => solicitud.id_solicitud);
      if (ids.length) {
        const { data: eventos, error: errorHistorial } = await cliente.from("historial_enlaces_acceso").select("id_evento,solicitud_id,tipo_enlace,motivo,fecha_generacion,fecha_expiracion,fecha_envio").in("solicitud_id", ids).order("fecha_generacion", { ascending: false });
        if (errorHistorial) throw errorHistorial;
        (eventos ?? []).forEach((evento) => {
          const solicitudId = Number(evento.solicitud_id);
          const historial = estado.historiales.get(solicitudId) ?? [];
          historial.push(evento);
          estado.historiales.set(solicitudId, historial);
        });
      }
      actualizarBadge(); renderizar();
    } catch (error) { registrarError("No fue posible listar las solicitudes.", error); elementos.estado.textContent = "No fue posible consultar las solicitudes."; await alertaError("No fue posible consultar las solicitudes. Intenta nuevamente."); }
    finally { elementos.recargar.disabled = false; }
  }
  function agregarDetalle(etiqueta, valor) { const contenedor = document.createElement("div"); const dt = document.createElement("dt"); const dd = document.createElement("dd"); dt.textContent = etiqueta; dd.textContent = texto(valor); contenedor.append(dt, dd); elementos.detalle.append(contenedor); }
  function botonAccion(textoBoton, accion, clase = "administracion-boton--primario") { const boton = document.createElement("button"); boton.type = "button"; boton.className = `administracion-boton ${clase}`; boton.textContent = textoBoton; boton.addEventListener("click", () => { if (accion === "RECHAZAR") void solicitarRechazo(); else if (accion === "GENERAR_RECUPERACION") void confirmarRecuperacion(); else void resolver(accion); }); elementos.acciones.append(boton); }
  function datoEvento(etiqueta, valor) { const contenedor = document.createElement("div"); const termino = document.createElement("dt"); const detalle = document.createElement("dd"); termino.textContent = etiqueta; detalle.textContent = texto(valor); contenedor.append(termino, detalle); return contenedor; }
  function renderizarHistorial(solicitud) {
    elementos.historial.replaceChildren();
    const eventos = eventosSolicitud(solicitud.id_solicitud);
    if (!eventos.length) {
      const vacio = document.createElement("p"); vacio.className = "administracion-historial__vacio"; vacio.textContent = "No hay enlaces registrados para esta solicitud."; elementos.historial.append(vacio);
      if (solicitud.estado === "APROBADA" && !solicitud.fecha_invitacion && solicitud.fecha_ultimo_enlace) {
        const legado = document.createElement("button"); legado.type = "button"; legado.className = "administracion-boton administracion-boton--secundario"; legado.textContent = "Marcar invitación anterior como enviada"; legado.addEventListener("click", () => void marcarInvitacionAnterior(solicitud.id_solicitud, legado)); elementos.historial.append(legado);
      }
      return;
    }
    eventos.forEach((evento) => {
      const tarjeta = document.createElement("article"); tarjeta.className = "administracion-evento";
      const encabezado = document.createElement("div"); encabezado.className = "administracion-evento__encabezado";
      const titulo = document.createElement("h4"); titulo.textContent = `${tipoEvento(evento)} · ${motivoEvento(evento)}`;
      const visual = estadoEvento(evento); const etiqueta = document.createElement("span"); etiqueta.className = `administracion-evento__estado ${visual.clase}`; etiqueta.textContent = visual.texto; encabezado.append(titulo, etiqueta);
      const datos = document.createElement("dl"); datos.className = "administracion-evento__datos"; datos.append(datoEvento("Generación", fecha(evento.fecha_generacion)), datoEvento("Expiración estimada", fecha(evento.fecha_expiracion)), datoEvento("Fecha de envío", fecha(evento.fecha_envio)));
      tarjeta.append(encabezado, datos);
      if (!evento.fecha_envio) {
        const aviso = document.createElement("p"); aviso.className = "administracion-evento__vigencia"; aviso.textContent = visual.clase === "evento-vencido" ? "El enlace ya no funcionará; puedes registrar el envío únicamente como constancia administrativa." : `Vigente aproximadamente hasta ${fecha(evento.fecha_expiracion)}.`; tarjeta.append(aviso);
        const boton = document.createElement("button"); boton.type = "button"; boton.className = "administracion-boton administracion-boton--secundario"; boton.textContent = "Marcar como enviado"; boton.addEventListener("click", () => void confirmarEnvioEvento(evento.id_evento, boton)); tarjeta.append(boton);
      }
      elementos.historial.append(tarjeta);
    });
  }
  function abrirDetalle(solicitud, origen) {
    estado.actual = solicitud; estado.foco = origen; elementos.detalle.replaceChildren(); elementos.acciones.replaceChildren(); elementos.modalTitulo.textContent = solicitud.nombre;
    [["Correo",solicitud.email],["Dependencia",nombreDependencia(solicitud)],["Cargo",solicitud.cargo],["Comentarios",solicitud.comentarios],["Estado",estadoVisual(solicitud).texto],["Fecha de solicitud",fecha(solicitud.fecha_solicitud)],["Fecha de revisión",fecha(solicitud.fecha_revision)],["Fecha de invitación",fecha(solicitud.fecha_invitacion)],["Último enlace",fecha(solicitud.fecha_ultimo_enlace)],["Cuenta activada",fecha(solicitud.fecha_activacion)],["Enlaces generados",solicitud.numero_enlaces ?? 0],["Motivo de rechazo",solicitud.motivo_rechazo],["Mensaje de error",solicitud.mensaje_error]].forEach(([e,v]) => agregarDetalle(e,v));
    renderizarHistorial(solicitud);
    if (!solicitud.fecha_activacion) {
      if (solicitud.estado === "PENDIENTE") { botonAccion("Aprobar", "APROBAR"); botonAccion("Rechazar", "RECHAZAR", "administracion-boton--secundario"); }
      if (solicitud.estado === "ERROR") { botonAccion("Reintentar aprobación", "APROBAR"); botonAccion("Rechazar", "RECHAZAR", "administracion-boton--secundario"); }
      if (solicitud.estado === "APROBADA") botonAccion("Generar nuevo enlace", "REGENERAR_ENLACE");
    } else if (solicitud.estado === "APROBADA") {
      botonAccion("Restablecer contraseña", "GENERAR_RECUPERACION");
    }
    elementos.backdrop.hidden = false; elementos.modal.hidden = false; document.body.style.overflow = "hidden"; elementos.modal.focus();
  }
  function cerrarDetalle() { if (estado.operando || elementos.modal.hidden) return; elementos.modal.hidden = true; elementos.backdrop.hidden = true; document.body.style.overflow = ""; estado.actual = null; estado.foco?.focus(); estado.foco = null; }
  function establecerOperacion(activa) { estado.operando = activa; elementos.modalCerrar.disabled = activa; elementos.acciones.querySelectorAll("button").forEach((boton) => { boton.disabled = activa; }); elementos.marcarEnviada.disabled = activa; elementos.enlaceCerrar.disabled = activa; }
  async function solicitarRechazo() {
    if (typeof window.Swal?.fire !== "function") return;
    const resultado = await window.Swal.fire({ title: "Motivo del rechazo", input: "textarea", inputAttributes: { maxlength: "1000", "aria-label": "Motivo del rechazo" }, inputValidator: (valor) => { const longitud = valor.trim().replace(/\s+/g," ").length; return longitud < 5 || longitud > 1000 ? "Captura un motivo de entre 5 y 1000 caracteres." : undefined; }, showCancelButton: true, confirmButtonText: "Rechazar solicitud", cancelButtonText: "Cancelar", heightAuto: false });
    if (resultado.isConfirmed) await resolver("RECHAZAR", resultado.value.trim().replace(/\s+/g," "));
  }
  async function confirmarRecuperacion() {
    if (estado.operando || !estado.actual) return;
    if (typeof window.Swal?.fire !== "function") { await resolver("GENERAR_RECUPERACION"); return; }
    const resultado = await window.Swal.fire({ icon: "question", title: "Generar enlace de recuperación", text: "Se generará un enlace temporal para que el usuario establezca una nueva contraseña. La cuenta permanecerá activa.", showCancelButton: true, confirmButtonText: "Generar enlace", cancelButtonText: "Cancelar", heightAuto: false });
    if (resultado.isConfirmed) await resolver("GENERAR_RECUPERACION");
  }
  async function resolver(accion, motivo_rechazo) {
    if (estado.operando || !estado.actual) return;
    establecerOperacion(true);
    try {
      const body = { accion, id_solicitud: estado.actual.id_solicitud }; if (motivo_rechazo) body.motivo_rechazo = motivo_rechazo;
      const { data, error } = await cliente.functions.invoke("resolver-solicitud-acceso", { body });
      if (error || data?.ok !== true) throw error ?? new Error("Respuesta no válida.");
      const solicitudAnterior = estado.actual;
      establecerOperacion(false);
      cerrarDetalle();
      await cargarSolicitudes();
      const enlaceGenerado = data.enlace ?? data.action_link;
      if (enlaceGenerado) abrirEnlace(enlaceGenerado, solicitudAnterior.id_solicitud, data.id_evento ?? null, data.fecha_expiracion ?? null);
      else await alertaExito(data.mensaje ?? "La solicitud fue actualizada correctamente.");
    } catch (error) { registrarError("No fue posible resolver la solicitud.", error); await alertaError("No fue posible completar la operación. Revisa el estado de la solicitud e intenta nuevamente."); }
    finally { establecerOperacion(false); }
  }
  function abrirEnlace(enlace, idSolicitud, idEvento, fechaExpiracion) { estado.enlace = enlace; estado.enlaceSolicitudId = idSolicitud; estado.enlaceEventoId = idEvento; elementos.enlace.value = enlace; elementos.enlaceVigencia.textContent = fechaExpiracion ? `Este enlace vence aproximadamente el ${fecha(fechaExpiracion)}.` : "Este enlace vence en 24 horas."; elementos.marcarEnviada.hidden = false; elementos.enlaceBackdrop.hidden = false; elementos.enlaceModal.hidden = false; document.body.style.overflow = "hidden"; elementos.enlaceModal.focus(); }
  function cerrarEnlace() { if (estado.operando) return; elementos.enlaceModal.hidden = true; elementos.enlaceBackdrop.hidden = true; elementos.enlace.value = ""; elementos.enlaceVigencia.textContent = "Este enlace vence en 24 horas."; estado.enlace = ""; estado.enlaceSolicitudId = null; estado.enlaceEventoId = null; document.body.style.overflow = ""; }
  async function copiarEnlace() { if (!estado.enlace) return; try { await navigator.clipboard.writeText(estado.enlace); await alertaExito("El enlace se copió al portapapeles."); } catch (error) { registrarError("No fue posible copiar el enlace.", error); elementos.enlace.focus(); elementos.enlace.select(); await alertaError("No fue posible copiar automáticamente. Selecciona y copia el enlace manualmente."); } }
  function actualizarEventoLocal(evento) {
    if (!evento?.id_evento || !evento?.solicitud_id) return;
    const solicitudId = Number(evento.solicitud_id); const eventos = eventosSolicitud(solicitudId); const indice = eventos.findIndex((item) => Number(item.id_evento) === Number(evento.id_evento));
    if (indice >= 0) eventos[indice] = { ...eventos[indice], ...evento }; else eventos.unshift(evento);
    estado.historiales.set(solicitudId, eventos);
    const solicitud = estado.solicitudes.find((item) => Number(item.id_solicitud) === solicitudId);
    if (solicitud && evento.tipo_enlace === "INVITE" && evento.fecha_envio && !solicitud.fecha_invitacion) solicitud.fecha_invitacion = evento.fecha_envio;
    if (estado.actual && Number(estado.actual.id_solicitud) === solicitudId) renderizarHistorial(estado.actual);
    renderizar();
  }
  async function confirmarEnvioEvento(idEvento, boton = null, cerrarModalEnlace = false) {
    if (estado.operando || !idEvento) return;
    if (typeof window.Swal?.fire === "function") {
      const confirmacion = await window.Swal.fire({ icon: "question", title: "Confirmar envío", text: "¿Confirmas que el correo con este enlace ya fue enviado?", showCancelButton: true, confirmButtonText: "Sí, registrar envío", cancelButtonText: "Cancelar", heightAuto: false });
      if (!confirmacion.isConfirmed) return;
    }
    await marcarEventoEnviado(idEvento, boton, cerrarModalEnlace);
  }
  async function marcarEventoEnviado(idEvento, boton = null, cerrarModalEnlace = false) {
    const idEventoNumerico = Number(idEvento);
    if (!Number.isInteger(idEventoNumerico) || idEventoNumerico <= 0) {
      registrarError("Identificador de evento inválido.", { code: "EVENTO_INVALIDO" });
      await alertaError("No fue posible identificar el evento que deseas marcar.");
      return;
    }
    establecerOperacion(true); if (boton) boton.disabled = true;
    try {
      const { data, error } = await cliente.functions.invoke(
        "resolver-solicitud-acceso",
        {
          body: {
            accion: "MARCAR_ENLACE_ENVIADO",
            id_evento: idEventoNumerico,
          },
        },
      );
      if (error || data?.ok !== true || !data.evento) {
        await registrarErrorFuncion("La función rechazó el registro del envío.", error, data);
        throw error ?? new Error("Respuesta no válida.");
      }
      actualizarEventoLocal(data.evento); establecerOperacion(false); if (cerrarModalEnlace) cerrarEnlace();
      if (typeof window.Swal?.fire === "function") await window.Swal.fire({ icon: "success", title: "Envío registrado", text: "Se registró correctamente que el enlace fue enviado.", confirmButtonText: "Aceptar", heightAuto: false });
    } catch (error) { registrarError("No fue posible registrar el envío.", error); await alertaError("No fue posible registrar el envío. Intenta nuevamente."); }
    finally { establecerOperacion(false); if (boton) boton.disabled = false; }
  }
  async function marcarInvitacionAnterior(idSolicitud, boton) {
    if (estado.operando) return;
    const desdeModalEnlace = !elementos.enlaceModal.hidden;
    if (typeof window.Swal?.fire === "function") { const confirmacion = await window.Swal.fire({ icon: "question", title: "Confirmar envío", text: "¿Confirmas que la invitación anterior ya fue enviada?", showCancelButton: true, confirmButtonText: "Sí, registrar envío", cancelButtonText: "Cancelar", heightAuto: false }); if (!confirmacion.isConfirmed) return; }
    establecerOperacion(true); boton.disabled = true;
    try { const { data, error } = await cliente.functions.invoke("resolver-solicitud-acceso", { body: { accion: "MARCAR_ENVIADA", id_solicitud: Number(idSolicitud) } }); if (error || data?.ok !== true) throw error ?? new Error("Respuesta no válida."); const solicitud = estado.solicitudes.find((item) => Number(item.id_solicitud) === Number(idSolicitud)); if (solicitud) solicitud.fecha_invitacion = data.fecha_invitacion ?? new Date().toISOString(); if (estado.actual) renderizarHistorial(estado.actual); renderizar(); establecerOperacion(false); if (desdeModalEnlace) cerrarEnlace(); await alertaExito("Se registró el envío de la invitación anterior."); }
    catch (error) { registrarError("No fue posible registrar la invitación anterior.", error); await alertaError("No fue posible registrar el envío."); }
    finally { establecerOperacion(false); boton.disabled = false; }
  }
  async function marcarEnviada() {
    if (estado.enlaceEventoId) { await confirmarEnvioEvento(estado.enlaceEventoId, elementos.marcarEnviada, true); return; }
    if (estado.enlaceSolicitudId) await marcarInvitacionAnterior(estado.enlaceSolicitudId, elementos.marcarEnviada);
  }
  async function cerrarSesion() { if (estado.operando) return; const { error } = await cliente.auth.signOut(); if (error) { registrarError("No fue posible cerrar la sesión.", error); await alertaError("No fue posible cerrar la sesión."); return; } window.location.replace("index.html"); }
  async function inicializar() {
    if (!cliente) { window.location.replace("index.html"); return; }
    const { data, error } = await cliente.auth.getSession(); if (error || !data.session) { window.location.replace("index.html"); return; }
    const { data: perfil, error: errorPerfil } = await cliente.from("perfiles").select("usuario_id,nombre,tipo_usuario,activo").eq("usuario_id", data.session.user.id).maybeSingle();
    if (errorPerfil || !perfil || !perfil.activo || perfil.tipo_usuario !== "ADMINISTRADOR") { window.location.replace(perfil ? "captura-seguimiento.html" : "index.html"); return; }
    elementos.usuario.textContent = perfil.nombre; elementos.identidad.hidden = false; elementos.verificando.hidden = true; elementos.contenido.hidden = false; await cargarSolicitudes();
  }
  elementos.recargar.addEventListener("click", () => void cargarSolicitudes()); elementos.buscar.addEventListener("input", renderizar);
  elementos.filtros.querySelectorAll("button").forEach((boton) => boton.addEventListener("click", () => { estado.filtro = boton.dataset.estado; elementos.filtros.querySelectorAll("button").forEach((item) => item.setAttribute("aria-selected", String(item === boton))); renderizar(); }));
  elementos.modalCerrar.addEventListener("click", cerrarDetalle); elementos.enlaceCerrar.addEventListener("click", cerrarEnlace); elementos.copiar.addEventListener("click", () => void copiarEnlace()); elementos.marcarEnviada.addEventListener("click", () => void marcarEnviada());
  window.cerrarSesionAplicacion = cerrarSesion; void inicializar();
})();
