/* =========================================================
   Árbol familiar interactivo — dos ramas separadas
   · «Árbol del libro»: solo data/familia.json (lo que cuenta el libro)
   · «Familia hoy»: aportes aprobados (data/aportes.json) + lo enviado
     desde este navegador que aún espera aprobación
   ========================================================= */
window.PaginaArbol = async function (el, [arg]) {
  const { $, $$, esc, t, store } = { ...App, t: App.t };
  const [base, ap] = await Promise.all([App.data('familia'), App.aportes()]);
  const idsLibro = new Set(base.personas.map(p => p.id));
  let zoom = store.get('arbol-zoom', 1);
  let pestaña = arg === 'hoy' || arg === 'libro' ? arg : null;

  // Borradores de la versión anterior del sitio (solo en este navegador) → se ofrecen para enviar
  const CLAVE_BORR = 'familia-borradores-v1';
  const borradores = () => Object.values(store.get(CLAVE_BORR, {})).filter(p => !idsLibro.has(p.id));

  function construir() {
    const m = new Map(base.personas.map(p => [p.id, { ...p, _sec: 'libro', _estado: 'libro' }]));
    for (const p of ap.personas) if (!m.has(p.id)) m.set(p.id, { ...p, _sec: 'hoy', _estado: 'aprobado' });
    for (const x of App.pendientes().filter(x => x.tipo === 'persona')) {
      if (!m.has(x.id)) m.set(x.id, { id: x.id, ...x.datos, foto: x.miniatura, _sec: 'hoy', _estado: 'pendiente', aportado_por: x.autor });
    }
    for (const p of borradores()) if (!m.has(p.id)) m.set(p.id, { ...p, foto: p.foto_data || '', _sec: 'hoy', _estado: 'borrador' });
    return m;
  }
  let P = construir();
  const nombre = id => P.get(id)?.nombre || id;
  const parejasDe = p => [...new Set([...(p.pareja || []), ...[...P.values()].filter(x => (x.pareja || []).includes(p.id)).map(x => x.id)])].filter(id => P.has(id));
  const hijosDe = ids => [...P.values()].filter(x => (x.padres || []).some(pa => ids.includes(pa)));

  /* ---------- Tarjeta ---------- */
  function tarjeta(p, { ancla = false } = {}) {
    const cls = ['persona', p.por_confirmar ? 'pendiente' : '', p._estado === 'pendiente' ? 'enviado' : '', p._estado === 'borrador' ? 'borrador' : '', ancla ? 'ancla' : ''].join(' ');
    const extra = [];
    if (!ancla) {
      const adoptivos = [...P.values()].filter(x => (x.adopta || []).includes(p.id));
      if (adoptivos.length) extra.push(`${t('arbol.adopcion')} <a data-ver="${adoptivos[0].id}">${esc(adoptivos[0].nombre)}</a>`);
      if ((p.hermanos || []).length) extra.push(`${t('arbol.hermano')} <a data-ver="${p.hermanos[0]}">${esc(nombre(p.hermanos[0]).split(' ')[0])}</a>`);
    }
    const f = p.foto || '';
    const av = f ? `<span class="avatar"><img src="${esc(f)}" alt=""></span>` : `<span class="avatar" style="background:${App.color(p.id)}">${esc(App.iniciales(p.nombre))}</span>`;
    const fechas = [p.nacimiento, p.fallecimiento].filter(Boolean).join(' – ');
    const marca = ancla ? `<span class="marca-ancla">${t('arbol.ancla')}</span>` : p._estado === 'pendiente' || p._estado === 'borrador' ? `<span class="marca-conf" title="${esc(t('arbol.ley.pend'))}">⏳</span>` : p.por_confirmar ? `<span class="marca-conf" title="${esc(t('arbol.ley.conf'))}">?</span>` : '';
    return `<div class="${cls}" tabindex="0" role="button" data-id="${esc(p.id)}">
      ${marca}${av}<b>${esc(p.nombre)}</b>
      ${p.apodo ? `<small><i>${esc(p.apodo)}</i></small>` : ''}
      ${fechas ? `<small>${esc(fechas)}</small>` : ''}
      ${!ancla && App.tx(p.rol) ? `<small>${esc(App.tx(p.rol))}</small>` : ''}
      ${extra.length ? `<span class="adopcion">${extra.join('<br>')}</span>` : ''}
    </div>`;
  }
  const hueco = padre => `<a class="persona hueco" href="#/aportar/persona/${esc(padre)}"><span class="avatar">+</span><b>${t('arbol.p.hijo')}</b></a>`;

  /* ---------- Árbol recursivo ----------
     sec = 'libro' | 'hoy'. En «hoy» las personas del libro solo aparecen como ancla. */
  function nodo(id, vistos, sec, esAncla = false) {
    const p = P.get(id); if (!p || vistos.has(id)) return '';
    vistos.add(id);
    const parejas = parejasDe(p).filter(x => !vistos.has(x) && P.get(x)._sec === sec);
    parejas.forEach(x => vistos.add(x));
    const grupo = [id, ...parejas];
    const hijos = hijosDe(grupo).filter(h => !vistos.has(h.id) && h._sec === sec).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    const nucleo = `<div class="nucleo">${tarjeta(p, { ancla: esAncla })}${parejas.map(x => `<span class="union"></span>${tarjeta(P.get(x))}`).join('')}</div>`;
    const sub = hijos.map(h => nodo(h.id, vistos, sec)).filter(Boolean);
    if (sec === 'hoy') sub.push(`<li>${hueco(id)}</li>`);
    return `<li>${nucleo}${sub.length ? `<ul>${sub.join('')}</ul>` : ''}</li>`;
  }

  function dibujar() {
    P = construir();
    const vistos = new Set();
    let principal = '', otras = '';
    if (pestaña === 'libro') {
      const raiz = base.raiz && P.has(base.raiz) ? base.raiz : base.personas[0].id;
      principal = `<div class="arbol"><ul>${nodo(raiz, vistos, 'libro')}</ul></div>`;
      const sueltas = base.personas.filter(p => !vistos.has(p.id) && !(p.padres || []).some(pa => P.has(pa)));
      otras = sueltas.map(p => `<div class="arbol"><ul>${nodo(p.id, vistos, 'libro')}</ul></div>`).join('');
    } else {
      const hoy = [...P.values()].filter(p => p._sec === 'hoy');
      // Anclas: personas del libro de las que desciende (o con quien se casó) alguien de «hoy»
      const anclas = new Set(['freddy']);
      for (const p of hoy) for (const r of [...(p.padres || []), ...(p.pareja || [])]) if (idsLibro.has(r)) anclas.add(r);
      const orden = base.personas.map(p => p.id).filter(id => anclas.has(id));
      principal = orden.map(id => `<div class="arbol"><ul>${nodo(id, vistos, 'hoy', true)}</ul></div>`).join('');
      // Personas de «hoy» sin conexión todavía
      const sueltas = hoy.filter(p => !vistos.has(p.id) && !(p.padres || []).some(pa => P.has(pa)));
      principal += sueltas.map(p => `<div class="arbol"><ul>${nodo(p.id, vistos, 'hoy')}</ul></div>`).join('');
    }
    $('.arbol-zoom', el).innerHTML = `<div class="bosque">${principal}</div>`;
    $('#otras', el).innerHTML = otras;
    $('#otras-cab', el).hidden = !otras;
    $$('.pestana', el).forEach(b => b.setAttribute('aria-selected', b.dataset.tab === pestaña));
    $('#intro-tab', el).textContent = pestaña === 'libro' ? t('arbol.p.libro2') : t('arbol.hoy.p');
    $('#vacio', el).hidden = !(pestaña === 'hoy' && ![...P.values()].some(p => p._sec === 'hoy'));
    $('.leyenda-arbol', el).innerHTML = pestaña === 'libro'
      ? `<span><i></i>${t('arbol.ley.libro')}</span><span><i style="border-style:dashed"></i>${t('arbol.ley.conf')}</span>`
      : `<span><i class="ancla-i"></i>${t('arbol.ancla')}</span><span><i style="border:1px dashed var(--oro)"></i>${t('arbol.ley.pend')}</span>`;
    $$('.persona[data-id]', el).forEach(c => {
      c.addEventListener('click', e => { if (e.target.closest('[data-ver]')) return; abrir(c.dataset.id); });
      c.addEventListener('keydown', e => { if (e.key === 'Enter') abrir(c.dataset.id); });
    });
    $$('[data-ver]', el).forEach(a => a.addEventListener('click', e => { e.stopPropagation(); abrir(a.dataset.ver); }));
    banner();
    aplicarZoom();
    requestAnimationFrame(centrar);
  }

  /* ---------- Panel lateral ---------- */
  async function abrir(id) {
    const p = P.get(id); if (!p) return;
    if (p._sec !== pestaña && !(pestaña === 'hoy' && idsLibro.has(id))) { pestaña = p._sec; dibujar(); }
    $$('.persona', el).forEach(c => c.classList.toggle('sel', c.dataset.id === id));
    const padres = (p.padres || []).filter(x => P.has(x));
    const parejas = parejasDe(p);
    const hijos = hijosDe([id]);
    const link = ids => ids.map(x => `<a href="#" data-ver="${x}">${esc(nombre(x))}</a>`).join(', ');
    const caps = [];
    for (const c of p.capitulos || []) caps.push(`<a class="chip" href="${App.enlaceCap(c)}">${esc(await App.nombreCap(c))}</a>`);
    const recuerdos = [
      ...ap.recuerdos.filter(r => r.persona === id),
      ...App.pendientes().filter(x => x.tipo === 'recuerdo' && x.datos.persona === id).map(x => ({ ...x.datos, aportado_por: x.autor, _pend: true }))
    ];
    const fotos = ap.fotos.filter(f => (f.personas || []).includes(id));
    const estado = { libro: t('arbol.p.libro'), aprobado: t('arbol.p.fam'), pendiente: t('arbol.ley.pend'), borrador: t('arbol.p.borr') }[p._estado];
    const panel = $('#panel');
    panel.innerHTML = `
      <button class="icono-btn cerrar" aria-label="${t('gen.cerrar')}">✕</button>
      ${p.foto ? `<img class="foto" src="${esc(p.foto)}" alt="" data-zoom>` : ''}
      ${App.tx(p.rol) ? `<span class="eyebrow">${esc(App.tx(p.rol))}</span>` : ''}
      <h2 style="font-size:1.9rem">${esc(p.nombre)}</h2>
      ${p.apodo ? `<p class="muted" style="font-family:var(--serif);font-size:1.15rem;font-style:italic;margin-top:-.4em">${esc(p.apodo)}</p>` : ''}
      ${p.por_confirmar ? `<div class="aviso">${t('arbol.p.conf')}</div>` : ''}
      ${App.tx(p.bio) ? `<p style="white-space:pre-line">${esc(App.tx(p.bio))}</p>` : ''}
      <dl class="dl">
        ${p.lugar ? `<dt>${t('arbol.p.lugar')}</dt><dd>${esc(p.lugar)}</dd>` : ''}
        ${p.nacimiento ? `<dt>${t('arbol.p.nac')}</dt><dd>${esc(p.nacimiento)}</dd>` : ''}
        ${p.fallecimiento ? `<dt>${t('arbol.p.fall')}</dt><dd>${esc(p.fallecimiento)}</dd>` : ''}
        ${padres.length ? `<dt>${t('arbol.p.padres')}</dt><dd>${link(padres)}</dd>` : ''}
        ${parejas.length ? `<dt>${t('arbol.p.pareja')}</dt><dd>${link(parejas)}</dd>` : ''}
        ${hijos.length ? `<dt>${t('arbol.p.hijos')}</dt><dd>${link(hijos.map(h => h.id))}</dd>` : ''}
        <dt>${t('arbol.p.fuente')}</dt><dd>${estado}${p.aportado_por?.nombre ? ` · ${t('gen.aportado')} ${esc(p.aportado_por.nombre)}` : ''}</dd>
      </dl>
      ${caps.length ? `<span class="eyebrow">${t('arbol.p.leer')}</span><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px">${caps.join('')}</div>` : ''}
      ${fotos.length ? `<span class="eyebrow">${t('nav.album')}</span><div class="mini-album">${fotos.map(f => `<img src="${esc(f.archivo)}" alt="${esc(f.titulo)}" data-zoom>`).join('')}</div>` : ''}
      ${recuerdos.length ? `<span class="eyebrow">${t('arbol.recuerdos')}</span>${recuerdos.map(r => `<blockquote class="recuerdo ${r._pend ? 'pend' : ''}">${esc(r.texto)}<footer>— ${esc(r.aportado_por?.nombre || '')}${r._pend ? ` · ⏳ ${t('gen.pendiente')}` : ''}</footer></blockquote>`).join('')}` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <a class="btn peq" href="#/aportar/persona/${esc(id)}">+ ${t('arbol.p.hijo')}</a>
        <a class="btn peq sec" href="#/aportar/recuerdo/${esc(id)}">✎ ${t('arbol.p.recuerdo')}</a>
        <a class="btn peq sec" href="#/aportar/foto/${esc(id)}">📷 ${t('aportar.foto')}</a>
      </div>`;
    panel.classList.add('abierto');
    $('.cerrar', panel).onclick = cerrar;
    $$('[data-ver]', panel).forEach(a => a.onclick = e => { e.preventDefault(); abrir(a.dataset.ver); });
    history.replaceState(null, '', '#/arbol/' + id);
  }
  function cerrar() { $('#panel').classList.remove('abierto'); $$('.persona', el).forEach(c => c.classList.remove('sel')); history.replaceState(null, '', '#/arbol/' + pestaña); }

  /* ---------- Borradores antiguos → enviar ---------- */
  function banner() {
    const b = borradores(); const caja = $('#migrar', el);
    if (!b.length || pestaña !== 'hoy') { caja.hidden = true; return; }
    const yo = store.get('aportar-autor', { nombre: '', relacion: '' });
    caja.hidden = false;
    caja.innerHTML = `<p style="margin:0 0 10px">${t('arbol.migrar').replace('{n}', b.length)}</p>
      <div class="fila-migrar"><input placeholder="${esc(t('aportar.autor'))}" value="${esc(yo.nombre)}" id="mig-nombre"><button class="btn peq terra" id="mig-btn">${t('arbol.migrar.btn')}</button></div>
      <label class="check pequeno"><input type="checkbox" id="mig-ok"> ${t('aportar.consent')}</label>`;
    $('#mig-btn').onclick = async () => {
      const nom = $('#mig-nombre').value.trim();
      if (!nom || !$('#mig-ok').checked) { App.toast(t('aportar.req')); return; }
      store.set('aportar-autor', { ...yo, nombre: nom });
      const todos = store.get(CLAVE_BORR, {});
      for (const p of b) {
        const datos = { id_sugerido: p.id, nombre: p.nombre, apodo: p.apodo || '', lugar: p.lugar || '', nacimiento: p.nacimiento || '', fallecimiento: p.fallecimiento || '', padres: p.padres || [], pareja: p.pareja || [], rol: p.rol || {}, bio: p.bio || {}, vive: true };
        const payload = { tipo: 'persona', datos, foto: p.foto_data || null, autor: { nombre: nom, relacion: yo.relacion || '' }, consentimiento: true };
        try {
          const r = await Aportes.enviar(payload);
          Aportes.marcarPendiente({ tipo: 'persona', id: p.id, datos, autor: payload.autor, miniatura: p.foto_data || '', pr: r.pr });
        } catch (e) {
          if (!e.sinBuzon) { App.toast(`${t('aportar.error')}: ${e.message}`); return; }
          Aportes.descargar(`aporte-persona-${p.id}.json`, JSON.stringify({ ...payload, fecha: new Date().toISOString() }, null, 2));
          Aportes.marcarPendiente({ tipo: 'persona', id: p.id, datos, autor: payload.autor, miniatura: p.foto_data || '', pr: null });
        }
        delete todos[p.id];
      }
      store.set(CLAVE_BORR, todos); App.toast(t('aportar.ok.t')); dibujar();
    };
  }

  /* ---------- Zoom y arrastre ---------- */
  function aplicarZoom() { const z = $('.arbol-zoom', el); if (z) z.style.zoom = zoom; store.set('arbol-zoom', zoom); }
  function centrar() { const l = $('.arbol-lienzo', el); if (l) { l.scrollLeft = (l.scrollWidth - l.clientWidth) / 2; l.scrollTop = 0; } }

  const admin = Aportes.admin();
  el.innerHTML = `<section class="seccion" style="padding-top:36px"><div class="contenedor">
    <div class="seccion-cab"><span class="eyebrow">${t('arbol.eyebrow')}</span><h1>${t('arbol.t')}</h1><p>${t('arbol.p')}</p></div>
    <div class="pestanas" role="tablist">
      <button class="pestana" role="tab" data-tab="libro">📖 ${t('arbol.tab.libro')}</button>
      <button class="pestana" role="tab" data-tab="hoy">🌱 ${t('arbol.tab.hoy')}</button>
    </div>
    <p class="muted" id="intro-tab" style="max-width:48em"></p>
    <div class="aviso" id="migrar" hidden></div>
    <div class="arbol-barra">
      <a class="btn terra" href="#/aportar/persona">+ ${t('arbol.agregar')}</a>
      <a class="btn sec" href="#/album">📷 ${t('nav.album')}</a>
      ${admin ? `<a class="btn sec peq" href="${admin}" target="_blank" rel="noopener">⚙ ${t('arbol.admin')}</a>` : ''}
      <span style="flex:1"></span>
      <button class="icono-btn" id="z-menos" aria-label="${t('arbol.zoom.menos')}">−</button>
      <button class="icono-btn" id="z-mas" aria-label="${t('arbol.zoom.mas')}">+</button>
      <button class="icono-btn" id="z-centro" aria-label="${t('arbol.centrar')}">◎</button>
    </div>
    <p class="vacio" id="vacio" hidden>${t('arbol.hoy.vacio')}</p>
    <div class="arbol-lienzo"><div class="arbol-zoom"></div></div>
    <div class="leyenda-arbol"></div>
    <h3 id="otras-cab" style="margin-top:32px">${t('arbol.otras')}</h3>
    <div class="otras" id="otras"></div>
  </div></section>
  <aside class="panel-persona" id="panel" aria-live="polite"></aside>`;

  $$('.pestana', el).forEach(b => b.onclick = () => { pestaña = b.dataset.tab; cerrar(); dibujar(); });
  $('#z-mas', el).onclick = () => { zoom = Math.min(1.6, +(zoom + .1).toFixed(2)); aplicarZoom(); };
  $('#z-menos', el).onclick = () => { zoom = Math.max(.4, +(zoom - .1).toFixed(2)); aplicarZoom(); };
  $('#z-centro', el).onclick = centrar;
  const lienzo = $('.arbol-lienzo', el);
  let arr = null;
  lienzo.addEventListener('pointerdown', e => { if (e.target.closest('.persona') || e.pointerType === 'touch') return; arr = { x: e.clientX, y: e.clientY, l: lienzo.scrollLeft, t: lienzo.scrollTop }; lienzo.classList.add('arrastrando'); });
  window.addEventListener('pointermove', e => { if (!arr) return; lienzo.scrollLeft = arr.l - (e.clientX - arr.x); lienzo.scrollTop = arr.t - (e.clientY - arr.y); });
  window.addEventListener('pointerup', () => { arr = null; lienzo.classList.remove('arrastrando'); });

  const sel = arg && !pestaña && P.has(arg) ? arg : null;
  if (!pestaña) pestaña = sel ? P.get(sel)._sec : 'libro';
  dibujar();
  if (sel) abrir(sel);
};
