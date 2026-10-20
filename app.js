/* App: Evaluación de simulacro de evacuación (PWA offline) */
'use strict';
(function () {
  const S = window.SIM;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;

  /* ================= Almacenamiento (IndexedDB) ================= */
  const DB = (() => {
    let p;
    const open = () => p || (p = new Promise((res, rej) => {
      const r = indexedDB.open('simulacros', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('evaluaciones', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const tx = async (mode, fn) => {
      const db = await open();
      return new Promise((res, rej) => {
        const t = db.transaction('evaluaciones', mode);
        const req = fn(t.objectStore('evaluaciones'));
        t.oncomplete = () => res(req ? req.result : undefined);
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error || new Error('Transacción cancelada'));
      });
    };
    return {
      all: () => tx('readonly', (s) => s.getAll()),
      get: (id) => tx('readonly', (s) => s.get(id)),
      put: (o) => tx('readwrite', (s) => s.put(o)),
      del: (id) => tx('readwrite', (s) => s.delete(id))
    };
  })();

  /* ================= Configuración ================= */
  const SET_KEY = 'simulacro.settings';
  const SET_DEF = { empresa: 'Codere Colombia', logo: '', evaluador: '', cargo: '' };
  function getSettings() {
    try { return Object.assign({}, SET_DEF, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); }
    catch (e) { return Object.assign({}, SET_DEF); }
  }
  function saveSettings(s) {
    try { localStorage.setItem(SET_KEY, JSON.stringify(s)); return true; }
    catch (e) { toast('No se pudo guardar la configuración (el logo es muy pesado).'); return false; }
  }

  /* ================= Modelo ================= */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function nuevaEval() {
    const st = getSettings();
    return {
      id: uid(), version: 1, createdAt: Date.now(), updatedAt: Date.now(),
      tipoEmergencia: 'Sismo con evacuación',
      ficha: { ciudadSede: '', sala: '', fecha: S.hoy(), horaProgramada: '', evaluador: st.evaluador, cargo: st.cargo, empleados: '', clientes: '', visitantes: '' },
      tiempos: Object.fromEntries(S.HITOS.map((h) => [h.k, { hora: '', obs: '', ts: null }])),
      checklist: S.CHECKLIST.map((t, i) => ({ id: i + 1, texto: t, resp: '', obs: '' })),
      fotos: [],
      observaciones: '',
      acciones: [{ accion: '', estado: 'Pendiente' }],
      firmas: S.FIRMAS.map((r) => ({ rol: r, nombre: '', firma: '', fecha: null, fija: true })),
      suspension: null
    };
  }

  /* Completa campos faltantes (respaldos antiguos o editados a mano) */
  function normalizar(src) {
    const b = nuevaEval();
    const e = Object.assign({}, b, src || {});
    e.id = src && src.id ? String(src.id) : b.id;
    e.ficha = Object.assign({}, b.ficha, (src && src.ficha) || {});
    e.tiempos = Object.assign({}, b.tiempos);
    S.HITOS.forEach((h) => { e.tiempos[h.k] = Object.assign({ hora: '', obs: '', ts: null }, (src && src.tiempos && src.tiempos[h.k]) || {}); });
    const cl = (src && Array.isArray(src.checklist)) ? src.checklist : [];
    e.checklist = cl.length ? cl.map((c, i) => Object.assign({ id: i + 1, texto: '', resp: '', obs: '' }, c)) : b.checklist;
    e.fotos = Array.isArray(e.fotos) ? e.fotos.filter((f) => f && f.dataUrl) : [];
    e.acciones = Array.isArray(e.acciones) && e.acciones.length ? e.acciones : b.acciones;
    e.firmas = Array.isArray(e.firmas) && e.firmas.length ? e.firmas : b.firmas;
    return e;
  }

  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

  /* ================= Estado / guardado ================= */
  let cur = null;
  let saveTimer = null;
  let pending = false;

  function setSaveState(t) { $('#saveState').textContent = t; }

  function touch() {
    if (!cur) return;
    cur.updatedAt = Date.now();
    pending = true;
    setSaveState('Guardando…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 400);
    refresh();
  }

  async function flush() {
    clearTimeout(saveTimer);
    if (!cur || !pending) return;
    pending = false;
    try { await DB.put(cur); setSaveState('Guardado ✓'); }
    catch (e) { pending = true; setSaveState('Sin guardar'); toast('Error al guardar en el dispositivo: ' + e.message); }
  }

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  /* ================= Utilidades UI ================= */
  let toastT;
  function toast(msg, ms = 2600) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), ms);
  }

  function openModal(id) { $(id).hidden = false; document.body.style.overflow = 'hidden'; }
  function closeModal(id) { $(id).hidden = true; if ($$('.modal:not([hidden])').length === 0) document.body.style.overflow = ''; }
  $$('.modal').forEach((m) => {
    m.addEventListener('click', (ev) => {
      if (ev.target === m && m.id !== 'sigModal') closeModal('#' + m.id);
      if (ev.target.closest('[data-close]')) closeModal('#' + m.id);
    });
  });

  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('No se pudo leer la imagen'));
      img.src = src;
    });
  }

  /* Reduce la foto (máx. 1600 px, JPEG 80 %) para que el PDF sea liviano */
  async function comprimir(file, maxSide = 1600, q = 0.8) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const r = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * r), h = Math.round(img.naturalHeight * r);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return { dataUrl: c.toDataURL('image/jpeg', q), w, h };
    } finally { URL.revokeObjectURL(url); }
  }

  function descargar(blob, nombre) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

  /* ================= Inicio ================= */
  function progreso(e) {
    const f = e.ficha;
    const items = [f.ciudadSede, f.sala, f.fecha, f.evaluador, f.cargo, f.empleados !== '' ? 1 : '', f.horaProgramada]
      .concat(S.HITOS.map((h) => e.tiempos[h.k].hora))
      .concat(e.checklist.map((c) => c.resp))
      .concat([e.fotos.length ? 1 : '', e.observaciones])
      .concat(e.firmas.map((x) => x.firma));
    return Math.round(items.filter(Boolean).length / items.length * 100);
  }

  async function showHome() {
    await flush();
    cur = null;
    stopTicker();
    releaseWake();
    $('#viewForm').hidden = true;
    $('#viewHome').hidden = false;
    $('#btnBack').hidden = true;
    $('#appTitle').textContent = 'Evaluación de simulacro';
    $('#appSub').textContent = getSettings().empresa || 'Simulacros de evacuación';
    setSaveState('');
    let lista = [];
    try { lista = await DB.all(); } catch (e) { toast('No se pudo leer el almacenamiento: ' + e.message); }
    lista.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const cont = $('#evalList');
    if (!lista.length) {
      cont.innerHTML = '<div class="empty">Aún no hay evaluaciones en este dispositivo.<br>Toque <b>Nueva evaluación</b> para empezar.</div>';
      return;
    }
    cont.innerHTML = lista.map((e) => {
      const n = normalizar(e);
      const p = progreso(n);
      const titulo = [n.ficha.ciudadSede, n.ficha.sala].filter(Boolean).join(' · ') || 'Sin sede';
      return `<div class="eval-item" data-id="${esc(n.id)}">
        <div class="info" data-open>
          <strong>${esc(titulo)}</strong>
          <small>${esc(S.fmtFecha(n.ficha.fecha))} · ${esc(n.tipoEmergencia || '')}</small>
          <small>${n.fotos.length} foto(s) · ${p}% diligenciado</small>
          <div class="progress"><span style="width:${p}%"></span></div>
        </div>
        <button class="mini-del" data-del aria-label="Eliminar">${icon('i-trash')}</button>
      </div>`;
    }).join('');
  }

  $('#evalList').addEventListener('click', async (ev) => {
    const item = ev.target.closest('.eval-item');
    if (!item) return;
    const id = item.dataset.id;
    if (ev.target.closest('[data-open]')) { location.hash = '#/eval/' + encodeURIComponent(id); return; }
    if (ev.target.closest('[data-del]')) {
      if (!confirm('¿Eliminar esta evaluación del dispositivo? Si no tiene respaldo JSON, no se podrá recuperar.')) return;
      await DB.del(id);
      toast('Evaluación eliminada');
      showHome();
    }
  });

  $('#btnNew').addEventListener('click', async () => {
    const e = nuevaEval();
    await DB.put(e);
    location.hash = '#/eval/' + e.id;
  });

  /* Importar respaldo JSON */
  $('#fileImport').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const txt = await file.text();
      const obj = JSON.parse(txt);
      const data = obj && obj.data ? obj.data : obj;
      if (!data || !data.ficha || !data.tiempos) throw new Error('El archivo no es un respaldo de evaluación de simulacro.');
      const e = normalizar(data);
      const existe = await DB.get(e.id);
      if (existe && !confirm('Esta evaluación ya existe en el dispositivo.\n\nAceptar: reemplazarla con el respaldo.\nCancelar: importarla como una copia nueva.')) {
        e.id = uid();
      }
      e.updatedAt = Date.now();
      await DB.put(e);
      toast('Respaldo importado');
      location.hash = '#/eval/' + e.id;
    } catch (err) {
      toast('No se pudo importar: ' + err.message, 4000);
    }
  });

  /* ================= Formulario ================= */
  function openEval(e) {
    cur = normalizar(e);
    $('#viewHome').hidden = true;
    $('#viewForm').hidden = false;
    $('#btnBack').hidden = false;
    setSaveState('Guardado ✓');
    $$('[data-path]').forEach((el) => { const v = getPath(cur, el.dataset.path); el.value = v == null ? '' : v; });
    renderTiempos();
    renderChecklist();
    renderFotos();
    renderAcciones();
    renderFirmas();
    refresh();
    startTicker();
    window.scrollTo(0, 0);
  }

  $$('[data-path]').forEach((el) => {
    el.addEventListener('input', () => {
      if (!cur) return;
      setPath(cur, el.dataset.path, el.value);
      touch();
    });
  });

  /* Recuerda evaluador y cargo para próximas evaluaciones */
  ['#fEval', '#fCargo'].forEach((sel) => {
    $(sel).addEventListener('change', () => {
      const st = getSettings();
      st.evaluador = cur.ficha.evaluador; st.cargo = cur.ficha.cargo;
      saveSettings(st);
    });
  });

  function refresh() {
    if (!cur) return;
    const f = cur.ficha;
    const tp = S.totalPersonas(f);
    $('#totalPersonas').textContent = tp === '' ? '—' : tp;
    const titulo = [f.ciudadSede, f.sala].filter(Boolean).join(' · ');
    $('#appTitle').textContent = titulo || 'Nueva evaluación';
    $('#appSub').textContent = [S.fmtFecha(f.fecha), cur.tipoEmergencia].filter(Boolean).join(' · ');

    // tiempos
    S.HITOS.forEach((h) => {
      const card = $(`.hito[data-k="${h.k}"]`);
      if (!card) return;
      const d = S.delta(cur, h.k);
      $('.delta', card).innerHTML = d == null ? '—' : `${S.mmss(d)}<small>${h.k === 'T5' ? 'desde T4' : 'desde T0'}</small>`;
      card.classList.toggle('marked', !!cur.tiempos[h.k].hora);
    });
    const tot = S.totalEvacuacion(cur);
    $('#totalEvac').textContent = tot == null ? '—' : S.minSeg(tot);
    updateCrono();

    // checklist
    const si = cur.checklist.filter((c) => c.resp === 'SI').length;
    const no = cur.checklist.filter((c) => c.resp === 'NO').length;
    const pend = cur.checklist.length - si - no;
    $('#checkSummary').innerHTML = `Cumplimiento <strong>${si + no ? Math.round(si / (si + no) * 100) + ' %' : '—'}</strong>`;
    $('#checkSummary').title = `${si} SÍ · ${no} NO · ${pend} sin responder`;

    // suspensión
    const sb = $('#suspensionBox');
    if (cur.suspension) {
      sb.hidden = false;
      sb.innerHTML = `<span>Ejercicio suspendido por emergencia real a las ${esc(cur.suspension.hora)}</span><button type="button" id="btnUnsuspend">Anular</button>`;
    } else sb.hidden = true;

    // pasos completos
    const done = {
      1: f.ciudadSede && f.sala && f.fecha && f.evaluador,
      2: S.HITOS.every((h) => cur.tiempos[h.k].hora),
      3: pend === 0,
      4: cur.fotos.length > 0,
      5: !!cur.observaciones.trim(),
      6: cur.acciones.some((a) => a.accion.trim()),
      7: cur.firmas.every((x) => x.firma && x.nombre)
    };
    $$('#steps a').forEach((a) => a.classList.toggle('done', !!done[a.dataset.s]));
  }

  /* ---------- Tiempos ---------- */
  function renderTiempos() {
    $('#tiempos').innerHTML = S.HITOS.map((h) => {
      const t = cur.tiempos[h.k];
      return `<div class="hito" data-k="${h.k}">
        <div class="hito-head"><span class="tbadge">${h.k}</span><div><b>${esc(h.nombre)}</b><small>${esc(h.mide)}</small></div></div>
        <div class="hito-row">
          <input type="time" step="1" class="hora" value="${esc(t.hora)}" aria-label="Hora reloj ${h.k}">
          <button type="button" class="btn ghost sm marcar">Ahora</button>
          <output class="delta">—</output>
        </div>
        <input class="obs" value="${esc(t.obs)}" placeholder="Observaciones" aria-label="Observaciones ${h.k}">
      </div>`;
    }).join('');
  }

  $('#tiempos').addEventListener('input', (ev) => {
    const card = ev.target.closest('.hito'); if (!card) return;
    const t = cur.tiempos[card.dataset.k];
    if (ev.target.classList.contains('hora')) { t.hora = S.normHora(ev.target.value); t.ts = null; }
    if (ev.target.classList.contains('obs')) t.obs = ev.target.value;
    touch();
  });
  $('#tiempos').addEventListener('click', (ev) => {
    if (!ev.target.closest('.marcar')) return;
    const card = ev.target.closest('.hito');
    const k = card.dataset.k;
    if (cur.tiempos[k].hora && !confirm(`${k} ya tiene hora (${cur.tiempos[k].hora}). ¿Reemplazarla por la hora actual?`)) return;
    marcar(k);
  });

  function marcar(k) {
    const d = new Date();
    cur.tiempos[k].hora = S.horaAhora(d);
    cur.tiempos[k].ts = d.getTime();
    const inp = $(`.hito[data-k="${k}"] .hora`);
    if (inp) inp.value = cur.tiempos[k].hora;
    if (navigator.vibrate) navigator.vibrate(60);
    if (k === 'T0') requestWake();
    if (k === 'T5') releaseWake();
    touch();
    toast(`${k} registrado: ${cur.tiempos[k].hora}`);
  }

  const siguiente = () => S.HITOS.find((h) => !cur.tiempos[h.k].hora);

  function segundosDesdeT0() {
    const t0 = cur.tiempos.T0;
    if (t0.ts) return Math.max(0, Math.floor((Date.now() - t0.ts) / 1000));
    return S.diff(t0.hora, S.horaAhora());
  }

  const HINTS = {
    T0: 'El líder da la señal (sirena 30 s). Marque al iniciar.',
    T1: 'Marque cuando la población esté protegida (agáchese, cúbrase).',
    T2: 'Marque cuando suene la sirena continua de evacuación.',
    T3: 'Marque cuando la primera persona cruce la puerta exterior.',
    T4: 'Marque cuando salga la última persona de la sala.',
    T5: 'Marque al terminar el conteo en el punto de encuentro.'
  };

  function updateCrono() {
    if (!cur) return;
    const nx = siguiente();
    const btn = $('#cronoNext');
    const T = cur.tiempos;
    if (!T.T0.hora) {
      $('#cronoLabel').textContent = 'Cronómetro';
      $('#cronoDisplay').textContent = '00:00';
    } else if (!nx) {
      $('#cronoLabel').textContent = 'Tiempo total de evacuación (T4 − T0)';
      $('#cronoDisplay').textContent = S.mmss(S.totalEvacuacion(cur));
    } else {
      $('#cronoLabel').textContent = 'Tiempo desde T0';
      $('#cronoDisplay').textContent = S.mmss(segundosDesdeT0());
    }
    if (nx) {
      btn.disabled = false;
      $('#cronoNextTxt').textContent = `Marcar ${nx.k} · ${nx.nombre}`;
      $('#cronoHint').textContent = HINTS[nx.k];
    } else {
      btn.disabled = true;
      $('#cronoNextTxt').textContent = 'Cronometría completa';
      $('#cronoHint').textContent = 'Complete fotos, observaciones y firmas.';
    }
    $('#cronoUndo').disabled = !S.HITOS.some((h) => T[h.k].hora);
    $$('.hito').forEach((c) => c.classList.toggle('next', !!nx && c.dataset.k === nx.k));
  }

  $('#cronoNext').addEventListener('click', () => { const nx = siguiente(); if (nx) marcar(nx.k); });
  $('#cronoUndo').addEventListener('click', () => {
    const marcados = S.HITOS.filter((h) => cur.tiempos[h.k].hora);
    const last = marcados[marcados.length - 1];
    if (!last || !confirm(`¿Borrar la marca de ${last.k} (${cur.tiempos[last.k].hora})?`)) return;
    cur.tiempos[last.k].hora = ''; cur.tiempos[last.k].ts = null;
    $(`.hito[data-k="${last.k}"] .hora`).value = '';
    touch();
  });
  $('#btnSuspend').addEventListener('click', () => {
    if (cur.suspension) { toast('El ejercicio ya está marcado como suspendido.'); return; }
    if (!confirm('¿Suspender el ejercicio por emergencia real (lesión o evento real)?\n\nSe registrará la hora en observaciones.')) return;
    const h = S.horaAhora();
    cur.suspension = { hora: h, ts: Date.now() };
    const nota = `[${h}] Ejercicio suspendido por emergencia real.`;
    cur.observaciones = cur.observaciones ? cur.observaciones + '\n' + nota : nota;
    $('#fObs').value = cur.observaciones;
    releaseWake();
    touch();
  });
  $('#suspensionBox').addEventListener('click', (ev) => {
    if (!ev.target.closest('#btnUnsuspend')) return;
    if (!confirm('¿Anular la marca de suspensión? (La nota en observaciones se conserva).')) return;
    cur.suspension = null;
    touch();
  });

  let ticker = null;
  function startTicker() { stopTicker(); ticker = setInterval(() => { if (cur && cur.tiempos.T0.hora && siguiente()) updateCrono(); }, 250); }
  function stopTicker() { if (ticker) clearInterval(ticker); ticker = null; }

  /* Mantiene la pantalla encendida durante la cronometría */
  let wake = null;
  async function requestWake() {
    try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { /* no soportado */ }
  }
  function releaseWake() { try { if (wake) wake.release(); } catch (e) { /* */ } wake = null; }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && cur && cur.tiempos.T0.hora && siguiente() && !cur.suspension) requestWake();
  });

  /* ---------- Lista de chequeo ---------- */
  function renderChecklist() {
    $('#checklist').innerHTML = cur.checklist.map((c, i) => `
      <div class="chk ${c.resp === 'SI' ? 'si' : c.resp === 'NO' ? 'no' : ''}" data-i="${i}">
        <p>${i + 1}. ${esc(c.texto)}</p>
        <div class="chk-row">
          <button type="button" class="seg s-si" data-r="SI" aria-pressed="${c.resp === 'SI'}">SÍ</button>
          <button type="button" class="seg s-no" data-r="NO" aria-pressed="${c.resp === 'NO'}">NO</button>
          <input class="obs" value="${esc(c.obs)}" placeholder="Observación" aria-label="Observación ítem ${i + 1}">
        </div>
      </div>`).join('');
  }
  $('#checklist').addEventListener('click', (ev) => {
    const b = ev.target.closest('.seg'); if (!b) return;
    const box = b.closest('.chk');
    const c = cur.checklist[box.dataset.i];
    c.resp = c.resp === b.dataset.r ? '' : b.dataset.r;
    $$('.seg', box).forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.r === c.resp)));
    box.classList.toggle('si', c.resp === 'SI');
    box.classList.toggle('no', c.resp === 'NO');
    touch();
  });
  $('#checklist').addEventListener('input', (ev) => {
    if (!ev.target.classList.contains('obs')) return;
    cur.checklist[ev.target.closest('.chk').dataset.i].obs = ev.target.value;
    touch();
  });

  /* ---------- Fotos ---------- */
  function horaDe(ts) { if (!ts) return ''; const d = new Date(ts); return `${S.pad(d.getHours())}:${S.pad(d.getMinutes())}`; }

  function renderFotos() {
    const c = $('#fotos');
    if (!cur.fotos.length) { c.innerHTML = '<div class="empty">Sin fotos todavía.</div>'; return; }
    c.innerHTML = cur.fotos.map((f, i) => `
      <div class="photo" data-i="${i}">
        <div class="img"><img src="${f.dataUrl}" alt="Foto ${i + 1}" loading="lazy"><span class="tag">Foto ${i + 1}</span>
          <button type="button" class="del" aria-label="Eliminar foto ${i + 1}">${icon('i-trash')}</button></div>
        <div class="cap"><input class="leyenda" list="dlLeyendas" value="${esc(f.caption)}" placeholder="Descripción de la foto" aria-label="Descripción foto ${i + 1}">
          <div class="meta">${f.takenAt ? 'Tomada a las ' + horaDe(f.takenAt) : ''}</div></div>
      </div>`).join('');
  }

  async function agregarFotos(files) {
    if (!files || !files.length) return;
    $('#photoBusy').hidden = false;
    let ok = 0;
    for (const file of files) {
      try {
        const r = await comprimir(file);
        const sugerida = S.LEYENDAS_FOTO[cur.fotos.length] || '';
        cur.fotos.push({ id: uid(), dataUrl: r.dataUrl, w: r.w, h: r.h, caption: sugerida, takenAt: file.lastModified || Date.now() });
        ok++;
      } catch (e) { toast('Una foto no se pudo procesar: ' + e.message); }
    }
    $('#photoBusy').hidden = true;
    renderFotos();
    touch();
    if (ok) toast(`${ok} foto(s) agregada(s)`);
  }
  ['#fileCam', '#fileGal'].forEach((sel) => {
    $(sel).addEventListener('change', (ev) => { const fs = Array.from(ev.target.files || []); ev.target.value = ''; agregarFotos(fs); });
  });
  $('#fotos').addEventListener('input', (ev) => {
    if (!ev.target.classList.contains('leyenda')) return;
    cur.fotos[ev.target.closest('.photo').dataset.i].caption = ev.target.value;
    touch();
  });
  $('#fotos').addEventListener('click', (ev) => {
    if (!ev.target.closest('.del')) return;
    const i = Number(ev.target.closest('.photo').dataset.i);
    if (!confirm(`¿Eliminar la foto ${i + 1}?`)) return;
    cur.fotos.splice(i, 1);
    renderFotos();
    touch();
  });

  /* ---------- Acciones de mejora ---------- */
  function renderAcciones() {
    $('#acciones').innerHTML = cur.acciones.map((a, i) => `
      <div class="accion" data-i="${i}">
        <div class="accion-top"><b>Acción ${i + 1}</b></div>
        <textarea class="txt" rows="2" placeholder="Describa la acción de mejora" aria-label="Acción ${i + 1}">${esc(a.accion)}</textarea>
        <div class="accion-bottom">
          <select class="estado estado-${esc((a.estado || '').replace(' ', '-'))}" aria-label="Estado acción ${i + 1}">
            ${S.ESTADOS.map((e) => `<option ${e === a.estado ? 'selected' : ''}>${e}</option>`).join('')}
          </select>
          <button type="button" class="mini-del" aria-label="Eliminar acción ${i + 1}">${icon('i-trash')}</button>
        </div>
      </div>`).join('') || '<div class="empty">Sin acciones registradas.</div>';
  }
  $('#acciones').addEventListener('input', (ev) => {
    const box = ev.target.closest('.accion'); if (!box) return;
    const a = cur.acciones[box.dataset.i];
    if (ev.target.classList.contains('txt')) a.accion = ev.target.value;
    if (ev.target.classList.contains('estado')) { a.estado = ev.target.value; ev.target.className = 'estado estado-' + a.estado.replace(' ', '-'); }
    touch();
  });
  $('#acciones').addEventListener('click', (ev) => {
    if (!ev.target.closest('.mini-del')) return;
    const i = Number(ev.target.closest('.accion').dataset.i);
    if (cur.acciones[i].accion && !confirm(`¿Eliminar la acción ${i + 1}?`)) return;
    cur.acciones.splice(i, 1);
    renderAcciones();
    touch();
  });
  $('#btnAddAccion').addEventListener('click', () => {
    cur.acciones.push({ accion: '', estado: 'Pendiente' });
    renderAcciones();
    touch();
    const tas = $$('#acciones textarea'); tas[tas.length - 1].focus();
  });

  /* ---------- Firmas ---------- */
  function renderFirmas() {
    $('#firmas').innerHTML = cur.firmas.map((f, i) => `
      <div class="firma ${f.firma ? 'ok' : ''}" data-i="${i}">
        <div class="rol">${f.fija ? esc(f.rol) : `<input class="rolin" value="${esc(f.rol)}" placeholder="Rol del firmante (p. ej. Líder de brigada)" aria-label="Rol firmante ${i + 1}">`}
          ${f.fija ? '' : `<button type="button" class="mini-del" aria-label="Quitar firmante">${icon('i-trash')}</button>`}</div>
        <input class="nombre" value="${esc(f.nombre)}" placeholder="Nombre completo" aria-label="Nombre firmante ${i + 1}">
        <div class="sig-box" role="button" tabindex="0" aria-label="Firmar">${f.firma ? `<img src="${f.firma}" alt="Firma">` : `<span>${icon('i-pen')}Toque para firmar</span>`}</div>
        <div class="when">${f.fecha ? 'Firmado: ' + S.fmtFechaHora(f.fecha) : ''}</div>
      </div>`).join('');
  }
  $('#firmas').addEventListener('input', (ev) => {
    const box = ev.target.closest('.firma'); if (!box) return;
    const f = cur.firmas[box.dataset.i];
    if (ev.target.classList.contains('nombre')) f.nombre = ev.target.value;
    if (ev.target.classList.contains('rolin')) f.rol = ev.target.value;
    touch();
  });
  $('#firmas').addEventListener('click', (ev) => {
    const box = ev.target.closest('.firma'); if (!box) return;
    const i = Number(box.dataset.i);
    if (ev.target.closest('.mini-del')) {
      if (!confirm('¿Quitar este firmante?')) return;
      cur.firmas.splice(i, 1); renderFirmas(); touch(); return;
    }
    if (ev.target.closest('.sig-box')) abrirFirma(i);
  });
  $('#firmas').addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList.contains('sig-box')) { ev.preventDefault(); abrirFirma(Number(ev.target.closest('.firma').dataset.i)); }
  });
  $('#btnAddFirma').addEventListener('click', () => {
    cur.firmas.push({ rol: '', nombre: '', firma: '', fecha: null, fija: false });
    renderFirmas(); touch();
    const r = $$('#firmas .rolin'); r[r.length - 1].focus();
  });

  /* ---------- Panel de firma ---------- */
  const Pad = (() => {
    const cv = $('#sigCanvas');
    const ctx = cv.getContext('2d');
    let drawing = false, pts = [], strokes = 0, dpr = 1;

    function size() {
      const r = cv.getBoundingClientRect();
      dpr = Math.max(1, window.devicePixelRatio || 1);
      const prev = strokes ? cv.toDataURL() : null;
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111827';
      if (prev) loadImage(prev).then((img) => ctx.drawImage(img, 0, 0, r.width, r.height));
    }
    function pos(ev) { const r = cv.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top, p: ev.pressure || 0.5 }; }
    function width(p) { return 1.6 + Math.min(1, Math.max(0, p)) * 2.2; }

    cv.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      cv.setPointerCapture(ev.pointerId);
      drawing = true; pts = [pos(ev)];
      const p = pts[0];
      ctx.beginPath(); ctx.fillStyle = '#111827'; ctx.arc(p.x, p.y, width(p.p) / 2, 0, Math.PI * 2); ctx.fill();
      strokes++; $('#sigPh').hidden = true;
    });
    cv.addEventListener('pointermove', (ev) => {
      if (!drawing) return;
      ev.preventDefault();
      const events = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
      for (const e of events) {
        pts.push(pos(e));
        if (pts.length < 3) continue;
        const [a, b, c] = pts.slice(-3);
        const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
        ctx.beginPath(); ctx.lineWidth = width(b.p);
        ctx.moveTo(m1.x, m1.y); ctx.quadraticCurveTo(b.x, b.y, m2.x, m2.y); ctx.stroke();
      }
    });
    const end = () => { drawing = false; pts = []; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', end);

    function clear() { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore(); strokes = 0; $('#sigPh').hidden = false; }

    /* Recorta el área firmada y la exporta en PNG transparente */
    function exportar() {
      if (!strokes) return '';
      const w = cv.width, h = cv.height;
      const data = ctx.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
        if (data[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) return '';
      const padPx = Math.round(12 * dpr);
      x0 = Math.max(0, x0 - padPx); y0 = Math.max(0, y0 - padPx); x1 = Math.min(w, x1 + padPx); y1 = Math.min(h, y1 + padPx);
      const cw = x1 - x0, ch = y1 - y0;
      const scale = Math.min(1, 900 / cw);
      const out = document.createElement('canvas');
      out.width = Math.round(cw * scale); out.height = Math.round(ch * scale);
      out.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    }
    return { size, clear, exportar, has: () => strokes > 0 };
  })();

  let firmaIdx = -1;
  function abrirFirma(i) {
    firmaIdx = i;
    const f = cur.firmas[i];
    $('#sigTitle').textContent = f.rol || 'Firma';
    $('#sigSub').textContent = f.nombre || 'Escriba el nombre en el formulario';
    openModal('#sigModal');
    Pad.clear();
    requestAnimationFrame(() => Pad.size());
  }
  window.addEventListener('resize', () => { if (!$('#sigModal').hidden) Pad.size(); });
  $('#sigClear').addEventListener('click', () => Pad.clear());
  $('#sigCancel').addEventListener('click', () => closeModal('#sigModal'));
  $('#sigSave').addEventListener('click', () => {
    if (!Pad.has()) { toast('Firme dentro del recuadro.'); return; }
    const f = cur.firmas[firmaIdx];
    f.firma = Pad.exportar();
    f.fecha = Date.now();
    closeModal('#sigModal');
    renderFirmas();
    touch();
    toast('Firma guardada');
  });

  /* ================= Exportar y enviar ================= */
  let out = null;

  function faltantes(e) {
    const f = e.ficha, r = [];
    if (!f.ciudadSede) r.push('Ciudad / Sede');
    if (!f.sala) r.push('Sala / Área evaluada');
    if (!f.fecha) r.push('Fecha del simulacro');
    if (!f.evaluador) r.push('Evaluador / Observador');
    if (!e.tiempos.T0.hora) r.push('Hora T0 (inicio)');
    if (!e.tiempos.T4.hora) r.push('Hora T4 (evacuación total)');
    const sin = e.checklist.filter((c) => !c.resp).length;
    if (sin) r.push(`${sin} aspecto(s) de la lista de chequeo sin responder`);
    if (!e.fotos.length) r.push('Registro fotográfico');
    e.firmas.forEach((x) => { if (!x.firma) r.push(`Firma: ${x.rol || 'firmante'}`); else if (!x.nombre) r.push(`Nombre: ${x.rol || 'firmante'}`); });
    return r;
  }

  function respaldo(e) {
    return JSON.stringify({ app: 'evaluacion-simulacro', formato: 'Evaluación de simulacro de evacuación', version: 1, exportado: new Date().toISOString(), data: e }, null, 2);
  }

  function textoEnvio(e) {
    const f = e.ficha;
    const tot = S.totalEvacuacion(e);
    return [
      `Evaluación de simulacro – ${e.tipoEmergencia || ''}`,
      `Sede: ${[f.ciudadSede, f.sala].filter(Boolean).join(' · ')}`,
      `Fecha: ${S.fmtFecha(f.fecha)}`,
      tot != null ? `Tiempo total de evacuación (T4−T0): ${S.minSeg(tot).replace('  ', ' ')}` : '',
      S.totalPersonas(f) !== '' ? `Personas evacuadas: ${S.totalPersonas(f)}` : ''
    ].filter(Boolean).join('\n');
  }

  const puedeCompartir = (files) => { try { return !!(navigator.canShare && navigator.canShare({ files })); } catch (e) { return false; } };

  async function abrirExportar() {
    await flush();
    out = null;
    openModal('#exportModal');
    $('#expFallback').hidden = true;
    $$('#exportModal [data-share], #exportModal [data-dl]').forEach((b) => { b.disabled = true; });
    const st = $('#expStatus');
    st.className = 'exp-status';
    st.textContent = 'Generando PDF…';

    const falt = faltantes(cur);
    const w = $('#expWarn');
    if (falt.length) {
      w.hidden = false;
      w.innerHTML = `<b>Campos sin diligenciar</b> (puede generar el PDF igual):<ul>${falt.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    } else w.hidden = true;

    try {
      const base = S.nombreArchivo(cur);
      const pdfBlob = await window.SimPDF.build(cur, getSettings());
      const pdf = new File([pdfBlob], base + '.pdf', { type: 'application/pdf' });
      const json = respaldo(cur);
      const jsonFile = new File([json], base + '_respaldo.json', { type: 'application/json' });
      // WhatsApp/Chrome en Android no aceptan .json al compartir: se envía con extensión .txt
      const jsonShare = puedeCompartir([jsonFile]) ? jsonFile : new File([json], base + '_respaldo.json.txt', { type: 'text/plain' });
      out = { pdf, jsonFile, jsonShare, texto: textoEnvio(cur) };
      st.textContent = `Listo · PDF ${kb(pdf.size)} · Respaldo ${kb(jsonFile.size)}`;
      $$('#exportModal [data-share], #exportModal [data-dl]').forEach((b) => { b.disabled = false; });
    } catch (e) {
      console.error(e);
      st.className = 'exp-status err';
      st.textContent = 'No se pudo generar el PDF: ' + e.message;
    }
  }

  async function compartir(files) {
    if (puedeCompartir(files)) {
      try {
        await navigator.share({ files, title: 'Evaluación de simulacro', text: out.texto });
        toast('Listo para enviar');
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
        toast('No se pudo abrir el menú para compartir; se descargarán los archivos.');
      }
    }
    // Alternativa: descargar y abrir WhatsApp / correo para adjuntar manualmente
    files.forEach((f, i) => setTimeout(() => descargar(f, f.name.replace(/\.json\.txt$/, '.json')), i * 600));
    const t = encodeURIComponent(out.texto + '\n\n(Adjunto: ' + files.map((f) => f.name.replace(/\.json\.txt$/, '.json')).join(', ') + ')');
    $('#lnkWa').href = 'https://wa.me/?text=' + t;
    $('#lnkMail').href = 'mailto:?subject=' + encodeURIComponent('Evaluación de simulacro – ' + [cur.ficha.ciudadSede, S.fmtFecha(cur.ficha.fecha)].filter(Boolean).join(' – ')) + '&body=' + t;
    $('#expFallback').hidden = false;
  }

  $('#exportModal').addEventListener('click', (ev) => {
    const sh = ev.target.closest('[data-share]');
    const dl = ev.target.closest('[data-dl]');
    if (!out) return;
    if (sh) {
      const k = sh.dataset.share;
      compartir(k === 'pdf' ? [out.pdf] : k === 'json' ? [out.jsonShare] : [out.pdf, out.jsonShare]);
    }
    if (dl) {
      const f = dl.dataset.dl === 'pdf' ? out.pdf : out.jsonFile;
      descargar(f, f.name);
      toast('Descargando ' + f.name);
    }
  });
  $('#btnExport').addEventListener('click', abrirExportar);

  /* ================= Guía ================= */
  function renderGuia() {
    $('#guideSteps').innerHTML = S.GUIA.map((g) => `
      <div class="gstep">
        <div class="gtime"><b>${esc(g.t)}</b><small>${esc(g.h)}</small></div>
        <div class="gcards">
          <div class="gcard r-todas"><b>${esc(g.todas[0])}</b><span>${esc(g.todas[1])}</span></div>
          <div class="gcard r-lider"><b>${esc(g.lider[0])}</b><span>${esc(g.lider[1])}</span></div>
          <div class="gcard r-obs"><b>${esc(g.obs[0])}</b><span>${esc(g.obs[1])}</span></div>
        </div>
      </div>`).join('');
  }
  $('#btnGuide').addEventListener('click', () => openModal('#guideModal'));

  /* ================= Configuración ================= */
  let logoTmp = '';
  function pintarLogo() { $('#logoPrev').innerHTML = logoTmp ? `<img src="${logoTmp}" alt="Logo">` : 'Sin logo'; }
  $('#btnSettings').addEventListener('click', () => {
    const st = getSettings();
    $('#sEmpresa').value = st.empresa; $('#sEval').value = st.evaluador; $('#sCargo').value = st.cargo;
    logoTmp = st.logo; pintarLogo();
    openModal('#settingsModal');
  });
  $('#fileLogo').addEventListener('change', async (ev) => {
    const file = ev.target.files[0]; ev.target.value = '';
    if (!file) return;
    try {
      const url = URL.createObjectURL(file);
      const img = await loadImage(url);
      URL.revokeObjectURL(url);
      const r = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * r); c.height = Math.round(img.naturalHeight * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      logoTmp = c.toDataURL('image/png');
      pintarLogo();
    } catch (e) { toast(e.message); }
  });
  $('#btnLogoDel').addEventListener('click', () => { logoTmp = ''; pintarLogo(); });
  $('#btnSaveSettings').addEventListener('click', () => {
    const st = { empresa: $('#sEmpresa').value.trim(), logo: logoTmp, evaluador: $('#sEval').value.trim(), cargo: $('#sCargo').value.trim() };
    if (saveSettings(st)) { closeModal('#settingsModal'); toast('Configuración guardada'); if (!cur) $('#appSub').textContent = st.empresa; }
  });

  /* ================= Navegación ================= */
  async function route() {
    const m = location.hash.match(/^#\/eval\/(.+)$/);
    $$('.modal').forEach((md) => { md.hidden = true; });
    document.body.style.overflow = '';
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (cur && cur.id === id) return;
      await flush();
      const e = await DB.get(id).catch(() => null);
      if (!e) { location.hash = '#/'; return; }
      openEval(e);
    } else {
      showHome();
    }
  }
  window.addEventListener('hashchange', route);
  $('#btnBack').addEventListener('click', () => { location.hash = '#/'; });

  /* Enlaces de secciones sin cambiar el hash */
  $('#steps').addEventListener('click', (ev) => {
    const a = ev.target.closest('a'); if (!a) return;
    ev.preventDefault();
    $(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ================= PWA ================= */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('#btnInstall').hidden = false; });
  $('#btnInstall').addEventListener('click', async () => {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice.catch(() => null);
    installEvt = null; $('#btnInstall').hidden = true;
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline */ });
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  /* ================= Inicio ================= */
  $('#dlTipos').innerHTML = S.TIPOS.map((t) => `<option value="${esc(t)}">`).join('');
  $('#dlLeyendas').innerHTML = S.LEYENDAS_FOTO.map((t) => `<option value="${esc(t)}">`).join('');
  renderGuia();
  route();

  // Acceso para pruebas automatizadas
  window.__sim = { get cur() { return cur; }, flush, faltantes, respaldo };
})();
