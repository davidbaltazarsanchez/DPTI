(() => {
  "use strict";

  const SUPABASE_URL = "https://uztwglolrfkpzyarthie.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_EcJiWFS9fTAdLzwRYH9-gg_tkhgZzhP";

  if (window.supabaseClient) {
    return;
  }

  if (!window.supabase?.createClient) {
    console.error("No fue posible cargar la biblioteca pública de Supabase.");
    return;
  }

  // Cliente público único. Supabase administra y persiste la sesión.
  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
})();
