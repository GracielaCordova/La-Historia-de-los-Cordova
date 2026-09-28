/* =========================================================
   Mama Martina y Antonito — aplicación (router + páginas)
   Sitio estático: todo el contenido vive en /data/*.json
   ========================================================= */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const App = window.App = {
    lang: store.get('idioma', (navigator.language || 'es').slice(0, 2)),
    cache: {},
    $, $$, esc, store,
    t(k) { return (I18N[App.lang] && I18N[App.lang][k]) || I18N.es[k] || k; },
    tx(obj) { if (!obj) return ''; if (typeof obj === 'string') return obj; return obj[App.lang] || obj.es || obj.en || ''; },
    async data(name) {
      if (!App.cache[name]) App.cache[name] = fetch(`data/${name}.json`, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
      return App.cache[name];
    },
    toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('ver'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('ver'), 2400); },
    iniciales(n) { return String(n).replace(/^(Los|Las|El|La|Don|Doña)\s+/i, '').split(/\s+/).filter(w => /^[A-ZÁÉÍÓÚÑ]/.test(w)).slice(0, 2).map(w => w[0]).join('') || '·'; },
    color(id) { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${(h % 50) + 10} 42% 42%)`; },
    avatar(p, cls = 'avatar') {
      const src = p.foto || p.imagen;
      return src ? `<span class="${cls}"><img src="${esc(src)}" alt="" loading="lazy"></span>` : `<span class="${cls}" style="background:${App.color(p.id)}">${esc(App.iniciales(p.nombre))}</span>`;
    }
  };
  if (!I18N[App.lang]) App.lang = 'es';

  // Correspondencia de capítulos ES → NL (para enlaces desde personajes y lugares)
  const ES_A_NL = { 'introduccion': 'inleiding', 'cap-1': 'hoofdstuk-1', 'cap-2': 'hoofdstuk-4', 'cap-3': 'hoofdstuk-7', 'cap-4': 'hoofdstuk-11', 'cap-5': 'hoofdstuk-16', 'nota-del-autor': 'noot-van-de-auteur' };
  const edLector = () => (App.lang === 'nl' ? 'nl' : 'es');
  App.enlaceCap = (esId) => { const ed = edLector(); return `#/leer/${ed}/${ed === 'nl' ? (ES_A_NL[esId] || esId) : esId}`; };
  App.nombreCap = async (esId) => {
    const ed = edLector(); const libro = await App.data('libro-' + ed);
    const id = ed === 'nl' ? (ES_A_NL[esId] || esId) : esId;
    const c = libro.chapters.find(x => x.id === id); if (!c) return esId;
    return c.num ? `${c.num}. ${c.title}` : c.title;
  };

  /* ---------------- Tema, idioma, menú ---------------- */
  const tema = store.get('tema', null); if (tema) document.documentElement.dataset.theme = tema;
  $('#tema').addEventListener('click', () => {
    const oscuro = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = oscuro ? 'light' : 'dark'; store.set('tema', document.documentElement.dataset.theme);
  });
  $('#menu').addEventListener('click', () => $('#nav').classList.toggle('abierto'));
  $$('.idioma button').forEach(b => b.addEventListener('click', () => {
    App.lang = b.dataset.lang; store.set('idioma', App.lang); aplicarIdioma();
    // en el lector, cambiar también la edición cuando exista
    const h = location.hash;
    if (h.startsWith('#/leer/') && App.lang !== 'en') {
      const [, , ed, cap] = h.split('/');
      if (ed !== App.lang) {
        const inv = Object.fromEntries(Object.entries(ES_A_NL).map(([a, b]) => [b, a]));
        const nuevo = App.lang === 'nl' ? (ES_A_NL[cap] || 'inleiding') : (inv[cap] || 'introduccion');
        location.hash = `#/leer/${App.lang}/${nuevo}`; return;
      }
    }
    router();
  }));
  function aplicarIdioma() {
    document.documentElement.lang = App.lang;
    $$('.idioma button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === App.lang));
    $$('[data-t]').forEach(el => el.textContent = App.t(el.dataset.t));
  }

  // Visor de imágenes
  const visor = $('#visor');
  document.addEventListener('click', e => {
    const img = e.target.closest('.texto figure img, [data-zoom]');
    if (img) { visor.querySelector('img').src = img.src; visor.classList.add('abierto'); }
  });
  visor.addEventListener('click', () => visor.classList.remove('abierto'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') visor.classList.remove('abierto'); });

  /* ---------------- Router ---------------- */
  const paginas = {};
  App.pagina = (nombre, fn) => paginas[nombre] = fn;
  async function router() {
    const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const ruta = partes[0] || 'inicio';
    $$('#nav a').forEach(a => a.classList.toggle('activo', a.dataset.r === ruta));
    $('#nav').classList.remove('abierto');
    $('#progreso').style.width = '0';
    document.body.dataset.ruta = ruta;
    const fn = paginas[ruta] || paginas.inicio;
    const app = $('#app');
    try { await fn(app, partes.slice(1)); }
    catch (err) { console.error(err); app.innerHTML = `<div class="contenedor cargando">${esc(App.t('gen.error'))}</div>`; }
    if (!(ruta === 'leer' && partes[3])) window.scrollTo({ top: 0 });
    const titulos = { inicio: '', leer: App.t('nav.leer'), autor: App.t('nav.autor'), personajes: App.t('nav.personajes'), arbol: App.t('nav.arbol'), potosi: App.t('nav.potosi') };
    document.title = (titulos[ruta] ? titulos[ruta] + ' · ' : '') + 'Mama Martina y Antonito';
  }
  App.router = router;
  window.addEventListener('hashchange', router);

  /* =========================================================
     INICIO
     ========================================================= */
  App.pagina('inicio', async (el) => {
    const t = App.t;
    const cards = [
      ['leer', '#/leer', 'img/libro/portada.jpg'], ['autor', '#/autor', 'img/libro/san-mateo.jpg'], ['arbol', '#/arbol', 'img/libro/mama-martina.jpg'],
      ['personajes', '#/personajes', 'img/libro/huida-a-egipto.jpg'], ['potosi', '#/potosi', 'img/libro/cerro-rico.jpg']
    ];
    const ed = edLector();
    const partes = ed === 'nl'
      ? ['hoofdstuk-1', 'hoofdstuk-4', 'hoofdstuk-7', 'hoofdstuk-11', 'hoofdstuk-16']
      : ['cap-1', 'cap-2', 'cap-3', 'cap-4', 'cap-5'];
    el.innerHTML = `
    <section class="hero"><div class="contenedor">
      <div>
        <span class="eyebrow">${t('inicio.eyebrow')}</span>
        <h1>${t('inicio.t1')}<span>${t('inicio.t2')}</span></h1>
        <p class="lead">${t('inicio.lead')}</p>
        <div class="acciones">
          <a class="btn terra" href="#/leer">${t('inicio.leer')} →</a>
          <a class="btn sec" href="#/arbol">${t('inicio.arbol')}</a>
        </div>
      </div>
      <a class="portada-libro" href="#/leer"><img src="img/libro/portada.jpg" alt="Portada del libro" width="600" height="900"></a>
    </div></section>

    <section class="banda"><div class="contenedor">
      <blockquote class="cita">${t('inicio.cita')}<footer>${t('inicio.cita.pie')}</footer></blockquote>
    </div></section>

    <section class="seccion"><div class="contenedor">
      <div class="seccion-cab"><span class="eyebrow">${t('inicio.explora')}</span><h2>${t('inicio.explora.t')}</h2><p>${t('inicio.explora.p')}</p></div>
      <div class="rejilla">
        ${cards.map(([k, href, img]) => `<a class="tarjeta img" href="${href}"><img src="${img}" alt="" loading="lazy"><div class="cuerpo"><h3>${t('card.' + k)}</h3><p>${t('card.' + k + '.p')}</p></div></a>`).join('')}
      </div>
    </div></section>

    <section class="banda"><div class="contenedor">
      <div class="seccion-cab"><h2>${t('inicio.partes')}</h2></div>
      <div class="rejilla">
        ${[1, 2, 3, 4, 5].map(i => `<a class="tarjeta" href="#/leer/${ed}/${partes[i - 1]}"><span class="num">${['I', 'II', 'III', 'IV', 'V'][i - 1]}</span><h3>${t('partes.' + i)}</h3><p>${t('partes.' + i + '.p')}</p></a>`).join('')}
      </div>
    </div></section>`;
  });

  /* =========================================================
     LECTOR
     ========================================================= */
  const minutos = w => Math.max(1, Math.round(w / 220));
  App.pagina('leer', async (el, [ed, capId, ancla]) => {
    const t = App.t;
    if (!ed) ed = App.lang === 'en' ? 'en' : edLector();
    if (ed === 'en') {
      el.innerHTML = `<div class="contenedor" style="max-width:720px;padding:64px 16px">
        <span class="eyebrow">English edition</span><h1>${t('inicio.t1')} ${t('inicio.t2')}</h1>
        <div class="aviso">${t('leer.en.pronto')}</div>
        <div class="acciones" style="display:flex;gap:10px;flex-wrap:wrap">
          <a class="btn terra" href="#/leer/es/introduccion">Español</a><a class="btn sec" href="#/leer/nl/inleiding">Nederlands</a></div></div>`;
      return;
    }
    const libro = await App.data('libro-' + ed);
    const caps = libro.chapters;
    if (!capId) capId = store.get('ultimo-' + ed, caps[0].id);
    let i = caps.findIndex(c => c.id === capId); if (i < 0) i = 0;
    const cap = caps[i]; store.set('ultimo-' + ed, cap.id);
    const tam = store.get('tam-letra', 1.12);

    const subs = cap.blocks.map((b, k) => b.t === 'h' ? { k, text: b.text } : null).filter(Boolean);
    const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    let primero = true;
    const cuerpo = cap.blocks.map(b => {
      if (b.t === 'p') { const c = primero ? ' class="primero"' : ''; primero = false; return `<p${c}>${esc(b.text)}</p>`; }
      if (b.t === 'h') return `<h2 id="${slug(b.text)}">${esc(b.text)}</h2>`;
      if (b.t === 'v') return `<p class="verso">${esc(b.lines.join('\n'))}</p>`;
      if (b.t === 'img') return `<figure><img src="${esc(b.src)}" alt="" loading="lazy"></figure>`;
      if (b.t === 'cap') return `<p class="leyenda">${esc(b.text)}</p>`;
      return '';
    }).join('');

    let parteActual = null;
    const indice = caps.map((c, j) => {
      let h = '';
      if (c.part && c.part.label !== parteActual) { parteActual = c.part.label; h += `<li class="parte">${esc(c.part.label)}</li>`; }
      h += `<li><a href="#/leer/${ed}/${c.id}" class="${j === i ? 'activo' : ''}">${c.num ? c.num + '. ' : ''}${esc(c.title)}</a></li>`;
      if (j === i) h += subs.map(s => `<li><a class="sub" href="#/leer/${ed}/${c.id}/${slug(s.text)}">${esc(s.text)}</a></li>`).join('');
      return h;
    }).join('');

    const prev = caps[i - 1], next = caps[i + 1];
    el.innerHTML = `
    <div class="contenedor lector">
      <aside class="indice">
        <div class="ed">
          <a class="btn peq ${ed === 'es' ? '' : 'sec'}" href="#/leer/es">Español</a>
          <a class="btn peq ${ed === 'nl' ? '' : 'sec'}" href="#/leer/nl">Nederlands</a>
          <a class="btn peq sec" href="#/leer/en" title="${t('leer.pronto')}">English</a>
        </div>
        <span class="eyebrow">${t('leer.indice')}</span>
        <ol>${indice}</ol>
        <p style="margin-top:18px"><a class="btn peq sec" href="${esc(libro.pdf)}" download>⤓ ${t('leer.descargar')}</a></p>
      </aside>
      <article>
        <div class="indice-movil">
          <select aria-label="${t('leer.indice')}">${caps.map(c => `<option value="${c.id}" ${c.id === cap.id ? 'selected' : ''}>${c.num ? c.num + '. ' : ''}${esc(c.title)}</option>`).join('')}</select>
        </div>
        <div class="barra-lector">
          <span class="muted" style="font-size:.85rem">${t('leer.letra')}</span>
          <button class="icono-btn" data-tam="-1" aria-label="A-">A−</button>
          <button class="icono-btn" data-tam="1" aria-label="A+">A+</button>
          <span style="flex:1"></span>
          <a class="btn peq sec" href="${esc(libro.pdf)}" download>⤓ PDF</a>
        </div>
        ${ed === 'nl' && i === 0 ? `<div class="aviso">${t('leer.nl.aviso')}</div>` : ''}
        <div class="texto" style="--tam-lectura:${tam}rem">
          <header class="cab-cap">
            ${cap.part ? `<div class="parte">${esc(cap.part.label)}${cap.part.subtitle ? `<em>${esc(cap.part.subtitle)}</em>` : ''}</div>` : ''}
            <h1>${cap.num ? `<span class="muted" style="font-size:.5em;display:block;font-style:italic">${t('gen.cap')} ${cap.num}</span>` : ''}${esc(cap.title)}</h1>
            <div class="meta">${libro.author} · ${minutos(cap.words)} ${t('leer.min')}</div>
          </header>
          ${cuerpo}
        </div>
        <nav class="pie-cap">
          ${prev ? `<a href="#/leer/${ed}/${prev.id}"><small>← ${t('leer.anterior')}</small>${esc(prev.title)}</a>` : '<span style="flex:1"></span>'}
          ${next ? `<a class="sig" href="#/leer/${ed}/${next.id}"><small>${t('leer.siguiente')} →</small>${esc(next.title)}</a>` : '<span style="flex:1"></span>'}
        </nav>
      </article>
    </div>`;

    $('.indice-movil select', el).addEventListener('change', e => location.hash = `#/leer/${ed}/${e.target.value}`);
    $$('[data-tam]', el).forEach(b => b.addEventListener('click', () => {
      const v = Math.min(1.5, Math.max(.95, store.get('tam-letra', 1.12) + (+b.dataset.tam) * .08));
      store.set('tam-letra', v); $('.texto', el).style.setProperty('--tam-lectura', v + 'rem');
    }));
    if (ancla) { const a = document.getElementById(ancla); if (a) setTimeout(() => a.scrollIntoView(), 30); }
  });
  // barra de progreso de lectura
  window.addEventListener('scroll', () => {
    if (document.body.dataset.ruta !== 'leer') return;
    const art = $('.texto'); if (!art) return;
    const r = art.getBoundingClientRect(); const total = r.height - innerHeight;
    $('#progreso').style.width = Math.min(100, Math.max(0, (-r.top / (total || 1)) * 100)) + '%';
  }, { passive: true });

  /* =========================================================
     AUTOR
     ========================================================= */
  App.pagina('autor', async (el) => {
    const t = App.t;
    const iconos = [
      '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 4l6 6-9 9H5v-6z"/><path d="M12 6l6 6"/></svg>',
      '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="11" cy="7" r="1"/><circle cx="16" cy="8" r="1"/></svg>',
      '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v2a5 5 0 0 0 10 0v-3"/><circle cx="20" cy="10" r="2"/></svg>'
    ];
    el.innerHTML = `
    <section class="seccion"><div class="contenedor autor-grid">
      <div>
        <div class="autor-foto"><img src="img/familia/freddy.jpg" alt="Freddy Córdova Ossio" onerror="this.src='img/libro/caminante.jpg';this.nextElementSibling.hidden=false"><span class="falta" hidden>${t('autor.foto.falta')}</span></div>
      </div>
      <div>
        <span class="eyebrow">${t('autor.eyebrow')}</span>
        <h1>Freddy Córdova Ossio</h1>
        <p class="muted" style="font-family:var(--serif);font-size:1.2rem;margin-top:-.3em">Potosí, 1943 · «Antoñito»</p>
        <p style="font-size:1.1rem">${t('autor.intro')}</p>
        <div class="tres">${[1, 2, 3].map(k => `<div class="tarjeta">${iconos[k - 1]}<h3>${t('autor.tres.' + k)}</h3><p>${t('autor.tres.' + k + '.p')}</p></div>`).join('')}</div>
        <h2>${t('autor.trayectoria')}</h2>
        <ul class="hitos">${[1, 2, 3, 4, 5, 6, 7, 8].map(k => `<li>${t('autor.h' + k)}</li>`).join('')}</ul>
        <div class="orn">✦</div>
        <h2>${t('autor.porque')}</h2>
        <blockquote class="cita" style="text-align:left;margin:0">${t('autor.porque.p')}<footer>— ${t('autor.firma')}</footer></blockquote>
        <p style="margin-top:24px"><a class="btn sec" href="${App.enlaceCap('nota-del-autor')}">${t('autor.cta')} →</a></p>
      </div>
    </div></section>`;
  });

  /* =========================================================
     PERSONAJES
     ========================================================= */
  App.pagina('personajes', async (el) => {
    const t = App.t;
    const [pd, fam] = await Promise.all([App.data('personajes'), App.data('familia')]);
    const familia = fam.personas.filter(p => p.fuente === 'libro' && p.capitulos).map(p => ({ id: p.id, nombre: p.nombre + (p.apodo ? ` · ${p.apodo}` : ''), tipo: 'familia', imagen: p.foto, capitulos: p.capitulos, desc: p.bio, _fam: true }));
    const todos = [...familia, ...pd.personajes];
    const nombres = {}; for (const c of new Set(todos.flatMap(p => p.capitulos || []))) nombres[c] = await App.nombreCap(c);
    let filtro = 'todos';
    const tipos = ['todos', 'familia', 'relato', 'historico', 'leyenda'];
    const pinta = () => {
      $('.rejilla', el).innerHTML = todos.filter(p => filtro === 'todos' || p.tipo === filtro).map(p => `
        <div class="tarjeta personaje">
          <div style="display:flex;gap:14px;align-items:center">${App.avatar(p)}<div><h3 style="font-size:1.2rem">${esc(p.nombre)}</h3><span class="chip ${p.tipo === 'familia' ? 'terra' : p.tipo === 'historico' ? 'oro' : ''}">${t('pers.' + p.tipo)}</span></div></div>
          <p>${esc(App.tx(p.desc))}</p>
          <div class="caps"><span class="muted" style="font-size:.78rem">${t('pers.aparece')}:</span>${(p.capitulos || []).map(c => `<a class="chip" href="${App.enlaceCap(c)}">${esc(nombres[c])}</a>`).join('')}
          ${p._fam ? `<a class="chip terra" href="#/arbol/${p.id}">${t('nav.arbol')} →</a>` : ''}</div>
        </div>`).join('');
      $$('.filtros button', el).forEach(b => b.setAttribute('aria-pressed', b.dataset.f === filtro));
    };
    el.innerHTML = `<section class="seccion"><div class="contenedor">
      <div class="seccion-cab"><span class="eyebrow">${t('pers.eyebrow')}</span><h1>${t('pers.t')}</h1><p>${t('pers.p')}</p></div>
      <div class="filtros">${tipos.map(k => `<button data-f="${k}">${t('pers.' + k)}</button>`).join('')}</div>
      <div class="rejilla"></div></div></section>`;
    $$('.filtros button', el).forEach(b => b.addEventListener('click', () => { filtro = b.dataset.f; pinta(); }));
    pinta();
  });

  /* =========================================================
     POTOSÍ Y LUGARES
     ========================================================= */
  App.pagina('potosi', async (el) => {
    const t = App.t;
    const d = await App.data('lugares');
    el.innerHTML = `<section class="seccion"><div class="contenedor">
      <div class="seccion-cab"><span class="eyebrow">${t('potosi.eyebrow')}</span><h1>${t('potosi.t')}</h1><p>${t('potosi.p')}</p></div>
      <div class="lugares-grid">
        <div><div class="mapa" id="mapa"></div><div class="lista-lugares">${d.lugares.map(l => `<button data-l="${l.id}">${esc(l.nombre)}</button>`).join('')}</div></div>
        <div class="tarjeta lugar-detalle" id="lugar"></div>
      </div>
      <p class="muted" style="font-size:.82rem;margin-top:14px">${t('potosi.nota')}</p>
    </div></section>
    <section class="banda"><div class="contenedor">
      <div class="seccion-cab"><span class="eyebrow">${t('potosi.linea')}</span><h2>${t('potosi.linea.p')}</h2></div>
      <ol class="linea">${d.linea_tiempo.map(x => `<li><b>${esc(x.anio)}</b><span>${esc(App.tx(x))}</span></li>`).join('')}</ol>
    </div></section>`;

    const nombres = {}; for (const c of new Set(d.lugares.flatMap(l => l.capitulos || []))) nombres[c] = await App.nombreCap(c);
    const mostrar = (id, volar) => {
      const l = d.lugares.find(x => x.id === id);
      $('#lugar').innerHTML = `
        ${l.imagen ? `<img src="${esc(l.imagen)}" alt="" data-zoom style="border-radius:10px;aspect-ratio:16/10;object-fit:cover;width:100%;cursor:zoom-in">` : ''}
        <h3 style="margin-top:6px">${esc(l.nombre)}</h3>
        ${l.aprox ? `<span class="chip">${t('potosi.aprox')}</span>` : ''}
        <p>${esc(App.tx(l.desc))}</p>
        <span class="eyebrow" style="margin-top:6px">${t('potosi.datos')}</span>
        <ul>${(l.datos[App.lang] || l.datos.es).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <div class="caps" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><span class="muted" style="font-size:.78rem">${t('potosi.enlibro')}:</span>${(l.capitulos || []).map(c => `<a class="chip" href="${App.enlaceCap(c)}">${esc(nombres[c])}</a>`).join('')}</div>`;
      $$('.lista-lugares button', el).forEach(b => b.setAttribute('aria-pressed', b.dataset.l === id));
      if (volar && App._mapa) { App._mapa.flyTo(l.coords, l.id === 'toledo' ? 6 : 12, { duration: .8 }); App._marcas[id]?.openPopup(); }
    };
    $$('.lista-lugares button', el).forEach(b => b.addEventListener('click', () => mostrar(b.dataset.l, true)));
    mostrar('potosi');

    let intentos = 0;
    const iniciarMapa = () => {
      if (!window.L) { if (intentos++ < 40) setTimeout(iniciarMapa, 150); return; }
      if (!document.getElementById('mapa')) return;
      const m = App._mapa = L.map('mapa', { scrollWheelZoom: false }).setView([-20.3, -65.9], 7);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(m);
      App._marcas = {};
      const icono = L.divIcon({ className: '', html: '<svg width="26" height="34" viewBox="0 0 26 34"><path d="M13 0C6 0 0 5.6 0 12.6 0 22 13 34 13 34s13-12 13-21.4C26 5.6 20 0 13 0z" fill="#9c4428"/><circle cx="13" cy="12.5" r="5" fill="#f6f0e4"/></svg>', iconSize: [26, 34], iconAnchor: [13, 34], popupAnchor: [0, -30] });
      d.lugares.forEach(l => {
        App._marcas[l.id] = L.marker(l.coords, { icon: icono }).addTo(m).bindPopup(`<b>${esc(l.nombre)}</b>`).on('click', () => mostrar(l.id));
      });
      // ruta de Martina: Atocha → Cotagaita → Potosí
      const ruta = ['atocha', 'cotagaita', 'potosi'].map(id => d.lugares.find(l => l.id === id).coords);
      L.polyline(ruta, { color: '#b08a3e', weight: 3, dashArray: '6 8' }).addTo(m);
    };
    iniciarMapa();
  });

  /* Árbol familiar: implementado en js/arbol.js */
  App.pagina('arbol', (el, args) => window.PaginaArbol(el, args));

  /* ---------------- Arranque ---------------- */
  aplicarIdioma();
  router();
})();
