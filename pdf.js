/* Generación del PDF de la evaluación (jsPDF + AutoTable), colores corporativos Codere */
'use strict';
(function () {
  const C = {
    lime: [121, 192, 0], limeDark: [74, 122, 36], ink: [31, 35, 38], ink2: [58, 64, 70], muted: [104, 112, 120],
    tint: [230, 244, 204], tint2: [243, 250, 230], line: [200, 210, 190], white: [255, 255, 255],
    red: [198, 40, 40], redBg: [253, 236, 236], amber: [255, 243, 214], blue: [226, 239, 252]
  };
  const PW = 210, PH = 297, M = 12, CW = PW - 2 * M, TOP = 26, BOTTOM = PH - 16;

  /* Las fuentes estándar del PDF solo cubren Latin-1 */
  function t(s) {
    if (s == null) return '';
    return String(s)
      .replace(/[−–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
      .replace(/…/g, '...').replace(/•/g, '-').replace(/✓/g, 'X')
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
  }

  function loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Imagen inválida')); i.src = src; });
  }
  async function dims(src, w, h) {
    if (w && h) return { w, h };
    const i = await loadImage(src);
    return { w: i.naturalWidth, h: i.naturalHeight };
  }
  const fmt = (src) => (/^data:image\/png/i.test(src) ? 'PNG' : 'JPEG');
  function fit(w, h, bw, bh) { const r = Math.min(bw / w, bh / h); return { w: w * r, h: h * r }; }

  async function build(e, settings) {
    const S = window.SIM;
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('No se cargó la librería PDF');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const f = e.ficha;
    const empresa = (settings && settings.empresa) || '';
    doc.setProperties({ title: t('Evaluación de simulacro - ' + [f.ciudadSede, f.sala].filter(Boolean).join(' ')), subject: t(e.tipoEmergencia), author: t(f.evaluador), creator: 'App Evaluación de Simulacro' });

    let logo = null;
    if (settings && settings.logo) { try { const d = await dims(settings.logo); logo = { src: settings.logo, ...d }; } catch (err) { logo = null; } }

    let y = TOP + 2;
    const newPage = () => { doc.addPage(); y = TOP + 2; };
    const ensure = (need) => { if (y + need > BOTTOM) newPage(); };

    const base = {
      theme: 'grid',
      rowPageBreak: 'avoid',
      margin: { top: TOP + 2, bottom: PH - BOTTOM + 2, left: M, right: M },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, lineColor: C.line, lineWidth: 0.2, textColor: C.ink, valign: 'middle', overflow: 'linebreak' },
      headStyles: { fillColor: C.tint, textColor: C.ink, fontStyle: 'bold', halign: 'center', valign: 'middle' }
    };
    function table(o) {
      doc.autoTable(Object.assign({}, base, o, {
        startY: y,
        styles: Object.assign({}, base.styles, o.styles || {}),
        headStyles: Object.assign({}, base.headStyles, o.headStyles || {})
      }));
      y = doc.lastAutoTable.finalY + 6;
    }
    function section(title, need) {
      ensure(need || 26);
      doc.setFillColor(...C.lime); doc.rect(M, y, CW, 7, 'F');
      doc.setFillColor(...C.ink); doc.rect(M, y, 2.2, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...C.ink);
      doc.text(t(title), M + 4.5, y + 4.9);
      y += 7;
    }
    const L = (s, extra) => ({ content: t(s), styles: Object.assign({ fillColor: C.tint2, fontStyle: 'bold' }, extra || {}) });
    const V = (s, extra) => ({ content: t(s == null ? '' : s), styles: extra || {} });

    /* ---------- Título ---------- */
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...C.ink);
    doc.text(t('EVALUACIÓN DE SIMULACRO DE EVACUACIÓN'), PW / 2, y + 5, { align: 'center' });
    y += 11;
    doc.setFontSize(9.5); doc.setTextColor(...C.ink2);
    doc.text(t('TIPO DE EMERGENCIA:'), M, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.ink);
    doc.text(t(e.tipoEmergencia || ''), M + doc.getTextWidth('TIPO DE EMERGENCIA:') + 3, y);
    y += 6;
    if (e.suspension) {
      doc.setFillColor(...C.redBg); doc.setDrawColor(...C.red); doc.setLineWidth(0.3);
      doc.rect(M, y, CW, 8, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.red); doc.setFontSize(9.5);
      doc.text(t(`EJERCICIO SUSPENDIDO POR EMERGENCIA REAL a las ${e.suspension.hora}`), M + 3, y + 5.3);
      y += 12;
    }

    /* ---------- 1. Ficha ---------- */
    section('1. Ficha de registro de la sede');
    const tp = S.totalPersonas(f);
    table({
      body: [
        [L('Ciudad / Sede'), V(f.ciudadSede), L('Sala / Área evaluada'), V(f.sala)],
        [L('Fecha del simulacro'), V(S.fmtFecha(f.fecha)), L('Hora programada de inicio'), V(f.horaProgramada)],
        [L('Evaluador / Observador responsable'), V(f.evaluador), L('Cargo del observador'), V(f.cargo)],
        [L('N° de empleados evacuados'), V(f.empleados), L('N° de clientes evacuados'), V(f.clientes)],
        [L('N° de visitantes / contratistas evacuados'), V(f.visitantes), L('N° total de personas'), V(tp, { fontStyle: 'bold', fillColor: C.tint })]
      ],
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 53 }, 2: { cellWidth: 40 }, 3: { cellWidth: 53 } }
    });

    /* ---------- 2. Cronometría ---------- */
    section('2. Matriz de control de tiempos (cronometría)', 40);
    const total = S.totalEvacuacion(e);
    table({
      head: [['Hito técnico', 'Qué se mide', 'Hora reloj (HH:MM:SS)', 'Tiempo desde T0 (Min:Seg)', 'Observaciones'].map(t)],
      body: S.HITOS.map((h) => {
        const tm = e.tiempos[h.k] || {};
        const d = S.delta(e, h.k);
        return [
          V(`${h.k}: ${h.nombre}`, { fontStyle: 'bold' }),
          V(h.mide, { fontSize: 7.5, textColor: C.ink2 }),
          V(tm.hora, { halign: 'center' }),
          V(d == null ? '' : S.mmss(d) + (h.k === 'T5' ? '\n(desde T4)' : ''), { halign: 'center', fontStyle: 'bold', fillColor: C.tint2 }),
          V(tm.obs)
        ];
      }).concat([[
        L('Tiempo total de evacuación (T4 − T0)', { fillColor: C.tint }),
        { content: t(total == null ? '' : S.minSeg(total)), colSpan: 4, styles: { fontStyle: 'bold', fontSize: 10, fillColor: C.tint } }
      ]]),
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 52 }, 2: { cellWidth: 24 }, 3: { cellWidth: 24 }, 4: { cellWidth: 46 } }
    });

    /* ---------- 3. Lista de chequeo ---------- */
    section('3. Lista de chequeo operativa', 40);
    const si = e.checklist.filter((c) => c.resp === 'SI').length;
    const no = e.checklist.filter((c) => c.resp === 'NO').length;
    const pend = e.checklist.length - si - no;
    const pct = si + no ? Math.round((si / (si + no)) * 100) + ' %' : '-';
    table({
      head: [['Aspecto a evaluar', 'SÍ', 'NO', 'Observación'].map(t)],
      body: e.checklist.map((c, i) => [
        V(`${i + 1}. ${c.texto}`),
        V(c.resp === 'SI' ? 'X' : '', { halign: 'center', fontStyle: 'bold', fontSize: 11, textColor: C.limeDark }),
        V(c.resp === 'NO' ? 'X' : '', { halign: 'center', fontStyle: 'bold', fontSize: 11, textColor: C.red }),
        V(c.obs)
      ]).concat([[{
        content: t(`Respuestas: ${si} SÍ · ${no} NO · ${pend} sin responder        Cumplimiento: ${pct}`),
        colSpan: 4, styles: { fillColor: C.tint, fontStyle: 'bold' }
      }]]),
      columnStyles: { 0: { cellWidth: 92 }, 1: { cellWidth: 14 }, 2: { cellWidth: 14 }, 3: { cellWidth: 66 } }
    });

    /* ---------- 4. Registro fotográfico ---------- */
    const gap = 6, bw = (CW - gap) / 2, ih = 66, rowH = ih + 14;
    section('4. Registro fotográfico', e.fotos.length ? rowH + 9 : 20);
    y += 3;
    if (!e.fotos.length) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...C.muted);
      doc.text(t('Sin registro fotográfico.'), M, y + 3);
      y += 10;
    } else {
      let col = 0;
      for (let i = 0; i < e.fotos.length; i++) {
        const p = e.fotos[i];
        if (col === 0 && y + rowH > BOTTOM) newPage();
        const x = M + col * (bw + gap);
        doc.setDrawColor(...C.line); doc.setLineWidth(0.25); doc.setFillColor(246, 248, 243);
        doc.rect(x, y, bw, ih, 'FD');
        try {
          const d = await dims(p.dataUrl, p.w, p.h);
          const s = fit(d.w, d.h, bw - 2, ih - 2);
          doc.addImage(p.dataUrl, fmt(p.dataUrl), x + (bw - s.w) / 2, y + (ih - s.h) / 2, s.w, s.h, 'foto_' + (p.id || i), 'FAST');
        } catch (err) {
          doc.setFontSize(8); doc.setTextColor(...C.red); doc.text('Imagen no disponible', x + 3, y + 6);
        }
        doc.setFillColor(...C.ink); doc.rect(x, y, 15, 5.5, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.lime);
        doc.text(t(`Foto ${i + 1}`), x + 2, y + 3.9);
        const hora = p.takenAt ? (() => { const d = new Date(p.takenAt); return ` (${S.pad(d.getHours())}:${S.pad(d.getMinutes())})`; })() : '';
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.ink);
        const lines = doc.splitTextToSize(t((p.caption || 'Sin descripción') + hora), bw).slice(0, 2);
        doc.text(lines, x, y + ih + 4);
        col++;
        if (col === 2) { col = 0; y += rowH; }
      }
      if (col === 1) y += rowH;
      y += 2;
    }

    /* ---------- 5. Observaciones ---------- */
    section('5. Observaciones y hallazgos', 30);
    table({ body: [[V(e.observaciones || ' ', { minCellHeight: 20, valign: 'top', fontSize: 9 })]] });

    /* ---------- 6. Acciones de mejora ---------- */
    section('6. Acciones de mejora', 26);
    const acc = e.acciones.filter((a) => (a.accion || '').trim());
    const colorEstado = (s) => (s === 'Cerrada' ? C.tint : s === 'En curso' ? C.blue : C.amber);
    table({
      head: [['N°', 'Acción', 'Estado'].map(t)],
      body: acc.length
        ? acc.map((a, i) => [V(i + 1, { halign: 'center' }), V(a.accion), V(a.estado, { halign: 'center', fontStyle: 'bold', fillColor: colorEstado(a.estado) })])
        : [[{ content: t('Sin acciones de mejora registradas.'), colSpan: 3, styles: { textColor: C.muted, fontStyle: 'italic' } }]],
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 144 }, 2: { cellWidth: 30 } }
    });

    /* ---------- 7. Firmas ---------- */
    const fh = 44;
    section('7. Firmas de validación', fh + 12);
    y += 3;
    {
      let col = 0;
      for (let i = 0; i < e.firmas.length; i++) {
        const fm = e.firmas[i];
        if (col === 0 && y + fh > BOTTOM) newPage();
        const x = M + col * (bw + gap);
        doc.setDrawColor(...C.line); doc.setLineWidth(0.25); doc.rect(x, y, bw, fh);
        doc.setFillColor(...C.tint2); doc.rect(x, y, bw, 6.5, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.ink);
        doc.text(doc.splitTextToSize(t(fm.rol || 'Firmante'), bw - 4)[0], x + 2, y + 4.4);
        if (fm.firma) {
          try {
            const d = await dims(fm.firma);
            const s = fit(d.w, d.h, bw - 10, 20);
            doc.addImage(fm.firma, fmt(fm.firma), x + (bw - s.w) / 2, y + 7.5 + (21 - s.h), s.w, s.h, 'firma_' + i, 'FAST');
          } catch (err) { /* sin firma */ }
        }
        doc.setDrawColor(...C.ink2); doc.setLineWidth(0.3); doc.line(x + 6, y + 30, x + bw - 6, y + 30);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.ink);
        doc.text(t(fm.nombre || ''), x + bw / 2, y + 35, { align: 'center' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.muted);
        doc.text(t(fm.firma ? 'Firmado: ' + S.fmtFechaHora(fm.fecha) : 'Pendiente de firma'), x + bw / 2, y + 40, { align: 'center' });
        col++;
        if (col === 2) { col = 0; y += fh + 5; }
      }
      if (col === 1) y += fh + 5;
    }

    /* ---------- Encabezado y pie en todas las páginas ---------- */
    const n = doc.getNumberOfPages();
    const generado = S.fmtFechaHora(Date.now());
    const sub = [f.ciudadSede, f.sala, S.fmtFecha(f.fecha)].filter(Boolean).join(' · ');
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      if (logo) {
        const s = fit(logo.w, logo.h, 42, 12);
        doc.addImage(logo.src, fmt(logo.src), M, 6 + (12 - s.h) / 2, s.w, s.h, 'logo', 'FAST');
      } else if (empresa) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...C.ink);
        doc.text(t(empresa), M, 14);
      }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.ink);
      doc.text(t(logo && empresa ? empresa + ' · Evaluación de simulacro' : 'Evaluación de simulacro'), PW - M, 11, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.muted);
      doc.text(t(sub), PW - M, 15.5, { align: 'right' });
      doc.setFillColor(...C.lime); doc.rect(M, 20, CW, 1.3, 'F');

      doc.setDrawColor(...C.line); doc.setLineWidth(0.2); doc.line(M, PH - 12, PW - M, PH - 12);
      doc.setFontSize(7.5); doc.setTextColor(...C.muted);
      doc.text(t(`Generado el ${generado}${f.evaluador ? ' · Evaluador: ' + f.evaluador : ''}`), M, PH - 8);
      doc.text(t(`Página ${i} de ${n}`), PW - M, PH - 8, { align: 'right' });
    }

    return doc.output('blob');
  }

  window.SimPDF = { build };
})();
