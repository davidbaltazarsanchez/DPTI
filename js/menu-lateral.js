(() => {
  "use strict";

  const body = document.body;
  const toggleButton = document.getElementById("menu-toggle");
  const menu = document.getElementById("menu-lateral");
  const backdrop = document.getElementById("menu-lateral-backdrop");
  const menuNavigationLinks =
    menu?.querySelectorAll("a.menu-lateral__item") ?? [];
  const logoutButton = document.getElementById("cerrar-sesion");

  // Integración pendiente: asignar la ruta real de acceso cuando exista.
  const ACCESS_PAGE_URL = "";

  if (!toggleButton || !menu || !backdrop) {
    return;
  }

  let menuIsOpen = false;

  const setMenuState = (open, restoreFocus = true) => {
    menuIsOpen = open;
    toggleButton.setAttribute("aria-expanded", String(open));
    toggleButton.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    menu.setAttribute("aria-hidden", String(!open));

    if (open) {
      backdrop.hidden = false;
      backdrop.setAttribute("aria-hidden", "false");

      // Permite que el navegador anime desde el estado cerrado sin parpadeos.
      window.requestAnimationFrame(() => {
        body.classList.add("menu-lateral-open");
        menu.classList.add("is-open");
        backdrop.classList.add("is-visible");
        toggleButton.focus();
      });
      return;
    }

    body.classList.remove("menu-lateral-open");
    menu.classList.remove("is-open");
    backdrop.classList.remove("is-visible");
    backdrop.setAttribute("aria-hidden", "true");

    window.setTimeout(() => {
      if (!menuIsOpen) {
        backdrop.hidden = true;
      }
    }, 280);

    if (restoreFocus) {
      toggleButton.focus();
    }
  };

  const getFocusableElements = () => [
    toggleButton,
    ...Array.from(
      menu.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ),
  ];

  toggleButton.addEventListener("click", () => {
    setMenuState(!menuIsOpen);
  });

  toggleButton.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setMenuState(!menuIsOpen);
    }
  });

  backdrop.addEventListener("click", () => {
    setMenuState(false);
  });

  menuNavigationLinks.forEach((link) => {
    link.addEventListener("click", () => {
      // La navegación continúa normalmente después de cerrar el panel.
      setMenuState(false, false);
    });
  });

  /*
   * Punto de conexión para autenticación:
   * 1. Exponer el cliente inicializado como window.supabaseClient.
   * 2. Definir ACCESS_PAGE_URL con la pantalla de acceso real.
   * Mientras esos elementos no existan, no se simula el cierre ni se redirige.
   */
  async function cerrarSesion() {
    if (!logoutButton || logoutButton.disabled) {
      return;
    }

    logoutButton.disabled = true;
    logoutButton.setAttribute("aria-busy", "true");
    setMenuState(false, false);

    try {
      // Las pantallas con autenticación pueden compartir su cierre real.
      if (typeof window.cerrarSesionAplicacion === "function") {
        await window.cerrarSesionAplicacion();
        return;
      }

      const supabaseClient = window.supabaseClient;

      if (!supabaseClient?.auth?.signOut) {
        return;
      }

      const { error } = await supabaseClient.auth.signOut();

      if (error) {
        throw error;
      }

      if (ACCESS_PAGE_URL) {
        window.location.assign(ACCESS_PAGE_URL);
      }
    } catch (error) {
      // Evita una promesa sin gestionar; conserva el error para diagnóstico.
      console.error("No fue posible cerrar la sesión.", error);
    } finally {
      logoutButton.disabled = false;
      logoutButton.removeAttribute("aria-busy");
    }
  }

  logoutButton?.addEventListener("click", () => {
    void cerrarSesion();
  });

  document.addEventListener("keydown", (event) => {
    if (!menuIsOpen) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setMenuState(false);
      return;
    }

    // Mantiene el foco dentro del menú mientras funciona como panel modal.
    if (event.key === "Tab") {
      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  });
})();
