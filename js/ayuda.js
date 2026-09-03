(() => {
  "use strict";

  const botonAbrir = document.querySelector(".ayuda-boton");
  if (!botonAbrir) return;

  const URL_VIDEO_AYUDA = document.body.dataset.videoAyuda?.trim() ?? "";
  let abierto = false;
  let focoAnterior = null;

  const backdrop = document.createElement("div");
  backdrop.className = "ayuda-modal-backdrop";
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <section
      id="ayuda-modal"
      class="ayuda-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ayuda-modal-titulo"
      tabindex="-1"
    >
      <header class="ayuda-modal__cabecera">
        <h2 id="ayuda-modal-titulo">Ayuda</h2>
        <button
          class="ayuda-modal__cerrar-icono"
          type="button"
          aria-label="Cerrar ayuda"
        >×</button>
      </header>
      <div class="ayuda-modal__contenido">
        <p class="ayuda-modal__subtitulo">Video tutorial</p>
        <div class="ayuda-modal__video" data-ayuda-video></div>
      </div>
      <div class="ayuda-modal__acciones">
        <button class="ayuda-modal__cerrar" type="button">Cerrar</button>
      </div>
    </section>
  `;
  document.body.append(backdrop);

  const modal = backdrop.querySelector(".ayuda-modal");
  const contenedorVideo = backdrop.querySelector("[data-ayuda-video]");
  const botonesCerrar = backdrop.querySelectorAll(
    ".ayuda-modal__cerrar-icono, .ayuda-modal__cerrar",
  );

  function crearVideo() {
    contenedorVideo.replaceChildren();

    if (!URL_VIDEO_AYUDA) {
      const pendiente = document.createElement("p");
      pendiente.className = "ayuda-modal__pendiente";
      pendiente.textContent =
        "El video tutorial estará disponible próximamente.";
      contenedorVideo.append(pendiente);
      return;
    }

    let url;
    try {
      url = new URL(URL_VIDEO_AYUDA, window.location.href);
    } catch {
      return;
    }

    if (!["http:", "https:"].includes(url.protocol)) return;

    if (/\.(?:mp4|webm|ogg)(?:$|[?#])/i.test(url.href)) {
      const video = document.createElement("video");
      video.controls = true;
      video.preload = "metadata";
      video.src = url.href;
      contenedorVideo.append(video);
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.src = url.href;
    iframe.title = "Video tutorial de ayuda";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allow = "autoplay; fullscreen; picture-in-picture";
    iframe.allowFullscreen = true;
    contenedorVideo.append(iframe);
  }

  function elementosEnfocables() {
    return Array.from(
      modal.querySelectorAll(
        'button:not([disabled]), a[href], iframe, video[controls], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((elemento) => !elemento.hidden);
  }

  function abrir() {
    if (abierto) return;
    abierto = true;
    focoAnterior = document.activeElement;
    crearVideo();
    backdrop.hidden = false;
    document.body.classList.add("ayuda-modal-abierto");
    botonAbrir.setAttribute("aria-expanded", "true");
    modal.focus();
  }

  function cerrar() {
    if (!abierto) return;
    abierto = false;

    const video = contenedorVideo.querySelector("video");
    if (video) video.pause();
    contenedorVideo.replaceChildren();

    backdrop.hidden = true;
    document.body.classList.remove("ayuda-modal-abierto");
    botonAbrir.setAttribute("aria-expanded", "false");
    const destinoFoco = focoAnterior?.isConnected ? focoAnterior : botonAbrir;
    destinoFoco.focus();
    focoAnterior = null;
  }

  botonAbrir.addEventListener("click", abrir);
  botonesCerrar.forEach((boton) => boton.addEventListener("click", cerrar));

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) cerrar();
  });

  document.addEventListener("keydown", (event) => {
    if (!abierto) return;

    if (event.key === "Escape") {
      event.preventDefault();
      cerrar();
      return;
    }

    if (event.key !== "Tab") return;
    const enfocables = elementosEnfocables();
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (!primero || !ultimo) {
      event.preventDefault();
      modal.focus();
      return;
    }

    if (event.shiftKey && document.activeElement === primero) {
      event.preventDefault();
      ultimo.focus();
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault();
      primero.focus();
    } else if (!modal.contains(document.activeElement)) {
      event.preventDefault();
      primero.focus();
    }
  });
})();
