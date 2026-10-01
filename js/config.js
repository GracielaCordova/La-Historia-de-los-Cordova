/* =========================================================
   CONFIGURACIÓN DEL SITIO — edita solo este archivo
   ========================================================= */
window.CONFIG = {
  // Dirección del «buzón» de aportes (Cloudflare Worker). Ver worker/LEEME.md.
  // Mientras esté vacío, el formulario permite descargar el aporte y enviarlo por WhatsApp o correo.
  endpointAportes: "",

  // Clave pública de Cloudflare Turnstile (antispam, opcional). Déjalo vacío para no usarlo.
  turnstileSiteKey: "",

  // Repositorio de GitHub, en formato "usuario/repositorio". Se usa para el enlace de «Administración».
  repositorio: "",

  // Correo o WhatsApp para pedir cambios o que se retire información (aparece en Privacidad).
  contacto: ""
};
