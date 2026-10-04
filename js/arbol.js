/* =========================================================
   Árbol familiar interactivo
   · «Árbol del libro»: solo las personas del libro (data/familia.json)
   · «Familia hoy»: el árbol completo del libro + quienes no salen en él
   Todo se puede editar o ampliar desde aquí. Los cambios se ven al instante
   en este navegador y se publican para todos cuando se aprueban.
   ========================================================= */
window.PaginaArbol = async function (el, [arg]) {
  const { $, $$, esc, t, store } = { ...App, t: App.t };
  const [base, ap] = await Promise.all([App.data('familia'), App.aportes()]);
  const idsLibro = new Set(base.personas.map(p => p.id));
  let zoom = store.get('arbol-zoom', 1);
  let pestaña = arg === 'hoy' || arg === 'libro' ? arg : null;
  const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'persona';
  const CAMPOS = ['nombre', 'apodo', 'lugar', 'nacimiento', 'fallecimiento', 'padres', 'pareja', 'rol', 'bio', 'vive'];

  // Borradores de la primera versión del sitio → se convierten en cambios sin enviar
  (function migrar() {
    const viejos = store.get('familia-borradores-v1', null); if (!viejos) return;
    const yo = store.get('aportar-autor', { nombre: '', relacion: '' });
    for (const p of Object.values(viejos)) {
      const datos = { id_sugerido: p.id, nombre: p.nombre, apodo: p.apodo || '', lugar: p.lugar || '', nacimiento: p.nacimiento || '', fallecimiento: p.fallecimiento || '', padres: p.padres || [], pareja: p.pareja || [], rol: p.rol || {}, bio: p.bio || {}, vive: true };
      const nuevo = !idsLibro.has(p.id);
      const payload = nuevo ? { tipo: 'persona', datos, foto: p.foto_data || null, autor: yo, consentimiento: true }
        : { tipo: 'editar', seccion: 'libro', objetivo: p.id, datos, foto: p.foto_data || null, autor: yo, consentimiento: true };
      Aportes.marcarPendiente(nuevo ? { tipo: 'persona', id: p.id, datos, autor: yo, miniatura: p.foto_data || '', pr: null, payload }
        : { tipo: 'editar', objetivo: p.id, seccion: 'libro', datos, autor: yo, miniatura: p.foto_data || '', pr: null, payload });
    }
    try { localStorage.removeItem('familia-borradores-v1'); } catch {}
  })();

  /* ---------- Datos: libro + aprobados + lo de este navegador ---------- */
  function construir() {
    const m = new Map(base.personas.map(p => [p.id, { ...p, _sec: 'libro', _estado: 'libro' }]));
    for (const p of ap.personas) if (!m.has(p.id)) m.set(p.id, { ...p, _sec: 'hoy', _estado: 'aprobado' });
    for (const x of App.pendientes()) {
      if (x.tipo === 'persona' && !m.has(x.id)) m.set(x.id, { id: x.id, ...x.datos, foto: x.miniatura, _sec: 'hoy', _estado: x.pr === null ? 'local' : 'pendiente', aportado_por: x.autor, _uid: x.uid });
      if (x.tipo === 'editar' && m.has(x.objetivo)) {
        const p = m.get(x.objetivo);
        for (const [k, v] of Object.entries(x.datos)) {
          if (k === 'id_sugerido') continue;
          p[k] = (k === 'rol' || k === 'bio') && typeof v === 'object' ? { ...(typeof p[k] === 'object' ? p[k] : {}), ...v } : v;
        }
        if (x.miniatura) p.foto = x.miniatura;
        p._editado = true; if (x.pr === null) p._local = true;
      }
    }
    return m;
  }
  Aportes.limpiarAprobados(ap, base);
  let P = construir();
  const nombre = id => P.get(id)?.nombre || id;
  const parejasDe = p => [...new Set([...(p.pareja || []), ...[...P.values()].filter(x => (x.pareja || []).includes(p.id)).map(x => x.id)])].filter(id => P.has(id));
  const hijosDe = ids => [...P.values()].filter(x => (x.padres || []).some(pa => ids.includes(pa)));

  /* ---------- Tarjeta ---------- */
  function tarjeta(p) {
    const hoy = p._sec === 'hoy';
    const cls = ['persona', p.por_confirmar ? 'pendiente' : '', hoy ? 'de-hoy' : '', (p._estado === 'pendiente' || p._estado === 'local' || p._editado) ? 'enviado' : ''].join(' ');
    const extra = [];
    const adoptivos = [...P.values()].filter(x => (x.adopta || []).includes(p.id));
    if (adoptivos.length) extra.push(`${t('arbol.adopcion')} <a data-ver="${adoptivos[0].id}">${esc(adoptivos[0].nombre)}</a>`);
    if ((p.hermanos || []).length) extra.push(`${t('arbol.hermano')} <a data-ver="${p.hermanos[0]}">${esc(nombre(p.hermanos[0]).split(' ')[0])}</a>`);
    const f = p.foto || '';
    const av = f ? `<span class="avatar"><img src="${esc(f)}" alt=""></span>` : `<span class="avatar" style="background:${App.color(p.id)}">${esc(App.iniciales(p.nombre))}</span>`;
    const fechas = [p.nacimiento, p.fallecimiento].filter(Boolean).join(' – ');
    const local = p._estado === 'local' || p._local;
    const marca = local ? `<span class="marca-conf" title="${esc(t('arbol.ley.local'))}">💾</span>`
      : (p._estado === 'pendiente' || p._editado) ? `<span class="marca-conf" title="${esc(t(p._editado ? 'arbol.editado' : 'arbol.ley.pend'))}">⏳</span>`
      : p.por_confirmar ? `<span class="marca-conf" title="${esc(t('arbol.ley.conf'))}">?</span>` : '';
    return `<div class="${cls}" tabindex="0" role="button" data-id="${esc(p.id)}">
      ${marca}${hoy ? '<span class="marca-hoy">🌱</span>' : ''}${av}<b>${esc(p.nombre)}</b>
      ${p.apodo ? `<small><i>${esc(p.apodo)}</i></small>` : ''}
      ${fechas ? `<small>${esc(fechas)}</small>` : ''}
      ${App.tx(p.rol) ? `<small>${esc(App.tx(p.rol))}</small>` : ''}
      ${extra.length ? `<span class="adopcion">${extra.join('<br>')}</span>` : ''}
    </div>`;
  }
  const hueco = padre => `<button class="persona hueco" data-hijo-de="${esc(padre)}"><span class="avatar">+</span><b>${t('arbol.p.hijo')}</b></button>`;

  /* ---------- Árbol recursivo ----------
     modo 'libro': solo personas del libro · modo 'hoy': todas */
  function nodo(id, vistos, modo) {
    const p = P.get(id); if (!p || vistos.has(id)) return '';
    vistos.add(id);
    const ok = x => modo === 'hoy' || P.get(x)?._sec === 'libro';
    const parejas = parejasDe(p).filter(x => !vistos.has(x) && ok(x));
    parejas.forEach(x => vistos.add(x));
    const grupo = [id, ...parejas];
    const hijos = hijosDe(grupo).filter(h => !vistos.has(h.id) && ok(h.id)).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    const nucleo = `<div class="nucleo">${tarjeta(p)}${parejas.map(x => `<span class="union"></span>${tarjeta(P.get(x))}`).join('')}</div>`;
    const sub = hijos.map(h => nodo(h.id, vistos, modo)).filter(Boolean);
    // En «Familia hoy», un «+» bajo el abuelo y bajo cada persona de hoy para seguir la rama
    if (modo === 'hoy' && (id === 'freddy' || p._sec === 'hoy')) sub.push(`<li>${hueco(id)}</li>`);
    return `<li>${nucleo}${sub.length ? `<ul>${sub.join('')}</ul>` : ''}</li>`;
  }

  function dibujar() {
    P = construir();
    const vistos = new Set();
    const raiz = base.raiz && P.has(base.raiz) ? base.raiz : base.personas[0].id;
    const principal = `<div class="arbol"><ul>${nodo(raiz, vistos, pestaña)}</ul></div>`;
    // Ramas no conectadas (familia adoptiva, hermanos de Abrahán, personas nuevas sin padres…)
    const sueltas = [...P.values()].filter(p => !vistos.has(p.id) && (pestaña === 'hoy' || p._sec === 'libro') && !(p.padres || []).some(pa => P.has(pa)));
    const otras = sueltas.map(p => `<div class="arbol"><ul>${nodo(p.id, vistos, pestaña)}</ul></div>`).join('');
    $('.arbol-zoom', el).innerHTML = `<div class="bosque">${principal}</div>`;
    $('#otras', el).innerHTML = otras;
    $('#otras-cab', el).hidden = !otras;
    $$('.pestana', el).forEach(b => b.setAttribute('aria-selected', b.dataset.tab === pestaña));
    $('#intro-tab', el).textContent = pestaña === 'libro' ? t('arbol.p.libro2') : t('arbol.hoy.p');
    $('.leyenda-arbol', el).innerHTML = `<span><i></i>${t('arbol.ley.libro')}</span>`
      + (pestaña === 'hoy' ? `<span><i class="hoy-i"></i>🌱 ${t('arbol.ley.hoy')}</span>` : '')
      + `<span><i style="border-style:dashed"></i>? ${t('arbol.ley.conf')}</span><span><i style="border:1px dashed var(--oro)"></i>⏳ ${t('arbol.ley.pend')}</span>`
      + (Aportes.sinEnviar().length ? `<span>💾 ${t('arbol.ley.local')}</span>` : '');
    $$('.persona[data-id]', el).forEach(c => {
      c.addEventListener('click', e => { if (e.target.closest('[data-ver]')) return; abrir(c.dataset.id); });
      c.addEventListener('keydown', e => { if (e.key === 'Enter') abrir(c.dataset.id); });
    });
    $$('[data-hijo-de]', el).forEach(b => b.onclick = () => formulario({ padres: [b.dataset.hijoDe, ...parejasDe(P.get(b.dataset.hijoDe)).slice(0, 1)] }));
    $$('[data-ver]', el).forEach(a => a.addEventListener('click', e => { e.stopPropagation(); abrir(a.dataset.ver); }));
    banner();
    aplicarZoom();
  }

  /* ---------- Panel lateral ---------- */
  async function abrir(id) {
    const p = P.get(id); if (!p) return;
    if (pestaña === 'libro' && p._sec === 'hoy') { pestaña = 'hoy'; dibujar(); }
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
    const estado = p._local ? t('arbol.ley.local') : { libro: t('arbol.p.libro'), aprobado: t('arbol.p.fam'), pendiente: t('arbol.ley.pend'), local: t('arbol.ley.local') }[p._estado];
    const panel = $('#panel');
    panel.innerHTML = `
      <button class="icono-btn cerrar" aria-label="${t('gen.cerrar')}">✕</button>
      ${p.foto ? `<img class="foto" src="${esc(p.foto)}" alt="" data-zoom>` : ''}
      ${App.tx(p.rol) ? `<span class="eyebrow">${esc(App.tx(p.rol))}</span>` : ''}
      <h2 style="font-size:1.9rem">${esc(p.nombre)}</h2>
      ${p.apodo ? `<p class="muted" style="font-family:var(--serif);font-size:1.15rem;font-style:italic;margin-top:-.4em">${esc(p.apodo)}</p>` : ''}
      ${p._editado ? `<div class="aviso">⏳ ${t('arbol.editado')}</div>` : ''}
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
        <button class="btn peq" data-acc="editar">✎ ${t('arbol.p.editar')}</button>
        <button class="btn peq sec" data-acc="hijo">+ ${t('arbol.p.hijo')}</button>
        <button class="btn peq sec" data-acc="pareja">+ ${t('arbol.p.pareja.add')}</button>
        <a class="btn peq sec" href="#/aportar/recuerdo/${esc(id)}">💬 ${t('arbol.p.recuerdo')}</a>
        <a class="btn peq sec" href="#/aportar/foto/${esc(id)}">📷 ${t('aportar.foto')}</a>
      </div>`;
    panel.classList.add('abierto');
    $('.cerrar', panel).onclick = cerrar;
    $$('[data-ver]', panel).forEach(a => a.onclick = e => { e.preventDefault(); abrir(a.dataset.ver); });
    $('[data-acc="editar"]', panel).onclick = () => formulario({ editar: id });
    $('[data-acc="hijo"]', panel).onclick = () => formulario({ padres: [id, ...parejas.slice(0, 1)] });
    $('[data-acc="pareja"]', panel).onclick = () => formulario({ pareja: id });
    history.replaceState(null, '', '#/arbol/' + id);
  }
  function cerrar() { $('#panel').classList.remove('abierto'); $$('.persona', el).forEach(c => c.classList.remove('sel')); history.replaceState(null, '', '#/arbol/' + pestaña); }

  /* ---------- Formulario: agregar o editar ---------- */
  function formulario({ editar, padres = [], pareja } = {}) {
    const p = editar ? P.get(editar) : {};
    const L = App.lang;
    const yo = store.get('aportar-autor', { nombre: '', relacion: '' });
    const opciones = sel => `<option value="">${t('form.ninguno')}</option>` + [...P.values()].filter(x => x.id !== editar).sort((a, b) => a.nombre.localeCompare(b.nombre)).map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('');
    const pa = editar ? (p.padres || []) : padres;
    const pr = editar ? (p.pareja || [])[0] : pareja;
    const titulo = editar ? `${t('form.t.editar')}: ${p.nombre}` : pareja ? `${t('form.t.pareja')} · ${nombre(pareja)}` : t('form.t.nuevo');
    const dlg = $('#dlg');
    dlg.innerHTML = `<form method="dialog" novalidate>
      <h2 style="font-size:1.6rem">${esc(titulo)}</h2>
      <div class="campo"><label>${t('form.nombre')} *</label><input name="nombre" required value="${esc(p.nombre || '')}"></div>
      <div class="fila">
        <div class="campo"><label>${t('form.apodo')}</label><input name="apodo" value="${esc(p.apodo || '')}"></div>
        <div class="campo"><label>${t('form.lugar')}</label><input name="lugar" value="${esc(p.lugar || '')}"></div>
      </div>
      ${p._sec !== 'libro' ? `<label class="check"><input type="checkbox" name="vive" ${p.vive === false ? '' : 'checked'}> ${t('aportar.vive')}</label><p class="muted pequeno">${t('aportar.vive.nota')}</p>` : ''}
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
      <div class="campo"><label>${t('form.bio')}</label><textarea name="bio">${esc(App.tx(p.bio) || '')}</textarea></div>
      <div class="campo"><label>${t('form.foto')}</label>
        <div class="foto-sel"><img class="prev-foto" src="${esc(p.foto || '')}" alt="" ${p.foto ? '' : 'hidden'}><input type="file" name="foto" accept="image/*"></div></div>
      <div class="fila">
        <div class="campo"><label>${t('aportar.autor')}</label><input name="autor" required value="${esc(yo.nombre)}" autocomplete="name"></div>
        <div class="campo"><label>${t('aportar.relacion')}</label><input name="relacion" value="${esc(yo.relacion)}" placeholder="${t('aportar.relacion.ej')}"></div>
      </div>
      <label class="check"><input type="checkbox" name="consent" required> ${t('aportar.consent')}</label>
      <p class="muted pequeno">${t('form.nota2')} ${window.CONFIG?.endpointAportes ? '' : t('aportar.sinbuzon')}</p>
      <p class="error-form" id="err-dlg" hidden></p>
      <div class="acciones-form"><button class="btn sec" value="cancel" formnovalidate>${t('form.cancelar')}</button><button class="btn terra" value="ok" id="dlg-ok">${window.CONFIG?.endpointAportes ? t('aportar.enviar') : t('aportar.guardar')}</button></div>
    </form>`;
    let foto = null;
    $('input[name=foto]', dlg).addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      foto = await Aportes.reducir(f, 900); const im = $('.prev-foto', dlg); im.src = foto; im.hidden = false;
    });
    $('#dlg-ok', dlg).onclick = async e => {
      e.preventDefault();
      const form = $('form', dlg); const fd = new FormData(form); const err = $('#err-dlg', dlg);
      if (!fd.get('nombre').trim() || !fd.get('autor').trim() || !fd.get('consent')) { err.textContent = t('aportar.req'); err.hidden = false; return; }
      const autor = { nombre: fd.get('autor').trim(), relacion: fd.get('relacion').trim() };
      store.set('aportar-autor', autor);
      const nuevos = {
        nombre: fd.get('nombre').trim(), apodo: fd.get('apodo').trim(), lugar: fd.get('lugar').trim(),
        nacimiento: fd.get('nacimiento').trim(), fallecimiento: fd.get('fallecimiento').trim(),
        padres: [fd.get('padre1'), fd.get('padre2')].filter(Boolean), pareja: fd.get('pareja') ? [fd.get('pareja')] : [],
        rol: fd.get('rol').trim() ? { [L]: fd.get('rol').trim() } : {}, bio: fd.get('bio').trim() ? { [L]: fd.get('bio').trim() } : {}
      };
      if (form.querySelector('[name=vive]')) nuevos.vive = !!fd.get('vive');
      const miniatura = foto ? await Aportes.reducir(await (await fetch(foto)).blob(), 360, .75) : '';
      let payload, entrada;
      if (editar && p._estado !== 'pendiente') {
        // Solo los campos que cambiaron
        const datos = {};
        for (const k of CAMPOS) {
          if (!(k in nuevos)) continue;
          const antes = (k === 'rol' || k === 'bio') ? App.tx(p[k]) || '' : JSON.stringify(p[k] ?? (Array.isArray(nuevos[k]) ? [] : ''));
          const ahora = (k === 'rol' || k === 'bio') ? App.tx(nuevos[k]) || '' : JSON.stringify(nuevos[k]);
          if (antes !== ahora) datos[k] = nuevos[k];
        }
        if (!Object.keys(datos).length && !foto) { App.toast(t('toast.sincambios')); dlg.close(); return; }
        payload = { tipo: 'editar', seccion: p._sec, objetivo: editar, datos, foto, autor, consentimiento: true };
        entrada = { tipo: 'editar', objetivo: editar, seccion: p._sec, datos, autor, miniatura };
      } else if (editar) {
        // Persona aún no aprobada: se actualiza el envío guardado
        const l = App.pendientes(); const x = l.find(y => y.uid === p._uid);
        if (x) {
          x.datos = { ...x.datos, ...nuevos }; if (miniatura) x.miniatura = miniatura;
          if (x.payload) {
            // Aún no se había enviado: se actualiza y, si el buzón está activo, se envía ahora
            x.payload.datos = { ...x.payload.datos, ...nuevos }; if (foto) x.payload.foto = foto; Aportes._guardar(l);
            dlg.close();
            if (window.CONFIG?.endpointAportes) { await enviarPendientes(); } else App.toast(t('toast.guardado'));
            dibujar(); abrir(editar); return;
          }
          Aportes._guardar(l);
        }
        payload = { tipo: 'editar', seccion: 'hoy', objetivo: editar, datos: nuevos, foto, autor, consentimiento: true };
        entrada = { tipo: 'editar', objetivo: editar, seccion: 'hoy', datos: nuevos, autor, miniatura };
      } else {
        let id = slug(nuevos.nombre), k = 2; const b = id; while (P.has(id)) id = `${b}-${k++}`;
        const datos = { ...nuevos, id_sugerido: id };
        if (!('vive' in datos)) datos.vive = true;
        payload = { tipo: 'persona', datos, foto, autor, consentimiento: true };
        entrada = { tipo: 'persona', id, datos, autor, miniatura };
      }
      const btn = $('#dlg-ok', dlg); btn.disabled = true; btn.textContent = t('aportar.enviando');
      try {
        const r = await Aportes.procesar(payload, entrada);
        dlg.close(); dibujar(); abrir(entrada.objetivo || entrada.id);
        App.toast(r.guardado ? t('toast.guardado') : t('toast.enviado'));
      } catch (ex) {
        err.textContent = `${t('aportar.error')}: ${ex.message}`; err.hidden = false;
        btn.disabled = false; btn.textContent = t('aportar.enviar');
      }
    };
    dlg.showModal();
  }

  /* ---------- Cambios guardados solo en este navegador ---------- */
  function banner() {
    const n = Aportes.sinEnviar().length; const caja = $('#migrar', el);
    if (!n) { caja.hidden = true; return; }
    const hay = !!window.CONFIG?.endpointAportes;
    caja.hidden = false;
    caja.innerHTML = `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <span style="flex:1;min-width:220px">💾 ${t('arbol.sinenviar').replace('{n}', n)} ${hay ? '' : t('arbol.sinenviar.nobuzon')}</span>
      ${hay ? `<button class="btn peq terra" id="mig-env">${t('arbol.sinenviar.enviar')}</button>` : ''}
      <button class="btn peq sec" id="mig-desc">⤓ ${t('arbol.sinenviar.desc')}</button></div>`;
    $('#mig-desc').onclick = () => Aportes.descargarSinEnviar();
    const env = $('#mig-env');
    if (env) env.onclick = async () => {
      env.disabled = true;
      try { await Aportes.reenviar(); App.toast(t('toast.enviado')); }
      catch (e) { App.toast(`${t('aportar.error')}: ${e.message}`); }
      dibujar();
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
      <button class="btn terra" id="b-agregar">+ ${t('arbol.agregar')}</button>
      <a class="btn sec" href="#/album">📷 ${t('nav.album')}</a>
      ${admin ? `<a class="btn sec peq" href="${admin}" target="_blank" rel="noopener">⚙ ${t('arbol.admin')}</a>` : ''}
      <span style="flex:1"></span>
      <button class="icono-btn" id="z-menos" aria-label="${t('arbol.zoom.menos')}">−</button>
      <button class="icono-btn" id="z-mas" aria-label="${t('arbol.zoom.mas')}">+</button>
      <button class="icono-btn" id="z-centro" aria-label="${t('arbol.centrar')}">◎</button>
    </div>
    <div class="arbol-lienzo"><div class="arbol-zoom"></div></div>
    <div class="leyenda-arbol"></div>
    <h3 id="otras-cab" style="margin-top:32px">${t('arbol.otras')}</h3>
    <div class="otras" id="otras"></div>
  </div></section>
  <aside class="panel-persona" id="panel" aria-live="polite"></aside>
  <dialog id="dlg"></dialog>`;

  $$('.pestana', el).forEach(b => b.onclick = () => { pestaña = b.dataset.tab; cerrar(); dibujar(); requestAnimationFrame(centrar); });
  $('#b-agregar', el).onclick = () => formulario();
  $('#z-mas', el).onclick = () => { zoom = Math.min(1.6, +(zoom + .1).toFixed(2)); aplicarZoom(); };
  $('#z-menos', el).onclick = () => { zoom = Math.max(.4, +(zoom - .1).toFixed(2)); aplicarZoom(); };
  $('#z-centro', el).onclick = centrar;
  const lienzo = $('.arbol-lienzo', el);
  let arr = null;
  lienzo.addEventListener('pointerdown', e => { if (e.target.closest('.persona') || e.pointerType === 'touch') return; arr = { x: e.clientX, y: e.clientY, l: lienzo.scrollLeft, t: lienzo.scrollTop }; lienzo.classList.add('arrastrando'); });
  window.addEventListener('pointermove', e => { if (!arr) return; lienzo.scrollLeft = arr.l - (e.clientX - arr.x); lienzo.scrollTop = arr.t - (e.clientY - arr.y); });
  window.addEventListener('pointerup', () => { arr = null; lienzo.classList.remove('arrastrando'); });

  const sel = arg && !pestaña && P.has(arg) ? arg : null;
  if (!pestaña) pestaña = sel && P.get(sel)._sec === 'hoy' ? 'hoy' : 'libro';
  dibujar();
  requestAnimationFrame(centrar);
  if (sel) abrir(sel);
  // Si hay cosas guardadas sin enviar y el buzón ya está activo, se envían solas
  if (window.CONFIG?.endpointAportes && Aportes.sinEnviar().length) { await enviarPendientes(); dibujar(); }

  async function enviarPendientes() {
    try { const n = await Aportes.reenviar(); if (n) App.toast(t('toast.enviado')); }
    catch (e) { App.toast(`${t('aportar.error')}: ${e.message}`); }
  }
};
