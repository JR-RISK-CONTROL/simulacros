/* Configuración del formato "Evaluación de simulacro de evacuación" y utilidades compartidas */
'use strict';
(function () {
  const HITOS = [
    { k: 'T0', nombre: 'Inicio de la emergencia', mide: 'Momento exacto en que inicia la señal' },
    { k: 'T1', nombre: 'Reacción de autoprotección', mide: 'Tiempo que tarda la población en protegerse' },
    { k: 'T2', nombre: 'Activación de alarma de evacuación', mide: 'Tiempo desde T0 hasta que suena la sirena continua' },
    { k: 'T3', nombre: 'Salida del primer cliente/empleado', mide: 'Momento en que la primera persona cruza la puerta exterior' },
    { k: 'T4', nombre: 'Evacuación total de la instalación', mide: 'Momento en que sale la ÚLTIMA persona de la sala' },
    { k: 'T5', nombre: 'Reporte de conteo final', mide: 'Tiempo desde T4 (última persona fuera) hasta terminar el conteo en el punto de encuentro' }
  ];

  const CHECKLIST = [
    '¿Los brigadistas eran claramente identificables (chalecos/brazaletes)?',
    '¿Se abrieron con facilidad todas las puertas de emergencia?',
    '¿Las rutas de evacuación estaban libres de obstáculos (máquinas, sillas)?',
    '¿El personal de caja aplicó el protocolo de aseguramiento de valores?',
    '¿Los clientes atendieron las órdenes de evacuación sin generar caos?',
    '¿El Punto de Encuentro asignado fue suficiente y seguro para el aforo?',
    '¿La alarma (sirena o pito) se escuchó en toda la sala?',
    '¿Se hizo el barrido de baños y áreas comunes?',
    '¿Se hizo el conteo con los listados de empleados y visitantes?'
  ];

  const ESTADOS = ['Pendiente', 'En curso', 'Cerrada'];

  const FIRMAS = ['Comandante del incidente (Sede)', 'Observador / Evaluador de tiempos'];

  const TIPOS = [
    'Sismo con evacuación',
    'Incendio con evacuación',
    'Evacuación general',
    'Amenaza de artefacto explosivo',
    'Emergencia médica',
    'Fuga de gas con evacuación'
  ];

  const LEYENDAS_FOTO = [
    'Autoprotección (agáchese, cúbrase y protéjase)',
    'Evacuación por la ruta',
    'Punto de encuentro',
    'Conteo del personal',
    'Barrido de baños y áreas comunes',
    'Brigadistas identificados'
  ];

  /* Paso a paso del simulacro por sismo (guía de campo) */
  const GUIA = [
    { t: '0:00', h: 'T0–T1',
      todas: ['Protéjase', 'Agáchese, cúbrase y protéjase'],
      lider: ['Da la señal', 'Sirena 30 s: «Simulacro, sismo fuerte»'],
      obs: ['Inicia el cronómetro', 'Anota T0 y T1'] },
    { t: '0:30', h: 'T2',
      todas: ['Espere la instrucción', 'Mantenga la calma, aún sin evacuar'],
      lider: ['Termina el temblor', 'Activa la sirena continua de evacuación'],
      obs: ['Anota T2', 'Suena la sirena continua'] },
    { t: '1:00', h: 'T3',
      todas: ['Evacúe caminando', 'Sin correr ni empujar, por la ruta'],
      lider: ['Abre salidas y guía', 'Revisa baños y áreas comunes'],
      obs: ['Anota T3', 'Sale la primera persona'] },
    { t: '3:00', h: 'T4',
      todas: ['Vaya al punto de encuentro', 'Forme fila de forma ordenada'],
      lider: ['Asigna responsabilidades', 'Roles claros a líderes de evacuación y brigadistas'],
      obs: ['Anota T4', 'Sale la última persona'] },
    { t: '4:00', h: 'T5',
      todas: ['Responda al conteo', 'Permanezca en su fila'],
      lider: ['Hace el barrido final', 'Confirma que nadie queda adentro'],
      obs: ['Anota T5', 'Conteo final y total de personas'] },
    { t: '10:00', h: 'Fin',
      todas: ['Regrese en orden', 'Cuando el líder lo autorice'],
      lider: ['Cuenta y reporta. «Fin del simulacro»', 'Con listados de empleados y visitantes; autoriza el regreso'],
      obs: ['Cierra el formato', 'Calcula T4–T0, fotos, observaciones y firmas'] }
  ];

  /* ---------- Tiempo ---------- */
  const pad = (n) => String(n).padStart(2, '0');

  function toSec(h) {
    if (!h) return null;
    const p = String(h).split(':').map(Number);
    if (p.length < 2 || p.some((x) => Number.isNaN(x))) return null;
    return p[0] * 3600 + p[1] * 60 + (p[2] || 0);
  }

  /* Diferencia b − a en segundos (soporta cruce de medianoche) */
  function diff(a, b) {
    const x = toSec(a), y = toSec(b);
    if (x == null || y == null) return null;
    return (((y - x) % 86400) + 86400) % 86400;
  }

  function mmss(s) {
    if (s == null) return '';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
    return h ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
  }

  function minSeg(s) {
    if (s == null) return '';
    return `${Math.floor(s / 60)} min  ${Math.floor(s % 60)} s`;
  }

  function normHora(v) {
    if (!v) return '';
    return v.length === 5 ? v + ':00' : v.slice(0, 8);
  }

  function horaAhora(d = new Date()) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function hoy(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function fmtFecha(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return d && m && y ? `${d}/${m}/${y}` : iso;
  }

  function fmtFechaHora(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /* Tiempo de la columna "Tiempo desde T0" (T5 se mide desde T4, como en el formato) */
  function delta(e, k) {
    const T = e.tiempos;
    if (k === 'T0') return T.T0.hora ? 0 : null;
    if (k === 'T5') return diff(T.T4.hora, T.T5.hora);
    return diff(T.T0.hora, T[k].hora);
  }

  function totalEvacuacion(e) {
    return diff(e.tiempos.T0.hora, e.tiempos.T4.hora);
  }

  function totalPersonas(f) {
    const vals = [f.empleados, f.clientes, f.visitantes].filter((v) => v !== '' && v != null && !Number.isNaN(Number(v)));
    if (!vals.length) return '';
    return vals.reduce((a, v) => a + Number(v), 0);
  }

  function slug(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  }

  function nombreArchivo(e) {
    const partes = ['Simulacro', slug(e.ficha.ciudadSede), slug(e.ficha.sala), e.ficha.fecha || hoy()].filter(Boolean);
    return partes.join('_');
  }

  window.SIM = {
    HITOS, CHECKLIST, ESTADOS, FIRMAS, TIPOS, LEYENDAS_FOTO, GUIA,
    pad, toSec, diff, mmss, minSeg, normHora, horaAhora, hoy, fmtFecha, fmtFechaHora,
    delta, totalEvacuacion, totalPersonas, slug, nombreArchivo
  };
})();
