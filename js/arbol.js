/* =========================================================
   Árbol familiar interactivo
   - Datos base: data/familia.json (en el repositorio)
   - Borradores: se guardan en este navegador (localStorage)
   - «Exportar para GitHub» descarga familia.json + fotos nuevas
   ========================================================= */
window.PaginaArbol = async function (el, [selId]) {
  const { $, $$, esc, t, store } = { ...App, t: App.t };
  const CLAVE = 'familia-borradores-v1';
  const base = await App.data('familia');
  let borr = store.get(CLAVE, {});        // { id: persona (nueva o con cambios) }
  let zoom = store.get('arbol-zoom', 1);

  const personas = () => {
    const m = new Map(base.personas.map(p => [p.id, { ...p }]));
    for (const [id, p] of Object.entries(borr)) m.set(id, { ...(m.get(id) || {}), ...p, _borrador: true });
    return m;
  };
  let P = personas();
  const nombre = id => P.get(id)?.nombre || id;
  const hijosDe = ids => [...P.values()].filter(x => (x.padres || []).some(pa => ids.includes(pa)));
  const parejasDe = p => [...new Set([...(p.pareja || []), ...[...P.values()].filter(x => (x.pareja || []).includes(p.id)).map(x => x.id)])].filter(id => P.has(id));
  const fotoDe = p => p.foto_data || p.foto || '';

  /* ---------- Tarjeta de persona ---------- */
  function tarjeta(p) {
    const cls = ['persona', p.por_confirmar ? 'pendiente' : '', p._borrador ? 'borrador' : '', p.placeholder ? 'hueco' : ''].join(' ');
    const extra = [];
    const adoptivos = [...P.values()].filter(x => (x.adopta || []).includes(p.id));
    if (adoptivos.length) extra.push(`${t('arbol.adopcion')} <a data-ver="${adoptivos[0].id}">${esc(adoptivos[0].nombre)}</a>`);
    if ((p.hermanos || []).length) extra.push(`${t('arbol.hermano')} <a data-ver="${p.hermanos[0]}">${esc(nombre(p.hermanos[0]).split(' ')[0])}</a>`);
    const f = fotoDe(p);
    const av = f ? `<span class="avatar"><img src="${esc(f)}" alt=""></span>` : `<span class="avatar" style="background:${p.placeholder ? 'transparent;border:2px dashed var(--linea);color:var(--tinta-3)' : App.color(p.id)}">${p.placeholder ? '+' : esc(App.iniciales(p.nombre))}</span>`;
    const fechas = [p.nacimiento, p.fallecimiento].filter(Boolean).join(' – ');
    return `<div class="${cls}" tabindex="0" role="button" data-id="${esc(p.id)}">
      ${p.por_confirmar ? '<span class="marca-conf" title="' + esc(t('arbol.ley.conf')) + '">?</span>' : ''}
      ${av}<b>${esc(p.nombre)}</b>
      ${p.apodo ? `<small><i>${esc(p.apodo)}</i></small>` : ''}
      ${fechas ? `<small>${esc(fechas)}</small>` : ''}
      <small>${esc(App.tx(p.rol))}</small>
      ${extra.length ? `<span class="adopcion">${extra.join('<br>')}</span>` : ''}
    </div>`;
  }

  /* ---------- Árbol recursivo (núcleos familiares) ---------- */
  function nodo(id, vistos) {
    const p = P.get(id); if (!p || vistos.has(id)) return '';
    vistos.add(id);
    const parejas = parejasDe(p).filter(x => !vistos.has(x));
    parejas.forEach(x => vistos.add(x));
    const grupo = [id, ...parejas];
    const hijos = hijosDe(grupo).filter(h => !vistos.has(h.id))
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    const nucleo = `<div class="nucleo">${tarjeta(p)}${parejas.map(x => `<span class="union"></span>${tarjeta(P.get(x))}`).join('')}</div>`;
    const sub = hijos.map(h => nodo(h.id, vistos)).filter(Boolean);
    return `<li>${nucleo}${sub.length ? `<ul>${sub.join('')}</ul>` : ''}</li>`;
  }

  function dibujar() {
    P = personas();
    const vistos = new Set();
    const raiz = base.raiz && P.has(base.raiz) ? base.raiz : [...P.values()].find(p => !(p.padres || []).length)?.id;
    const arbolHTML = `<ul>${nodo(raiz, vistos)}</ul>`;
    // Personas sin conexión con la raíz (p. ej. familia adoptiva, hermanos) → también se dibujan sus ramas
    const sueltas = [...P.values()].filter(p => !vistos.has(p.id) && !(p.padres || []).some(pa => P.has(pa)));
    const otras = sueltas.map(p => `<div class="arbol"><ul>${nodo(p.id, vistos)}</ul></div>`).join('');
    $('.arbol-zoom', el).innerHTML = `<div class="arbol">${arbolHTML}</div>`;
    $('#otras', el).innerHTML = otras;
    $('#otras-cab', el).hidden = !otras;
    $$('.persona', el).forEach(c => {
      c.addEventListener('click', e => { if (e.target.closest('[data-ver]')) return; abrir(c.dataset.id); });
      c.addEventListener('keydown', e => { if (e.key === 'Enter') abrir(c.dataset.id); });
    });
    $$('[data-ver]', el).forEach(a => a.addEventListener('click', e => { e.stopPropagation(); abrir(a.dataset.ver); }));
    aplicarZoom();
  }

  /* ---------- Panel lateral ---------- */
  async function abrir(id) {
    const p = P.get(id); if (!p) return;
    $$('.persona', el).forEach(c => c.classList.toggle('sel', c.dataset.id === id));
    const padres = (p.padres || []).filter(x => P.has(x));
    const parejas = parejasDe(p);
    const hijos = hijosDe([id]);
    const link = ids => ids.map(x => `<a href="#" data-ver="${x}">${esc(nombre(x))}</a>`).join(', ');
    const caps = [];
    for (const c of p.capitulos || []) caps.push(`<a class="chip" href="${App.enlaceCap(c)}">${esc(await App.nombreCap(c))}</a>`);
    const f = fotoDe(p);
    const panel = $('#panel');
    panel.innerHTML = `
      <button class="icono-btn cerrar" aria-label="${t('gen.cerrar')}">✕</button>
      ${f ? `<img class="foto" src="${esc(f)}" alt="" data-zoom>` : ''}
      <span class="eyebrow">${esc(App.tx(p.rol))}</span>
      <h2 style="font-size:1.9rem">${esc(p.nombre)}</h2>
      ${p.apodo ? `<p class="muted" style="font-family:var(--serif);font-size:1.15rem;font-style:italic;margin-top:-.4em">${esc(p.apodo)}</p>` : ''}
      ${p.por_confirmar ? `<div class="aviso">${t('arbol.p.conf')}</div>` : ''}
      <p>${esc(App.tx(p.bio))}</p>
      <dl class="dl">
        ${p.lugar ? `<dt>${t('arbol.p.lugar')}</dt><dd>${esc(p.lugar)}</dd>` : ''}
        ${p.nacimiento ? `<dt>${t('arbol.p.nac')}</dt><dd>${esc(p.nacimiento)}</dd>` : ''}
        ${p.fallecimiento ? `<dt>${t('arbol.p.fall')}</dt><dd>${esc(p.fallecimiento)}</dd>` : ''}
        ${padres.length ? `<dt>${t('arbol.p.padres')}</dt><dd>${link(padres)}</dd>` : ''}
        ${parejas.length ? `<dt>${t('arbol.p.pareja')}</dt><dd>${link(parejas)}</dd>` : ''}
        ${hijos.length ? `<dt>${t('arbol.p.hijos')}</dt><dd>${link(hijos.map(h => h.id))}</dd>` : ''}
        <dt>${t('arbol.p.fuente')}</dt><dd>${p._borrador ? t('arbol.p.borr') : p.fuente === 'libro' ? t('arbol.p.libro') : t('arbol.p.fam')}</dd>
      </dl>
      ${caps.length ? `<span class="eyebrow">${t('arbol.p.leer')}</span><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px">${caps.join('')}</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn peq" data-acc="editar">${t('arbol.p.editar')}</button>
        <button class="btn peq sec" data-acc="hijo">+ ${t('arbol.p.hijo')}</button>
        <button class="btn peq sec" data-acc="pareja">+ ${t('arbol.p.pareja.add')}</button>
        ${borr[id] ? `<button class="btn peq sec" data-acc="borrar">${t('arbol.p.borrar')}</button>` : ''}
      </div>`;
    panel.classList.add('abierto');
    $('.cerrar', panel).onclick = cerrar;
    $$('[data-ver]', panel).forEach(a => a.onclick = e => { e.preventDefault(); abrir(a.dataset.ver); });
    $('[data-acc="editar"]', panel).onclick = () => formulario({ editar: id });
    $('[data-acc="hijo"]', panel).onclick = () => formulario({ padres: [id, ...parejas.slice(0, 1)] });
    $('[data-acc="pareja"]', panel).onclick = () => formulario({ pareja: id });
    const bb = $('[data-acc="borrar"]', panel);
    if (bb) bb.onclick = () => { delete borr[id]; guardarBorr(); cerrar(); dibujar(); App.toast(t('toast.borrado')); };
    history.replaceState(null, '', '#/arbol/' + id);
  }
  function cerrar() { $('#panel').classList.remove('abierto'); $$('.persona', el).forEach(c => c.classList.remove('sel')); history.replaceState(null, '', '#/arbol'); }
  function guardarBorr() { store.set(CLAVE, borr); }

  /* ---------- Formulario (agregar / editar) ---------- */
  const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'persona';
  function formulario({ editar, padres = [], pareja } = {}) {
    const orig = editar ? P.get(editar) : {};
    const p = orig.placeholder ? { placeholder: true, padres: orig.padres } : orig;
    const L = App.lang;
    const opciones = sel => `<option value="">${t('form.ninguno')}</option>` + [...P.values()].filter(x => x.id !== editar && !x.placeholder).sort((a, b) => a.nombre.localeCompare(b.nombre)).map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('');
    const pa = editar ? (p.padres || []) : padres;
    const pr = editar ? (p.pareja || [])[0] : pareja;
    const dlg = $('#dlg');
    dlg.innerHTML = `<form method="dialog">
      <h2 style="font-size:1.7rem">${editar ? t('form.t.editar') : t('form.t.nuevo')}</h2>
      <div class="campo"><label>${t('form.nombre')} *</label><input name="nombre" required value="${esc(p.placeholder ? '' : p.nombre || '')}"></div>
      <div class="fila">
        <div class="campo"><label>${t('form.apodo')}</label><input name="apodo" value="${esc(p.apodo || '')}"></div>
        <div class="campo"><label>${t('form.lugar')}</label><input name="lugar" value="${esc(p.lugar || '')}"></div>
      </div>
      <div class="fila">
        <div class="campo"><label>${t('form.nac')}</label><input name="nacimiento" value="${esc(p.nacimiento || '')}" placeholder="1950"></div>
        <div class="campo"><label>${t('form.fall')}</label><input name="fallecimiento" value="${esc(p.fallecimiento || '')}"></div>
      </div>
      <div class="fila">
        <div class="campo"><label>${t('form.padres')}</label><select name="padre1">${opciones(pa[0])}</select></div>
        <div class="campo"><label>${t('form.padres2')}</label><select name="padre2">${opciones(pa[1])}</select></div>
      </div>
      <div class="campo"><label>${t('form.pareja')}</label><select name="pareja">${opciones(pr)}</select></div>
      <div class="campo"><label>${t('form.rol')}</label><input name="rol" value="${esc(App.tx(p.rol) || '')}"></div>
      <div class="campo"><label>${t('form.bio')}</label><textarea name="bio">${esc(p.placeholder ? '' : App.tx(p.bio) || '')}</textarea></div>
      <div class="campo"><label>${t('form.foto')}</label>
        <div style="display:flex;gap:12px;align-items:center"><img class="prev-foto" src="${esc(fotoDe(p))}" alt="" ${fotoDe(p) ? '' : 'style="visibility:hidden"'}><input type="file" name="foto" accept="image/*"></div></div>
      <p class="muted" style="font-size:.82rem">${t('form.nota')}</p>
      <div class="acciones-form"><button class="btn sec" value="cancel" formnovalidate>${t('form.cancelar')}</button><button class="btn terra" value="ok">${t('form.guardar')}</button></div>
    </form>`;
    let fotoData = p.foto_data || null;
    $('input[name=foto]', dlg).addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      fotoData = await reducir(f); const im = $('.prev-foto', dlg); im.src = fotoData; im.style.visibility = 'visible';
    });
    dlg.onclose = () => {
      if (dlg.returnValue !== 'ok') return;
      const fd = new FormData($('form', dlg));
      const nom = fd.get('nombre').trim(); if (!nom) return;
      let id = editar && !orig.placeholder ? editar : slug(nom);
      if (!editar || orig.placeholder) { let k = 2, b = id; while (P.has(id)) id = `${b}-${k++}`; }
      const trad = (v, prev) => { const o = typeof prev === 'object' && prev ? { ...prev } : {}; o[L] = v; return o; };
      const nueva = {
        ...(editar && !orig.placeholder ? borr[editar] || {} : {}),
        id, nombre: nom, apodo: fd.get('apodo').trim(), lugar: fd.get('lugar').trim(),
        nacimiento: fd.get('nacimiento').trim(), fallecimiento: fd.get('fallecimiento').trim(),
        padres: [fd.get('padre1'), fd.get('padre2')].filter(Boolean),
        pareja: fd.get('pareja') ? [fd.get('pareja')] : [],
        rol: trad(fd.get('rol').trim(), p.placeholder ? null : p.rol),
        bio: trad(fd.get('bio').trim(), p.placeholder ? null : p.bio),
        fuente: (editar && !p.placeholder && p.fuente) || 'familia'
      };
      // Si se completa una tarjeta «por completar», la nueva persona ocupa su lugar
      if (orig.placeholder && !nueva.padres.length) nueva.padres = [...(orig.padres || [])];
      if (fotoData) { nueva.foto_data = fotoData; nueva.foto = `img/familia/${id}.jpg`; }
      borr[id] = nueva; guardarBorr(); dibujar(); abrir(id); App.toast(t('toast.guardado'));
    };
    dlg.showModal();
  }
  function reducir(file) {
    return new Promise(res => {
      const img = new Image(); img.onload = () => {
        const s = Math.min(1, 900 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .84));
      }; img.src = URL.createObjectURL(file);
    });
  }

  /* ---------- Exportar ---------- */
  function descargar(nombreArchivo, url) { const a = document.createElement('a'); a.href = url; a.download = nombreArchivo; document.body.appendChild(a); a.click(); a.remove(); }
  function exportar() {
    const lista = [...personas().values()].map(p => { const c = { ...p }; delete c._borrador; delete c.foto_data; return c; });
    const json = JSON.stringify({ ...base, personas: lista }, null, 2);
    descargar('familia.json', URL.createObjectURL(new Blob([json], { type: 'application/json' })));
    Object.values(borr).filter(p => p.foto_data).forEach((p, i) => setTimeout(() => descargar(`${p.id}.jpg`, p.foto_data), 400 * (i + 1)));
    App.toast(t('toast.exportado'));
  }

  /* ---------- Zoom y arrastre ---------- */
  function aplicarZoom() { const z = $('.arbol-zoom', el); if (z) z.style.zoom = zoom; store.set('arbol-zoom', zoom); }
  function centrar() { const l = $('.arbol-lienzo', el); l.scrollLeft = (l.scrollWidth - l.clientWidth) / 2; l.scrollTop = 0; }

  /* ---------- Maquetación ---------- */
  el.innerHTML = `<section class="seccion" style="padding-top:36px"><div class="contenedor">
    <div class="seccion-cab"><span class="eyebrow">${t('arbol.eyebrow')}</span><h1>${t('arbol.t')}</h1><p>${t('arbol.p')}</p></div>
    <div class="arbol-barra">
      <button class="btn terra" id="b-agregar">+ ${t('arbol.agregar')}</button>
      <button class="btn sec" id="b-exportar">⤓ ${t('arbol.exportar')}</button>
      <button class="btn sec peq" id="b-ayuda">? ${t('arbol.ayuda')}</button>
      <span style="flex:1"></span>
      <button class="icono-btn" id="z-menos" aria-label="${t('arbol.zoom.menos')}">−</button>
      <button class="icono-btn" id="z-mas" aria-label="${t('arbol.zoom.mas')}">+</button>
      <button class="icono-btn" id="z-centro" aria-label="${t('arbol.centrar')}">◎</button>
    </div>
    <div class="arbol-lienzo"><div class="arbol-zoom"></div></div>
    <div class="leyenda-arbol">
      <span><i></i>${t('arbol.ley.libro')}</span>
      <span><i style="border-style:dashed"></i>${t('arbol.ley.conf')}</span>
      <span><i style="border:1px dashed var(--oro)"></i>${t('arbol.ley.borr')}</span>
    </div>
    <h3 id="otras-cab" style="margin-top:32px">${t('arbol.otras')}</h3>
    <div class="otras" id="otras"></div>
  </div></section>
  <aside class="panel-persona" id="panel" aria-live="polite"></aside>
  <dialog id="dlg"></dialog>
  <dialog id="dlg-ayuda"><form method="dialog"><h2 style="font-size:1.7rem">${t('ayuda.t')}</h2><p>${t('ayuda.p1')}</p><p>${t('ayuda.p2')}</p><p>${t('ayuda.p3')}</p><p>${t('ayuda.p4')}</p><div class="acciones-form"><button class="btn">${t('ayuda.ok')}</button></div></form></dialog>`;

  $('#b-agregar', el).onclick = () => formulario();
  $('#b-exportar', el).onclick = exportar;
  $('#b-ayuda', el).onclick = () => $('#dlg-ayuda', el).showModal();
  $('#z-mas', el).onclick = () => { zoom = Math.min(1.6, +(zoom + .1).toFixed(2)); aplicarZoom(); };
  $('#z-menos', el).onclick = () => { zoom = Math.max(.4, +(zoom - .1).toFixed(2)); aplicarZoom(); };
  $('#z-centro', el).onclick = centrar;

  const lienzo = $('.arbol-lienzo', el);
  let arr = null;
  lienzo.addEventListener('pointerdown', e => { if (e.target.closest('.persona') || e.pointerType === 'touch') return; arr = { x: e.clientX, y: e.clientY, l: lienzo.scrollLeft, t: lienzo.scrollTop }; lienzo.classList.add('arrastrando'); });
  window.addEventListener('pointermove', e => { if (!arr) return; lienzo.scrollLeft = arr.l - (e.clientX - arr.x); lienzo.scrollTop = arr.t - (e.clientY - arr.y); });
  window.addEventListener('pointerup', () => { arr = null; lienzo.classList.remove('arrastrando'); });

  dibujar();
  requestAnimationFrame(centrar);
  if (selId && P.has(selId)) abrir(selId);
};
