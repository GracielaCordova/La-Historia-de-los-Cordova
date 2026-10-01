/* =========================================================
   Buzón de aportes — Cloudflare Worker
   Recibe lo que la familia envía desde el sitio y lo convierte en una
   PROPUESTA (pull request) en GitHub. Nada se publica hasta que la
   administradora la aprueba (botón «Merge»).

   Variables (Settings → Variables and Secrets del Worker):
     GITHUB_TOKEN     (secreto) token «fine-grained» con permisos Contents y Pull requests: Read and write
     REPOSITORIO      usuario/repositorio   (ej. gracecordova/mama-martina)
     ORIGEN_PERMITIDO https://usuario.github.io   (dirección del sitio, sin barra final)
     TURNSTILE_SECRET (secreto, opcional) clave secreta de Cloudflare Turnstile
   ========================================================= */

const TIPOS = { persona: 'personas', foto: 'fotos', lugar: 'lugares', recuerdo: 'recuerdos' };
const MAX_FOTO = 2_500_000;       // bytes de la foto ya reducida
const MAX_TEXTO = 8000;           // caracteres por campo de texto largo

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ORIGEN_PERMITIDO || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };
    const responder = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return responder({ ok: false, error: 'Método no permitido' }, 405);
    const origen = req.headers.get('Origin') || '';
    if (env.ORIGEN_PERMITIDO && origen !== env.ORIGEN_PERMITIDO) return responder({ ok: false, error: 'Origen no permitido' }, 403);

    let a;
    try { a = await req.json(); } catch { return responder({ ok: false, error: 'Datos inválidos' }, 400); }

    // --- Antispam
    if (a.sitio_web) return responder({ ok: true, pr: 0 });                       // trampa para robots
    if (env.TURNSTILE_SECRET) {
      const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: a.turnstile || '', remoteip: req.headers.get('CF-Connecting-IP') || '' })
      }).then(r => r.json());
      if (!v.success) return responder({ ok: false, error: 'Verificación antispam fallida' }, 400);
    }

    // --- Validación
    const carpeta = TIPOS[a.tipo];
    if (!carpeta) return responder({ ok: false, error: 'Tipo de aporte desconocido' }, 400);
    if (!a.consentimiento) return responder({ ok: false, error: 'Falta el consentimiento' }, 400);
    const autor = { nombre: corto(a.autor?.nombre, 80), relacion: corto(a.autor?.relacion, 120) };
    if (!autor.nombre) return responder({ ok: false, error: 'Falta tu nombre' }, 400);

    const fecha = new Date().toISOString();
    const base = slug(a.datos?.nombre || a.datos?.titulo || a.datos?.persona || a.tipo);
    let id = a.tipo === 'persona' && a.datos?.id_sugerido ? slug(a.datos.id_sugerido) : `${base}-${fecha.slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6)}`;
    // Si ya existe una persona con ese id, se agrega un sufijo
    if (a.tipo === 'persona') {
      const existe = await fetch(`https://api.github.com/repos/${env.REPOSITORIO}/contents/data/aportes/personas/${id}.json`, {
        headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'buzon-aportes-mama-martina', Accept: 'application/vnd.github+json' }
      });
      if (existe.ok) id = `${id}-${Math.random().toString(36).slice(2, 5)}`;
    }
    const datos = limpiar(a.tipo, a.datos || {});
    const archivo = { id, tipo: a.tipo, ...datos, aportado_por: autor, fecha };

    const archivos = [];
    if (a.foto) {
      const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(a.foto);
      if (!m) return responder({ ok: false, error: 'Foto inválida' }, 400);
      if (m[2].length * 0.75 > MAX_FOTO) return responder({ ok: false, error: 'La foto es demasiado grande' }, 400);
      const ruta = `img/aportes/${id}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
      archivos.push({ ruta, base64: m[2] });
      if (a.tipo === 'foto') archivo.archivo = ruta; else archivo.foto = ruta;
    }
    if (a.tipo === 'foto' && !archivo.archivo) return responder({ ok: false, error: 'Falta la foto' }, 400);
    archivos.push({ ruta: `data/aportes/${carpeta}/${id}.json`, base64: b64(JSON.stringify(archivo, null, 2) + '\n') });

    // --- GitHub: rama nueva + archivos + propuesta
    try {
      const gh = cliente(env);
      const repo = await gh(`/repos/${env.REPOSITORIO}`);
      const principal = repo.default_branch || 'main';
      const ref = await gh(`/repos/${env.REPOSITORIO}/git/ref/heads/${principal}`);
      const rama = `aporte/${id}`;
      await gh(`/repos/${env.REPOSITORIO}/git/refs`, 'POST', { ref: `refs/heads/${rama}`, sha: ref.object.sha });
      for (const f of archivos) {
        await gh(`/repos/${env.REPOSITORIO}/contents/${f.ruta}`, 'PUT', { message: `Aporte: ${titulo(archivo)}`, content: f.base64, branch: rama });
      }
      const pr = await gh(`/repos/${env.REPOSITORIO}/pulls`, 'POST', {
        title: `Aporte (${a.tipo}): ${titulo(archivo)} — de ${autor.nombre}`,
        head: rama, base: principal, body: cuerpoPR(archivo, archivos, env.REPOSITORIO, rama)
      });
      await gh(`/repos/${env.REPOSITORIO}/issues/${pr.number}/labels`, 'POST', { labels: ['aporte', a.tipo] }).catch(() => {});
      return responder({ ok: true, pr: pr.number });
    } catch (e) {
      return responder({ ok: false, error: 'No se pudo guardar el aporte. Intenta de nuevo más tarde.', detalle: String(e.message || e).slice(0, 300) }, 502);
    }
  }
};

/* ---------- utilidades ---------- */
function cliente(env) {
  return async (ruta, method = 'GET', body) => {
    const r = await fetch('https://api.github.com' + ruta, {
      method,
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'buzon-aportes-mama-martina', 'X-GitHub-Api-Version': '2022-11-28' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!r.ok) throw new Error(`GitHub ${r.status} en ${ruta}: ${await r.text()}`);
    return r.status === 204 ? {} : r.json();
  };
}
function b64(texto) { const bytes = new TextEncoder().encode(texto); let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function corto(v, n) { return String(v ?? '').trim().slice(0, n); }
function slug(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'aporte'; }
function lista(v, n = 10) { return (Array.isArray(v) ? v : []).map(x => slug(x)).filter(Boolean).slice(0, n); }
function trad(v, n) { if (!v || typeof v !== 'object') return {}; const o = {}; for (const k of ['es', 'nl', 'en']) if (v[k]) o[k] = corto(v[k], n); return o; }
function limpiar(tipo, d) {
  if (tipo === 'persona') return {
    nombre: corto(d.nombre, 120), apodo: corto(d.apodo, 120), nacimiento: corto(d.nacimiento, 40), fallecimiento: corto(d.fallecimiento, 40),
    lugar: corto(d.lugar, 160), padres: lista(d.padres, 2), pareja: lista(d.pareja, 3), rol: trad(d.rol, 200), bio: trad(d.bio, MAX_TEXTO),
    vive: !!d.vive, seccion: 'hoy', fuente: 'familia'
  };
  if (tipo === 'foto') return {
    titulo: corto(d.titulo, 160), descripcion: corto(d.descripcion, MAX_TEXTO), anio: corto(d.anio, 40), lugar: corto(d.lugar, 160), personas: lista(d.personas, 30)
  };
  if (tipo === 'lugar') {
    const c = Array.isArray(d.coords) && d.coords.length === 2 && d.coords.every(n => Number.isFinite(+n)) ? d.coords.map(Number) : null;
    return { nombre: corto(d.nombre, 160), coords: c, desc: trad(d.desc, MAX_TEXTO), dato: corto(d.dato, 600), personas: lista(d.personas, 30) };
  }
  if (tipo === 'recuerdo') return { persona: slug(d.persona || ''), texto: corto(d.texto, MAX_TEXTO), es_correccion: !!d.es_correccion };
  return {};
}
function titulo(a) { return a.nombre || a.titulo || (a.persona ? `sobre ${a.persona}` : a.id); }
function cuerpoPR(a, archivos, repo, rama) {
  const img = archivos.find(f => f.ruta.startsWith('img/'));
  const filas = Object.entries(a).filter(([k]) => !['id', 'tipo', 'aportado_por', 'fecha'].includes(k))
    .map(([k, v]) => `| ${k} | ${String(typeof v === 'object' ? JSON.stringify(v) : v).replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 400)} |`).join('\n');
  return `## Nuevo aporte: ${a.tipo}

**Enviado por:** ${a.aportado_por.nombre}${a.aportado_por.relacion ? ` (${a.aportado_por.relacion})` : ''}
**Fecha:** ${a.fecha.slice(0, 10)}

| Campo | Valor |
|---|---|
${filas}

${img ? `![foto](https://raw.githubusercontent.com/${repo}/${rama}/${img.ruta})\n` : ''}
---
**Para aprobar:** botón verde **Merge pull request** → se publica en el sitio en 1–2 minutos.
**Para corregir antes de aprobar:** pestaña *Files changed* → «…» → *Edit file*.
**Para rechazar:** botón **Close pull request** (no se publica nada).`;
}
