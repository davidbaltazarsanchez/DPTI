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
    enlaceBackdrop: porId("administracion-enlace-backdrop"), enlaceModal: porId("administracion-enlace-modal"),
    enlace: porId("administracion-enlace"), copiar: porId("administracion-copiar"),
    marcarEnviada: porId("administracion-marcar-enviada"), enlaceCerrar: porId("administracion-enlace-cerrar"),
  };
  const estado = { solicitudes: [], filtro: "PENDIENTE", operando: false, actual: null, foco: null, enlace: "", enlaceSolicitudId: null };

  function registrarError(contexto, error) {
    console.error(`[Administración] ${contexto}`, { codigo: error?.code ?? "desconocido" });
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
      estado.solicitudes = data ?? []; actualizarBadge(); renderizar();
    } catch (error) { registrarError("No fue posible listar las solicitudes.", error); elementos.estado.textContent = "No fue posible consultar las solicitudes."; await alertaError("No fue posible consultar las solicitudes. Intenta nuevamente."); }
    finally { elementos.recargar.disabled = false; }
  }
  function agregarDetalle(etiqueta, valor) { const contenedor = document.createElement("div"); const dt = document.createElement("dt"); const dd = document.createElement("dd"); dt.textContent = etiqueta; dd.textContent = texto(valor); contenedor.append(dt, dd); elementos.detalle.append(contenedor); }
  function botonAccion(textoBoton, accion, clase = "administracion-boton--primario") { const boton = document.createElement("button"); boton.type = "button"; boton.className = `administracion-boton ${clase}`; boton.textContent = textoBoton; boton.addEventListener("click", () => { if (accion === "RECHAZAR") void solicitarRechazo(); else void resolver(accion); }); elementos.acciones.append(boton); }
  function abrirDetalle(solicitud, origen) {
    estado.actual = solicitud; estado.foco = origen; elementos.detalle.replaceChildren(); elementos.acciones.replaceChildren(); elementos.modalTitulo.textContent = solicitud.nombre;
    [["Correo",solicitud.email],["Dependencia",nombreDependencia(solicitud)],["Cargo",solicitud.cargo],["Comentarios",solicitud.comentarios],["Estado",estadoVisual(solicitud).texto],["Fecha de solicitud",fecha(solicitud.fecha_solicitud)],["Fecha de revisión",fecha(solicitud.fecha_revision)],["Fecha de invitación",fecha(solicitud.fecha_invitacion)],["Último enlace",fecha(solicitud.fecha_ultimo_enlace)],["Cuenta activada",fecha(solicitud.fecha_activacion)],["Enlaces generados",solicitud.numero_enlaces ?? 0],["Motivo de rechazo",solicitud.motivo_rechazo],["Mensaje de error",solicitud.mensaje_error]].forEach(([e,v]) => agregarDetalle(e,v));
    if (!solicitud.fecha_activacion) {
      if (solicitud.estado === "PENDIENTE") { botonAccion("Aprobar", "APROBAR"); botonAccion("Rechazar", "RECHAZAR", "administracion-boton--secundario"); }
      if (solicitud.estado === "ERROR") { botonAccion("Reintentar aprobación", "APROBAR"); botonAccion("Rechazar", "RECHAZAR", "administracion-boton--secundario"); }
      if (solicitud.estado === "APROBADA") botonAccion("Generar nuevo enlace", "REGENERAR_ENLACE");
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
      if (data.action_link) abrirEnlace(data.action_link, solicitudAnterior.id_solicitud, Boolean(solicitudAnterior.fecha_invitacion));
      else await alertaExito(data.mensaje ?? "La solicitud fue actualizada correctamente.");
    } catch (error) { registrarError("No fue posible resolver la solicitud.", error); await alertaError("No fue posible completar la operación. Revisa el estado de la solicitud e intenta nuevamente."); }
    finally { establecerOperacion(false); }
  }
  function abrirEnlace(enlace, idSolicitud, yaEnviada) { estado.enlace = enlace; estado.enlaceSolicitudId = idSolicitud; elementos.enlace.value = enlace; elementos.marcarEnviada.hidden = yaEnviada; elementos.enlaceBackdrop.hidden = false; elementos.enlaceModal.hidden = false; document.body.style.overflow = "hidden"; elementos.enlaceModal.focus(); }
  function cerrarEnlace() { if (estado.operando) return; elementos.enlaceModal.hidden = true; elementos.enlaceBackdrop.hidden = true; elementos.enlace.value = ""; estado.enlace = ""; estado.enlaceSolicitudId = null; document.body.style.overflow = ""; }
  async function copiarEnlace() { if (!estado.enlace) return; try { await navigator.clipboard.writeText(estado.enlace); await alertaExito("El enlace se copió al portapapeles."); } catch (error) { registrarError("No fue posible copiar el enlace.", error); elementos.enlace.focus(); elementos.enlace.select(); await alertaError("No fue posible copiar automáticamente. Selecciona y copia el enlace manualmente."); } }
  async function marcarEnviada() { if (estado.operando || !estado.enlaceSolicitudId) return; establecerOperacion(true); try { const { data, error } = await cliente.functions.invoke("resolver-solicitud-acceso", { body: { accion: "MARCAR_ENVIADA", id_solicitud: estado.enlaceSolicitudId } }); if (error || data?.ok !== true) throw error ?? new Error("Respuesta no válida."); establecerOperacion(false); cerrarEnlace(); await cargarSolicitudes(); await alertaExito("La invitación quedó marcada como enviada."); } catch (error) { registrarError("No fue posible marcar la invitación.", error); await alertaError("No fue posible marcar la invitación como enviada."); } finally { establecerOperacion(false); } }
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
