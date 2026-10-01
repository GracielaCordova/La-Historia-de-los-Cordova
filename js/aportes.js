/* =========================================================
   Aportes de la familia, álbum y privacidad
   - Aportar: formulario → buzón (Cloudflare Worker) → propuesta en GitHub
   - Nada se publica hasta que la administradora aprueba la propuesta
   ========================================================= */
(() => {
  const CFG = window.CONFIG || {};
  const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'aporte';

  /* ---------- Utilidades compartidas ---------- */
  window.Aportes = {
    // Reduce una foto en el navegador (máx. 1600 px para el álbum, 900 px para retratos)
    reducir(file, max = 1600, calidad = .85) {
      return new Promise((ok, mal) => {
        const img = new Image();
        img.onload = () => {
          const s = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', calidad));
        };
        img.onerror = mal; img.src = URL.createObjectURL(file);
      });
    },
    // Envía un aporte al buzón. Devuelve {ok, pr} o lanza error.
    async enviar(payload) {
      if (!CFG.endpointAportes) throw Object.assign(new Error('sin-buzon'), { sinBuzon: true });
      const r = await fetch(CFG.endpointAportes, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || `Error ${r.status}`);
      return d;
    },
    // Guarda en este navegador lo enviado, para verlo como «pendiente» hasta que se apruebe.
    // Si aún no se pudo enviar (pr === null), guarda también el envío completo para reintentarlo.
    marcarPendiente(entrada) {
      const l = App.pendientes(); l.push({ uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ...entrada, enviado: new Date().toISOString() });
      this._guardar(l);
    },
    _guardar(l) {
      try { localStorage.setItem('aportes-pendientes', JSON.stringify(l)); }
      catch { // sin espacio: quitar fotos completas
        l.forEach(x => { if (x.payload) x.payload.foto = null; }); App.store.set('aportes-pendientes', l);
      }
    },
    // Envía (o guarda si el buzón no está listo). Devuelve {pr} o {guardado:true}
    async procesar(payload, entrada) {
      try {
        const r = await this.enviar(payload);
        this.marcarPendiente({ ...entrada, pr: r.pr });
        return { pr: r.pr };
      } catch (e) {
        if (!e.sinBuzon) throw e;
        this.marcarPendiente({ ...entrada, pr: null, payload });
        return { guardado: true };
      }
    },
    sinEnviar() { return App.pendientes().filter(x => x.pr === null && x.payload); },
    // Reintenta enviar todo lo guardado en este navegador
    async reenviar() {
      const l = App.pendientes(); let n = 0;
      for (const x of l) {
        if (x.pr !== null || !x.payload) continue;
        const r = await this.enviar(x.payload);
        x.pr = r.pr; delete x.payload; n++;
        this._guardar(l);
      }
      return n;
    },
    descargarSinEnviar() {
      const l = this.sinEnviar().map(x => ({ ...x.payload, fecha: x.enviado }));
      this.descargar(`aportes-mama-martina-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(l, null, 2));
    },
    descargar(nombre, contenido) {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([contenido], { type: 'application/json' }));
      a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    },
    // Lista de personas (libro + aprobadas + pendientes propias) para los selectores
    async personas() {
      const [fam, ap] = await Promise.all([App.data('familia'), App.aportes()]);
      const pend = App.pendientes().filter(p => p.tipo === 'persona').map(p => ({ id: p.id, nombre: p.datos.nombre, _pend: true }));
      const vistos = new Set(); const out = [];
      for (const p of [...fam.personas, ...ap.personas, ...pend]) if (!vistos.has(p.id)) { vistos.add(p.id); out.push(p); }
      return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
    },
    admin() { return CFG.repositorio ? `https://github.com/${CFG.repositorio}/pulls?q=is%3Aopen+label%3Aaporte` : ''; }
  };

  /* =========================================================
     APORTAR
     ========================================================= */
  window.PaginaAportar = async function (el, [tipoIni, ref]) {
    const { $, $$, esc, t, store } = { ...App, t: App.t };
    const personas = await Aportes.personas();
    const L = App.lang;
    const tipos = [['persona', '👤'], ['foto', '📷'], ['lugar', '📍'], ['recuerdo', '✎']];
    let tipo = tipos.some(x => x[0] === tipoIni) ? tipoIni : 'persona';
    const yo = store.get('aportar-autor', { nombre: '', relacion: '' });
    const opciones = (sel, vacio = true) => (vacio ? `<option value="">${t('form.ninguno')}</option>` : '') + personas.map(p => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(p.nombre)}${p._pend ? ' ⏳' : ''}</option>`).join('');

    const campos = {
      persona: () => `
        <div class="campo"><label>${t('form.nombre')} *</label><input name="nombre" required></div>
        <div class="fila"><div class="campo"><label>${t('form.apodo')}</label><input name="apodo"></div>
          <div class="campo"><label>${t('form.lugar')}</label><input name="lugar"></div></div>
        <label class="check"><input type="checkbox" name="vive" checked> ${t('aportar.vive')}</label>
        <p class="muted pequeno">${t('aportar.vive.nota')}</p>
        <div class="fila"><div class="campo"><label>${t('form.nac')}</label><input name="nacimiento" placeholder="1985" inputmode="numeric"></div>
          <div class="campo"><label>${t('form.fall')}</label><input name="fallecimiento"></div></div>
        <div class="fila"><div class="campo"><label>${t('form.padres')}</label><select name="padre1">${opciones(tipoIni === 'persona' ? ref : '')}</select></div>
          <div class="campo"><label>${t('form.padres2')}</label><select name="padre2">${opciones('')}</select></div></div>
        <div class="campo"><label>${t('form.pareja')}</label><select name="pareja">${opciones('')}</select></div>
        <div class="campo"><label>${t('form.rol')}</label><input name="rol" maxlength="200"></div>
        <div class="campo"><label>${t('form.bio')}</label><textarea name="bio"></textarea></div>
        <div class="campo"><label>${t('form.foto')}</label><div class="foto-sel"><img class="prev-foto" alt="" hidden><input type="file" name="foto" accept="image/*"></div></div>`,
      foto: () => `
        <div class="campo"><label>${t('aportar.foto.archivo')}</label><div class="foto-sel"><img class="prev-foto" alt="" hidden><input type="file" name="foto" accept="image/*" required></div></div>
        <div class="campo"><label>${t('aportar.foto.titulo')}</label><input name="titulo" required></div>
        <div class="campo"><label>${t('aportar.foto.desc')}</label><textarea name="descripcion"></textarea></div>
        <div class="fila"><div class="campo"><label>${t('aportar.foto.anio')}</label><input name="anio"></div>
          <div class="campo"><label>${t('aportar.foto.lugar')}</label><input name="lugar"></div></div>
        <div class="campo"><label>${t('aportar.foto.personas')}</label><select name="personas" multiple size="6">${opciones(ref, false)}</select></div>`,
      lugar: () => `
        <div class="campo"><label>${t('aportar.lugar.nombre')}</label><input name="nombre" required></div>
        <div class="campo"><label>${t('aportar.lugar.desc')}</label><textarea name="desc"></textarea></div>
        <div class="campo"><label>${t('aportar.lugar.dato')}</label><input name="dato"></div>
        <div class="campo"><label>${t('aportar.lugar.mapa')}</label><input name="mapa" placeholder="${t('aportar.lugar.mapa.ej')}"><small class="muted" id="coords-ok"></small></div>
        <div class="campo"><label>${t('form.foto')}</label><div class="foto-sel"><img class="prev-foto" alt="" hidden><input type="file" name="foto" accept="image/*"></div></div>`,
      recuerdo: () => `
        <div class="campo"><label>${t('aportar.recuerdo.persona')}</label><select name="persona" required>${opciones(ref)}</select></div>
        <div class="campo"><label>${t('aportar.recuerdo.texto')}</label><textarea name="texto" required style="min-height:160px"></textarea></div>
        <label class="check"><input type="checkbox" name="es_correccion"> ${t('aportar.recuerdo.corr')}</label>`
    };

    const pintar = () => {
      el.innerHTML = `<section class="seccion"><div class="contenedor" style="max-width:820px">
        <div class="seccion-cab"><span class="eyebrow">${t('aportar.eyebrow')}</span><h1>${t('aportar.t')}</h1><p>${t('aportar.p')}</p></div>
        <span class="eyebrow">${t('aportar.tipo')}</span>
        <div class="tipos">${tipos.map(([k, ic]) => `<button type="button" data-tipo="${k}" aria-pressed="${k === tipo}"><span class="ic">${ic}</span><b>${t('aportar.' + k)}</b><small>${t('aportar.' + k + '.p')}</small></button>`).join('')}</div>
        <form class="tarjeta form-aporte" novalidate>
          ${campos[tipo]()}
          <h3 style="margin-top:10px">${t('aportar.tu')}</h3>
          <div class="fila"><div class="campo"><label>${t('aportar.autor')}</label><input name="autor" required value="${esc(yo.nombre)}" autocomplete="name"></div>
            <div class="campo"><label>${t('aportar.relacion')}</label><input name="relacion" value="${esc(yo.relacion)}" placeholder="${t('aportar.relacion.ej')}"></div></div>
          <div class="trampa" aria-hidden="true"><label>Web<input name="sitio_web" tabindex="-1" autocomplete="off"></label></div>
          <label class="check"><input type="checkbox" name="consent" required> ${t('aportar.consent')}</label>
          <p class="muted pequeno">${t('aportar.publico')} <a href="#/privacidad">${t('nav.privacidad')}</a></p>
          <div id="turnstile"></div>
          <p class="error-form" id="err" hidden></p>
          <div class="acciones-form">
            ${CFG.endpointAportes ? '' : `<span class="muted pequeno" style="flex:1">${t('aportar.sinbuzon')}</span>`}
            <button class="btn terra" type="submit">${CFG.endpointAportes ? t('aportar.enviar') : t('aportar.guardar')}</button>
          </div>
        </form></div></section>`;
      $$('.tipos button', el).forEach(b => b.onclick = () => { tipo = b.dataset.tipo; ref = ''; tipoIni = tipo; pintar(); history.replaceState(null, '', '#/aportar/' + tipo); });
      const form = $('form', el);
      let foto = null;
      const inFoto = $('input[name=foto]', form);
      if (inFoto) inFoto.onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        foto = await Aportes.reducir(f, tipo === 'foto' ? 1600 : 900);
        const im = $('.prev-foto', form); im.src = foto; im.hidden = false;
      };
      let coords = null;
      const inMapa = $('input[name=mapa]', form);
      if (inMapa) inMapa.oninput = () => {
        const v = inMapa.value;
        const m = v.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) || v.match(/[?&](?:q|query|ll)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/) || v.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/) || v.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
        coords = m ? [+m[1], +m[2]] : null;
        $('#coords-ok').textContent = coords ? `✓ ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}` : '';
      };
      if (CFG.turnstileSiteKey) {
        const pintarTs = () => window.turnstile && turnstile.render('#turnstile', { sitekey: CFG.turnstileSiteKey });
        if (window.turnstile) pintarTs();
        else { const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'; s.onload = pintarTs; document.head.appendChild(s); }
      }

      form.onsubmit = async e => {
        e.preventDefault();
        const fd = new FormData(form); const err = $('#err');
        const req = [...form.querySelectorAll('[required]')].filter(x => x.type === 'checkbox' ? !x.checked : x.type === 'file' ? !foto : !String(x.value).trim());
        if (req.length) { err.textContent = t('aportar.req'); err.hidden = false; req[0].focus(); return; }
        err.hidden = true;
        const autor = { nombre: fd.get('autor').trim(), relacion: fd.get('relacion').trim() };
        store.set('aportar-autor', autor);
        const trad = v => (v ? { [L]: v } : {});
        let datos;
        if (tipo === 'persona') datos = {
          nombre: fd.get('nombre').trim(), apodo: fd.get('apodo').trim(), lugar: fd.get('lugar').trim(), vive: !!fd.get('vive'),
          nacimiento: fd.get('nacimiento').trim(), fallecimiento: fd.get('fallecimiento').trim(),
          padres: [fd.get('padre1'), fd.get('padre2')].filter(Boolean), pareja: fd.get('pareja') ? [fd.get('pareja')] : [],
          rol: trad(fd.get('rol').trim()), bio: trad(fd.get('bio').trim())
        };
        if (tipo === 'foto') datos = { titulo: fd.get('titulo').trim(), descripcion: fd.get('descripcion').trim(), anio: fd.get('anio').trim(), lugar: fd.get('lugar').trim(), personas: fd.getAll('personas') };
        if (tipo === 'lugar') datos = { nombre: fd.get('nombre').trim(), desc: trad(fd.get('desc').trim()), dato: fd.get('dato').trim(), coords };
        if (tipo === 'recuerdo') datos = { persona: fd.get('persona'), texto: fd.get('texto').trim(), es_correccion: !!fd.get('es_correccion') };
        const id = tipo === 'persona' ? slug(datos.nombre) : `${slug(datos.nombre || datos.titulo || datos.persona)}-${Date.now().toString(36)}`;
        if (tipo === 'persona') datos.id_sugerido = id;
        const payload = { tipo, datos, foto, autor, consentimiento: true, sitio_web: fd.get('sitio_web'), turnstile: fd.get('cf-turnstile-response') || '' };
        const miniatura = foto ? await miniaturizar(foto) : '';
        const btn = $('button[type=submit]', form); btn.disabled = true; btn.textContent = t('aportar.enviando');
        try {
          const r = await Aportes.procesar(payload, { tipo, id, datos, autor, miniatura });
          exito(!!r.guardado);
        } catch (ex) {
          err.textContent = `${t('aportar.error')}: ${ex.message}`; err.hidden = false;
          btn.disabled = false; btn.textContent = t('aportar.enviar');
        }
      };
    };
    const exito = (guardado) => {
      el.innerHTML = `<section class="seccion"><div class="contenedor" style="max-width:640px;text-align:center">
        <div style="font-size:3rem">${guardado ? '💾' : '🌿'}</div><h1>${guardado ? t('aportar.guardado.t') : t('aportar.ok.t')}</h1>
        <p style="font-size:1.1rem">${guardado ? t('aportar.guardado.p') : t('aportar.ok.p')}</p>
        <p style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:24px">
          <a class="btn terra" href="#/aportar">${t('aportar.otro')}</a>
          <a class="btn sec" href="#/arbol/hoy">${t('arbol.tab.hoy')}</a>
          ${guardado ? `<button class="btn sec" id="desc-todo">⤓ ${t('aportar.descargar')}</button>` : ''}</p></div></section>`;
      const d = el.querySelector('#desc-todo'); if (d) d.onclick = () => Aportes.descargarSinEnviar();
      window.scrollTo({ top: 0 });
    };
    pintar();
  };
  async function miniaturizar(dataUrl) {
    const b = await (await fetch(dataUrl)).blob();
    return Aportes.reducir(b, 360, .75);
  }

  /* =========================================================
     ÁLBUM
     ========================================================= */
  window.PaginaAlbum = async function (el, [filtroIni]) {
    const { $, $$, esc, t } = { ...App, t: App.t };
    const [ap, personas] = await Promise.all([App.aportes(), Aportes.personas()]);
    const nombre = id => personas.find(p => p.id === id)?.nombre || id;
    const pend = App.pendientes().filter(p => p.tipo === 'foto' && !ap.fotos.some(f => f.id === p.id))
      .map(p => ({ id: p.id, titulo: p.datos.titulo, descripcion: p.datos.descripcion, anio: p.datos.anio, lugar: p.datos.lugar, personas: p.datos.personas, archivo: p.miniatura, _pend: true, aportado_por: p.autor }));
    const fotos = [...ap.fotos.slice().reverse(), ...pend];
    const enFotos = [...new Set(fotos.flatMap(f => f.personas || []))];
    let filtro = filtroIni || '';
    const libro = ['portada', 'mama-martina', 'adios-de-mis-padres', 'jose-luis-campeon', 'vicunas-y-vascongados', 'empedrado-cachinas', 'cerro-rico', 'arco-villa-imperial', 'huida-a-egipto', 'san-jeronimo', 'san-mateo', 'mapa-tesoro-rocha', 'puente-del-diablo', 'el-adios', 'caminante'];
    const pintar = () => {
      const lista = fotos.filter(f => !filtro || (f.personas || []).includes(filtro));
      $('#fotos', el).innerHTML = lista.length ? lista.map(f => `
        <figure class="foto-album ${f._pend ? 'pend' : ''}">
          ${f.archivo ? `<img src="${esc(f.archivo)}" alt="${esc(f.titulo)}" loading="lazy" data-zoom>` : ''}
          <figcaption><b>${esc(f.titulo)}</b>${f.anio || f.lugar ? `<small>${esc([f.anio, f.lugar].filter(Boolean).join(' · '))}</small>` : ''}
            ${f.descripcion ? `<span>${esc(f.descripcion)}</span>` : ''}
            ${(f.personas || []).length ? `<span class="chips">${f.personas.map(p => `<a class="chip" href="#/arbol/${esc(p)}">${esc(nombre(p))}</a>`).join('')}</span>` : ''}
            <small class="muted">${f._pend ? '⏳ ' + t('gen.pendiente') : `${t('gen.aportado')} ${esc(f.aportado_por?.nombre || '')}`}</small></figcaption>
        </figure>`).join('') : `<div class="vacio"><p>${t('album.vacio')}</p><a class="btn terra" href="#/aportar/foto">+ ${t('aportar.foto')}</a></div>`;
      $$('.filtros button', el).forEach(b => b.setAttribute('aria-pressed', b.dataset.f === filtro));
    };
    el.innerHTML = `<section class="seccion"><div class="contenedor">
      <div class="seccion-cab"><span class="eyebrow">${t('album.eyebrow')}</span><h1>${t('album.t')}</h1><p>${t('album.p')}</p></div>
      <div class="arbol-barra"><a class="btn terra" href="#/aportar/foto">+ ${t('aportar.foto')}</a></div>
      <h2 style="font-size:1.6rem;margin-top:20px">${t('album.familia')}</h2>
      ${enFotos.length ? `<div class="filtros"><button data-f="">${t('album.todos')}</button>${enFotos.map(id => `<button data-f="${esc(id)}">${esc(nombre(id))}</button>`).join('')}</div>` : ''}
      <div class="album" id="fotos"></div>
      <h2 style="font-size:1.6rem;margin-top:48px">${t('album.libro')}</h2>
      <div class="album libro">${libro.map(n => `<figure class="foto-album"><img src="img/libro/${n}.jpg" alt="" loading="lazy" data-zoom></figure>`).join('')}</div>
    </div></section>`;
    $$('.filtros button', el).forEach(b => b.onclick = () => { filtro = b.dataset.f; pintar(); });
    pintar();
  };

  /* =========================================================
     PRIVACIDAD Y AVISO LEGAL
     ========================================================= */
  const PRIV = {
    es: c => `
      <h1>Privacidad y aviso legal</h1>
      <p class="muted">Última actualización: septiembre de 2026</p>
      <h2>Quiénes somos</h2>
      <p>Este es un sitio familiar, sin fines comerciales, dedicado al libro <i>Relatos, historias y ensueños de Mama Martina y Antonito</i> de Freddy Córdova Ossio y a la memoria de su familia. Lo administra su familia.${c ? ` Contacto: <b>${c}</b>.` : ''}</p>
      <h2>Cookies</h2>
      <p><b>Este sitio no usa cookies, ni publicidad, ni herramientas de analítica o seguimiento.</b> Por eso no ves un aviso de cookies.</p>
      <p>Tu navegador guarda algunas preferencias en su almacenamiento local, solo para que el sitio funcione como lo dejaste: idioma, tema claro/oscuro, tamaño de letra, último capítulo leído, si aceptaste cargar el mapa, tu nombre en el formulario y tus aportes pendientes. Esa información no sale de tu dispositivo y puedes borrarla cuando quieras desde la configuración de tu navegador.</p>
      <h2>Servicios de terceros</h2>
      <ul>
        <li><b>GitHub Pages</b> (GitHub, Inc.) aloja el sitio. Como cualquier servidor web, puede registrar tu dirección IP por motivos de seguridad.</li>
        <li><b>OpenStreetMap</b>: el mapa solo se carga si pulsas «Cargar mapa». Entonces tu navegador pide las imágenes del mapa a sus servidores.</li>
        <li><b>Cloudflare</b>: cuando envías un aporte, pasa por un servicio de Cloudflare que lo entrega a GitHub${CFG.turnstileSiteKey ? '; el formulario usa Cloudflare Turnstile para frenar el spam' : ''}.</li>
      </ul>
      <p>Las fuentes tipográficas y el código del mapa se sirven desde este mismo sitio: no usamos Google Fonts ni otras redes externas.</p>
      <h2>Aportes de la familia</h2>
      <ul>
        <li>Lo que envías (tu nombre, tu relación con la familia, el texto y las fotos) se revisa antes de publicarse. <b>Una vez aprobado es público en internet</b> y queda en el historial del repositorio del sitio.</li>
        <li>Solo publicamos información de personas con su consentimiento. Si es menor de edad, con el de sus padres o tutores.</li>
        <li>De las personas vivas mostramos como máximo el año de nacimiento. Nunca publicamos direcciones, teléfonos ni documentos.</li>
        <li>Cualquier persona puede pedir que se corrija o se retire información sobre ella o sobre un familiar${c ? ` escribiendo a <b>${c}</b>` : ''}. Lo haremos lo antes posible.</li>
      </ul>
      <h2>Derechos de autor</h2>
      <ul>
        <li>Texto e ilustraciones del libro: © Freddy Córdova Ossio. Se permite leerlo y compartir el enlace; no se permite su reproducción comercial sin autorización.</li>
        <li>Ediciones en neerlandés e inglés: preparadas por la familia.</li>
        <li>Las canciones citadas en el libro pertenecen a sus autores.</li>
        <li>Las fotos aportadas pertenecen a quienes las aportan, que autorizan su publicación en este sitio.</li>
        <li>Datos del mapa: © colaboradores de OpenStreetMap.</li>
      </ul>`,
    nl: c => `
      <h1>Privacy en colofon</h1>
      <p class="muted">Laatst bijgewerkt: september 2026</p>
      <h2>Wie we zijn</h2>
      <p>Dit is een niet-commerciële familiesite over het boek <i>Relatos, historias y ensueños de Mama Martina y Antonito</i> van Freddy Córdova Ossio en over de herinnering aan zijn familie. De site wordt beheerd door zijn familie.${c ? ` Contact: <b>${c}</b>.` : ''}</p>
      <h2>Cookies</h2>
      <p><b>Deze site gebruikt geen cookies, geen advertenties en geen analyse- of volgsoftware.</b> Daarom zie je geen cookiemelding.</p>
      <p>Je browser bewaart enkele voorkeuren in de lokale opslag, zodat de site werkt zoals je hem achterliet: taal, licht/donker thema, lettergrootte, laatst gelezen hoofdstuk, of je de kaart hebt toegestaan, je naam in het formulier en je openstaande bijdragen. Deze gegevens verlaten je apparaat niet en je kunt ze altijd wissen via je browserinstellingen.</p>
      <h2>Diensten van derden</h2>
      <ul>
        <li><b>GitHub Pages</b> (GitHub, Inc.) host de site en kan, zoals elke webserver, je IP-adres registreren voor beveiliging.</li>
        <li><b>OpenStreetMap</b>: de kaart wordt pas geladen als je op „Kaart laden” klikt; dan haalt je browser de kaartafbeeldingen op van hun servers.</li>
        <li><b>Cloudflare</b>: een bijdrage loopt via een Cloudflare-dienst die haar aan GitHub doorgeeft${CFG.turnstileSiteKey ? '; het formulier gebruikt Cloudflare Turnstile tegen spam' : ''}.</li>
      </ul>
      <p>Lettertypen en de kaartcode worden vanaf deze site zelf geleverd: we gebruiken geen Google Fonts of andere externe netwerken.</p>
      <h2>Bijdragen van de familie</h2>
      <ul>
        <li>Wat je instuurt (naam, band met de familie, tekst en foto's) wordt eerst beoordeeld. <b>Na goedkeuring is het openbaar op internet</b> en blijft het in de geschiedenis van de repository.</li>
        <li>We publiceren alleen gegevens van personen met hun toestemming, bij minderjarigen met die van ouders of voogden.</li>
        <li>Van levende personen tonen we hooguit het geboortejaar; nooit adressen, telefoonnummers of documenten.</li>
        <li>Iedereen kan vragen om gegevens over zichzelf of een familielid te corrigeren of te verwijderen${c ? ` via <b>${c}</b>` : ''}. We doen dat zo snel mogelijk.</li>
      </ul>
      <h2>Auteursrecht</h2>
      <ul>
        <li>Tekst en illustraties van het boek: © Freddy Córdova Ossio. Lezen en de link delen mag; commerciële reproductie zonder toestemming niet.</li>
        <li>Nederlandse en Engelse edities: verzorgd door de familie.</li>
        <li>De in het boek geciteerde liederen behoren toe aan hun auteurs.</li>
        <li>Bijgedragen foto's zijn van wie ze instuurt; die geeft toestemming voor publicatie op deze site.</li>
        <li>Kaartgegevens: © OpenStreetMap-bijdragers.</li>
      </ul>`,
    en: c => `
      <h1>Privacy &amp; legal notice</h1>
      <p class="muted">Last updated: September 2026</p>
      <h2>Who we are</h2>
      <p>This is a non-commercial family website about the book <i>Relatos, historias y ensueños de Mama Martina y Antonito</i> by Freddy Córdova Ossio and the memory of his family. It is run by his family.${c ? ` Contact: <b>${c}</b>.` : ''}</p>
      <h2>Cookies</h2>
      <p><b>This site uses no cookies, no advertising and no analytics or tracking tools.</b> That is why you see no cookie banner.</p>
      <p>Your browser keeps a few preferences in local storage so the site works the way you left it: language, light/dark theme, text size, last chapter read, whether you allowed the map, your name in the form and your pending contributions. This never leaves your device and you can clear it at any time in your browser settings.</p>
      <h2>Third-party services</h2>
      <ul>
        <li><b>GitHub Pages</b> (GitHub, Inc.) hosts the site and, like any web server, may log your IP address for security.</li>
        <li><b>OpenStreetMap</b>: the map only loads if you click “Load map”; your browser then requests map images from their servers.</li>
        <li><b>Cloudflare</b>: a contribution passes through a Cloudflare service that delivers it to GitHub${CFG.turnstileSiteKey ? '; the form uses Cloudflare Turnstile against spam' : ''}.</li>
      </ul>
      <p>Fonts and the map code are served from this site itself: we use no Google Fonts or other external networks.</p>
      <h2>Family contributions</h2>
      <ul>
        <li>What you send (your name, your relationship to the family, text and photos) is reviewed before publication. <b>Once approved it is public on the internet</b> and remains in the site repository's history.</li>
        <li>We only publish information about people with their consent — for minors, with their parents' or guardians' consent.</li>
        <li>For living people we show at most the birth year; never addresses, phone numbers or documents.</li>
        <li>Anyone may ask for information about themselves or a relative to be corrected or removed${c ? ` by writing to <b>${c}</b>` : ''}. We will do so as soon as possible.</li>
      </ul>
      <h2>Copyright</h2>
      <ul>
        <li>Book text and illustrations: © Freddy Córdova Ossio. You may read it and share the link; commercial reproduction without permission is not allowed.</li>
        <li>Dutch and English editions: prepared by the family.</li>
        <li>Songs quoted in the book belong to their authors.</li>
        <li>Contributed photos belong to their contributors, who authorise their publication on this site.</li>
        <li>Map data: © OpenStreetMap contributors.</li>
      </ul>`
  };
  window.PaginaPrivacidad = function (el) {
    const c = App.esc(CFG.contacto || '');
    el.innerHTML = `<section class="seccion"><div class="contenedor legal">${(PRIV[App.lang] || PRIV.es)(c)}</div></section>`;
  };
})();
