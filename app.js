// app.js — Lógica y pantallas de Mi Entreno.
// La app solo REGISTRA y MUESTRA tus datos. No da consejos médicos ni nutricionales.

/* ------------------------------------------------------------------
   1. Datos iniciales (se cargan la primera vez que abres la app)
------------------------------------------------------------------- */

// Fecha de inicio por defecto de la Semana 1 (lunes). Se cambia en Ajustes.
const FECHA_INICIO_POR_DEFECTO = '2026-10-12';
const ESTATURA_POR_DEFECTO = 178;
// Días sin respaldo antes de mostrar el recordatorio.
const DIAS_RECORDATORIO_RESPALDO = 14;

// Tu plan original. "unidad" es "reps" (repeticiones) o "seg" (segundos).
const PLAN_ORIGINAL = {
  A: [
    { id: 'prensa', nombre: 'Prensa de piernas', series: 3, repMin: 10, repMax: 12, unidad: 'reps' },
    { id: 'press-pecho', nombre: 'Press de pecho en máquina', series: 3, repMin: 10, repMax: 12, unidad: 'reps' },
    { id: 'jalon', nombre: 'Jalón al pecho', series: 3, repMin: 10, repMax: 12, unidad: 'reps' },
    { id: 'curl-femoral', nombre: 'Curl femoral', series: 2, repMin: 12, repMax: 12, unidad: 'reps' },
    { id: 'press-hombro', nombre: 'Press de hombro en máquina', series: 2, repMin: 12, repMax: 12, unidad: 'reps' },
    { id: 'plancha', nombre: 'Plancha', series: 3, repMin: 20, repMax: 30, unidad: 'seg' },
  ],
  B: [
    { id: 'extension-cuad', nombre: 'Extensión de cuádriceps', series: 3, repMin: 12, repMax: 12, unidad: 'reps' },
    { id: 'remo-sentado', nombre: 'Remo sentado', series: 3, repMin: 10, repMax: 12, unidad: 'reps' },
    { id: 'gluteo', nombre: 'Máquina de glúteo o puente de cadera', series: 3, repMin: 12, repMax: 12, unidad: 'reps' },
    { id: 'press-inclinado', nombre: 'Press inclinado en máquina', series: 2, repMin: 12, repMax: 12, unidad: 'reps' },
    { id: 'face-pull', nombre: 'Face pull en polea', series: 2, repMin: 15, repMax: 15, unidad: 'reps' },
    { id: 'abdominales', nombre: 'Abdominales en máquina', series: 2, repMin: 12, repMax: 15, unidad: 'reps' },
  ],
};

// Tu primer reporte de bioimpedancia.
const REPORTE_INICIAL = {
  id: 'reporte-2026-10-10',
  fecha: '2026-10-10',
  peso: 112.6, masaGrasa: 44.7, pctGrasa: 39.7, masaLibreGrasa: 61.6,
  masaMuscular: 37, agua: 45.1, imc: 35.5, visceral: 19, tmb: 2368.65,
};

// Campos del reporte de bioimpedancia (orden en pantalla).
const CAMPOS_REPORTE = [
  { k: 'peso', n: 'Peso', u: 'kg' },
  { k: 'masaGrasa', n: 'Masa de grasa', u: 'kg' },
  { k: 'pctGrasa', n: 'Grasa corporal', u: '%' },
  { k: 'masaLibreGrasa', n: 'Masa libre de grasa', u: 'kg' },
  { k: 'masaMuscular', n: 'Masa muscular esquelética', u: 'kg' },
  { k: 'agua', n: 'Agua corporal', u: 'L' },
  { k: 'imc', n: 'IMC', u: '' },
  { k: 'visceral', n: 'Grasa visceral (nivel)', u: '' },
  { k: 'tmb', n: 'Tasa metabólica basal', u: 'kcal' },
];

/* ------------------------------------------------------------------
   2. Estado en memoria (copia de lo que hay en IndexedDB)
------------------------------------------------------------------- */
const estado = {
  vista: 'hoy',
  plan: { A: [], B: [] },
  sesiones: [],
  reportes: [],
  pesajes: [],
  ajustes: { fechaInicio: FECHA_INICIO_POR_DEFECTO, estaturaCm: ESTATURA_POR_DEFECTO, tema: 'auto', ultimoRespaldo: null },
  borrador: null,          // sesión en curso (aún sin guardar)
  ejercicioGrafica: null,  // ejercicio elegido en Progreso
  metricaGrafica: 'peso',  // "peso" o "volumen"
  editando: null,          // { dia, id } del ejercicio que se edita en Mi plan
  editandoReporte: null,   // id del reporte que se edita
};

/* ------------------------------------------------------------------
   3. Utilidades
------------------------------------------------------------------- */

// Fecha de hoy como "AAAA-MM-DD" en hora local.
function hoyISO() { return aISO(new Date()); }
function aISO(f) {
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}
function deISO(iso) { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); }
function sumarDias(iso, n) { const f = deISO(iso); f.setDate(f.getDate() + n); return aISO(f); }
function diasEntre(isoA, isoB) { return Math.round((deISO(isoB) - deISO(isoA)) / 86400000); }

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaLarga(iso) { const f = deISO(iso); return `${DIAS[f.getDay()]} ${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`; }
function fechaMedia(iso) { const f = deISO(iso); return `${DIAS[f.getDay()].slice(0, 3)} ${f.getDate()} ${MESES[f.getMonth()]}`; }

// Escapa texto para meterlo en HTML sin riesgo.
function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Convierte lo que escribe el usuario en número (acepta coma decimal).
function aNumero(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function fmt(n) { return n === null || n === undefined ? '—' : String(Math.round(n * 100) / 100); }
function idNuevo(prefijo) { return `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; }
function rango(ej) { return ej.repMin === ej.repMax ? `${ej.repMin}` : `${ej.repMin}–${ej.repMax}`; }
function unidadTxt(ej) { return ej.unidad === 'seg' ? 's' : 'reps'; }

// Aviso flotante breve.
function aviso(texto) {
  const el = document.getElementById('aviso');
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => { el.hidden = true; }, 2600);
}

// Confirmación en dos toques (los diálogos del sistema no son cómodos en el móvil):
// el primer toque "arma" el botón y el segundo ejecuta la acción.
function confirmar(boton) {
  if (boton.dataset.armado === '1') return true;
  boton.dataset.armado = '1';
  const original = boton.textContent;
  boton.textContent = '¿Seguro? Toca otra vez';
  boton.classList.add('armado');
  setTimeout(() => {
    boton.dataset.armado = '';
    boton.textContent = original;
    boton.classList.remove('armado');
  }, 3500);
  return false;
}

/* ------------------------------------------------------------------
   4. Calendario: ¿qué toca un día?
   Semana 1: Lun A, Mié B, Vie A. Semana 2: Lun B, Mié A, Vie B.
   Sáb y Dom: caminar. Mar y Jue: descanso.
------------------------------------------------------------------- */
function queToca(iso) {
  const f = deISO(iso);
  const dow = f.getDay(); // 0 = domingo
  if (dow === 0 || dow === 6) return { tipo: 'caminar' };
  if (iso < estado.ajustes.fechaInicio) return { tipo: 'antes' };
  // Lunes de la semana en que empieza el plan.
  const inicio = deISO(estado.ajustes.fechaInicio);
  const lunesInicio = sumarDias(estado.ajustes.fechaInicio, -((inicio.getDay() + 6) % 7));
  const semana = Math.floor(diasEntre(lunesInicio, iso) / 7); // 0 = Semana 1
  const par = semana % 2 === 0;
  if (dow === 1) return { tipo: 'entreno', dia: par ? 'A' : 'B', semana: semana + 1 };
  if (dow === 3) return { tipo: 'entreno', dia: par ? 'B' : 'A', semana: semana + 1 };
  if (dow === 5) return { tipo: 'entreno', dia: par ? 'A' : 'B', semana: semana + 1 };
  return { tipo: 'descanso', semana: semana + 1 };
}

/* ------------------------------------------------------------------
   5. Historial y regla de progresión
------------------------------------------------------------------- */

// Sesiones de la más reciente a la más antigua.
function sesionesOrdenadas() {
  return [...estado.sesiones].sort((a, b) =>
    b.fecha.localeCompare(a.fecha) || (b.guardadoEl || '').localeCompare(a.guardadoEl || ''));
}

// Series de la última sesión en que hiciste ese ejercicio.
function ultimaVez(ejercicioId) {
  for (const s of sesionesOrdenadas()) {
    const series = s.series.filter((x) => x.ejercicioId === ejercicioId);
    if (series.length) return { fecha: s.fecha, series };
  }
  return null;
}

// Tu regla: si la última vez completaste TODAS las series en el máximo
// del rango, toca subir el peso y volver al mínimo.
function tocaSubir(ej, ultima) {
  if (!ultima) return false;
  const conReps = ultima.series.filter((x) => x.reps !== null);
  return conReps.length >= ej.series && conReps.every((x) => x.reps >= ej.repMax);
}

function textoSerie(x, unidad) {
  if (unidad === 'seg') return `${fmt(x.reps)} s${x.kg ? ` (${fmt(x.kg)} kg)` : ''}`;
  return `${fmt(x.kg)} kg × ${fmt(x.reps)}`;
}

/* ------------------------------------------------------------------
   6. Arranque
------------------------------------------------------------------- */
async function iniciar() {
  // La primera vez, carga el plan, el reporte inicial y los ajustes.
  const inicializado = await DB.leerAjuste('inicializado', false);
  if (!inicializado) {
    await DB.guardar('plan', { dia: 'A', ejercicios: PLAN_ORIGINAL.A });
    await DB.guardar('plan', { dia: 'B', ejercicios: PLAN_ORIGINAL.B });
    await DB.guardar('reportes', REPORTE_INICIAL);
    await DB.guardarAjuste('fechaInicio', FECHA_INICIO_POR_DEFECTO);
    await DB.guardarAjuste('estaturaCm', ESTATURA_POR_DEFECTO);
    await DB.guardarAjuste('tema', 'auto');
    await DB.guardarAjuste('inicializado', true);
  }
  await cargarTodo();
  aplicarTema();
  const hash = location.hash.replace('#', '');
  if (['hoy', 'sesion', 'plan', 'progreso', 'cuerpo', 'ajustes'].includes(hash)) estado.vista = hash;
  if (estado.vista === 'sesion' && !estado.borrador) estado.vista = 'hoy';
  render();
}

// Lee todo de IndexedDB al estado en memoria.
async function cargarTodo() {
  const plan = await DB.todos('plan');
  estado.plan = { A: [], B: [] };
  for (const p of plan) estado.plan[p.dia] = p.ejercicios;
  estado.sesiones = await DB.todos('sesiones');
  estado.reportes = (await DB.todos('reportes')).sort((a, b) => a.fecha.localeCompare(b.fecha));
  estado.pesajes = (await DB.todos('pesajes')).sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const clave of ['fechaInicio', 'estaturaCm', 'tema', 'ultimoRespaldo']) {
    const v = await DB.leerAjuste(clave, undefined);
    if (v !== undefined) estado.ajustes[clave] = v;
  }
  estado.borrador = await DB.leerAjuste('borrador', null);
}

function aplicarTema() {
  const t = estado.ajustes.tema;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

/* ------------------------------------------------------------------
   7. Pantallas
------------------------------------------------------------------- */
function render() {
  const cont = document.getElementById('contenido');
  const vistas = { hoy: vistaHoy, sesion: vistaSesion, plan: vistaPlan, progreso: vistaProgreso, cuerpo: vistaCuerpo, ajustes: vistaAjustes };
  cont.innerHTML = vistas[estado.vista]();
  document.querySelectorAll('nav [data-vista]').forEach((b) => {
    const activa = b.dataset.vista === estado.vista || (estado.vista === 'sesion' && b.dataset.vista === 'hoy');
    b.classList.toggle('activa', activa);
    b.setAttribute('aria-current', activa ? 'page' : 'false');
  });
}

function irA(vista) {
  estado.vista = vista;
  history.replaceState(null, '', '#' + vista);
  render();
  window.scrollTo(0, 0);
}

// ---------- HOY ----------
function vistaHoy() {
  const hoy = hoyISO();
  const toca = queToca(hoy);
  let h = `<header class="cabecera"><p class="eyebrow">${esc(fechaLarga(hoy))}</p>`;

  if (toca.tipo === 'entreno') {
    h += `<h1>Día ${toca.dia}</h1><p class="sub">Semana ${toca.semana} del plan</p></header>`;
  } else if (toca.tipo === 'caminar') {
    h += `<h1>Caminar</h1><p class="sub">Fin de semana: toca caminar.</p></header>`;
  } else if (toca.tipo === 'descanso') {
    h += `<h1>Descanso</h1><p class="sub">Semana ${toca.semana}. No hay sesión de pesas programada.</p></header>`;
  } else {
    h += `<h1>Antes del plan</h1><p class="sub">Tu plan empieza el ${esc(fechaLarga(estado.ajustes.fechaInicio))}.</p></header>`;
  }

  // Recordatorio de respaldo.
  const hayDatos = estado.sesiones.length > 0 || estado.reportes.length > 1 || estado.pesajes.length > 0;
  const ultimo = estado.ajustes.ultimoRespaldo;
  if (hayDatos && (!ultimo || diasEntre(ultimo.slice(0, 10), hoy) >= DIAS_RECORDATORIO_RESPALDO)) {
    h += `<div class="nota-respaldo"><p>${ultimo ? `Tu último respaldo fue hace ${diasEntre(ultimo.slice(0, 10), hoy)} días.` : 'Aún no has hecho un respaldo de tus datos.'} Tus datos solo viven en este teléfono.</p>
      <button class="btn secundario" data-accion="exportar">Exportar respaldo</button></div>`;
  }

  // Sesión en curso.
  if (estado.borrador) {
    h += `<section class="tarjeta destacada"><h2>Sesión en curso</h2>
      <p>Día ${esc(estado.borrador.dia)} · ${esc(fechaMedia(estado.borrador.fecha))}</p>
      <button class="btn primario" data-accion="ir" data-vista="sesion">Continuar sesión</button></section>`;
  } else if (toca.tipo === 'entreno') {
    h += `<section class="tarjeta"><h2>Ejercicios del Día ${toca.dia}</h2>
      <p class="paso">Calentamiento 8–10 min (bici o elíptica suave)</p>
      <ul class="lista-ej">${estado.plan[toca.dia].map((ej) => {
        const u = ultimaVez(ej.id);
        const subir = tocaSubir(ej, u);
        return `<li><span>${esc(ej.nombre)}</span><span class="dato">${ej.series}×${rango(ej)}${ej.unidad === 'seg' ? ' s' : ''}</span>${subir ? '<span class="pill subir">Subir peso</span>' : ''}</li>`;
      }).join('')}</ul>
      <p class="paso">Cardio final 15–20 min</p>
      <button class="btn primario" data-accion="iniciar" data-dia="${toca.dia}">Iniciar Día ${toca.dia}</button></section>`;
  }

  if (!estado.borrador) {
    h += `<div class="fila-botones"><span class="etiqueta">Entrenar otro día:</span>
      <button class="btn secundario" data-accion="iniciar" data-dia="A">Día A</button>
      <button class="btn secundario" data-accion="iniciar" data-dia="B">Día B</button></div>`;
  }

  // Próximos 7 días.
  h += '<section class="tarjeta"><h2>Próximos días</h2><ol class="semana">';
  for (let i = 0; i < 7; i++) {
    const iso = sumarDias(hoy, i);
    const t = queToca(iso);
    const txt = t.tipo === 'entreno' ? `Día ${t.dia}` : t.tipo === 'caminar' ? 'Caminar' : t.tipo === 'descanso' ? 'Libre' : '—';
    const hecho = estado.sesiones.some((s) => s.fecha === iso);
    h += `<li class="${t.tipo}${i === 0 ? ' hoy' : ''}"><span class="d">${DIAS[deISO(iso).getDay()].slice(0, 3)}</span><span class="n">${deISO(iso).getDate()}</span><span class="t">${txt}${hecho ? ' ✓' : ''}</span></li>`;
  }
  h += '</ol></section>';

  // Última sesión y último reporte.
  const ult = sesionesOrdenadas()[0];
  if (ult) {
    h += `<section class="tarjeta"><h2>Última sesión</h2><p>Día ${esc(ult.dia)} · ${esc(fechaMedia(ult.fecha))} · ${ult.series.length} series registradas</p></section>`;
  }
  const rep = estado.reportes[estado.reportes.length - 1];
  if (rep) {
    h += `<section class="tarjeta"><h2>Último reporte corporal</h2><p class="sub">${esc(fechaMedia(rep.fecha))}</p>
      <div class="mini-datos">
        <div><span class="dato grande">${fmt(rep.peso)}</span><span class="etiqueta">kg</span></div>
        <div><span class="dato grande">${fmt(rep.pctGrasa)}</span><span class="etiqueta">% grasa</span></div>
        <div><span class="dato grande">${fmt(rep.visceral)}</span><span class="etiqueta">visceral</span></div>
        <div><span class="dato grande">${fmt(rep.masaMuscular)}</span><span class="etiqueta">kg músculo</span></div>
      </div></section>`;
  }
  return h;
}

// Crea una sesión nueva (borrador) con las series vacías del plan.
async function iniciarSesion(dia) {
  const hoy = hoyISO();
  estado.borrador = {
    id: idNuevo('sesion'),
    fecha: hoy,
    dia,
    calentamiento: false,
    cardioMin: '',
    notas: '',
    ejercicios: estado.plan[dia].map((ej) => ({
      ejercicioId: ej.id, nombre: ej.nombre, unidad: ej.unidad,
      series: Array.from({ length: ej.series }, () => ({ kg: '', reps: '' })),
    })),
  };
  await DB.guardarAjuste('borrador', estado.borrador);
  irA('sesion');
}

// ---------- SESIÓN EN CURSO ----------
function vistaSesion() {
  const b = estado.borrador;
  if (!b) return '<p class="vacio">No hay sesión en curso.</p>';
  let h = `<header class="cabecera"><p class="eyebrow">Sesión en curso</p><h1>Día ${esc(b.dia)}</h1>
    <label class="campo-linea">Fecha <input type="date" id="ses-fecha" data-campo="fecha" value="${esc(b.fecha)}"></label></header>`;

  h += `<label class="check tarjeta"><input type="checkbox" id="ses-calentamiento" data-campo="calentamiento" ${b.calentamiento ? 'checked' : ''}>
    <span>Calentamiento 8–10 min (bici o elíptica suave)</span></label>`;

  b.ejercicios.forEach((e, i) => {
    const ej = buscarEjercicio(e.ejercicioId) || { series: e.series.length, repMin: 0, repMax: 0, unidad: e.unidad };
    const u = ultimaVez(e.ejercicioId);
    const subir = tocaSubir(ej, u);
    h += `<section class="tarjeta ejercicio"><div class="ej-cabecera"><h2>${esc(e.nombre)}</h2>
      <span class="dato">${ej.series}×${rango(ej)} ${unidadTxt(ej)}</span></div>`;
    if (u) {
      h += `<p class="ultima">Última vez (${esc(fechaMedia(u.fecha))}): ${u.series.map((x) => esc(textoSerie(x, e.unidad))).join(' · ')}</p>`;
    } else {
      h += '<p class="ultima">Primera vez que registras este ejercicio.</p>';
    }
    if (subir) {
      h += e.unidad === 'seg'
        ? `<p class="pill subir bloque">La última vez completaste todas las series en el máximo (${ej.repMax} s).</p>`
        : `<p class="pill subir bloque">Según tu regla: toca subir el peso y volver a ${ej.repMin} reps.</p>`;
    }
    h += `<div class="series"><div class="series-cab"><span>Serie</span>${e.unidad === 'seg' ? '<span>Segundos</span><span>Kg (opcional)</span>' : '<span>Kg</span><span>Reps</span>'}</div>`;
    e.series.forEach((s, j) => {
      const prev = u && u.series[j];
      const phKg = prev && prev.kg !== null ? fmt(prev.kg) : '';
      const phReps = prev && prev.reps !== null ? fmt(prev.reps) : '';
      const inputKg = `<input id="kg-${i}-${j}" inputmode="decimal" data-ej="${i}" data-serie="${j}" data-tipo="kg" value="${esc(s.kg)}" placeholder="${phKg}" aria-label="Kg serie ${j + 1}">`;
      const inputReps = `<input id="reps-${i}-${j}" inputmode="numeric" data-ej="${i}" data-serie="${j}" data-tipo="reps" value="${esc(s.reps)}" placeholder="${phReps}" aria-label="${e.unidad === 'seg' ? 'Segundos' : 'Repeticiones'} serie ${j + 1}">`;
      h += `<div class="serie"><span class="num">${j + 1}</span>${e.unidad === 'seg' ? inputReps + inputKg : inputKg + inputReps}</div>`;
    });
    h += `</div><div class="fila-botones"><button class="btn texto" data-accion="mas-serie" data-ej="${i}">+ Serie</button>
      ${e.series.length > 1 ? `<button class="btn texto" data-accion="menos-serie" data-ej="${i}">− Serie</button>` : ''}</div></section>`;
  });

  h += `<section class="tarjeta"><label class="campo">Cardio final (minutos)
      <input id="ses-cardio" inputmode="numeric" data-campo="cardioMin" value="${esc(b.cardioMin)}" placeholder="15–20"></label>
    <label class="campo">Notas
      <textarea id="ses-notas" data-campo="notas" rows="2" placeholder="Máquina ocupada, cómo te sentiste...">${esc(b.notas)}</textarea></label></section>
    <p class="ayuda">Los números grises son lo que hiciste la última vez. Solo se guardan las series donde anotes ${'repeticiones o segundos'}.</p>
    <div class="fila-botones final">
      <button class="btn primario" data-accion="guardar-sesion">Guardar sesión</button>
      <button class="btn peligro" data-accion="descartar-sesion">Descartar</button>
    </div>`;
  return h;
}

function buscarEjercicio(id) {
  return [...estado.plan.A, ...estado.plan.B].find((e) => e.id === id) || null;
}

// Guarda el borrador poco después de que dejes de escribir.
function guardarBorradorPronto() {
  clearTimeout(guardarBorradorPronto.t);
  guardarBorradorPronto.t = setTimeout(() => DB.guardarAjuste('borrador', estado.borrador), 400);
}

async function guardarSesion() {
  const b = estado.borrador;
  const series = [];
  for (const e of b.ejercicios) {
    e.series.forEach((s, j) => {
      const reps = aNumero(s.reps);
      if (reps === null) return; // serie vacía: no se guarda
      series.push({ ejercicioId: e.ejercicioId, nombre: e.nombre, unidad: e.unidad, serie: j + 1, kg: aNumero(s.kg), reps });
    });
  }
  if (series.length === 0) { aviso('Anota al menos una serie antes de guardar.'); return; }
  const sesion = {
    id: b.id, fecha: b.fecha, dia: b.dia, calentamiento: b.calentamiento,
    cardioMin: aNumero(b.cardioMin), notas: b.notas.trim(), series, guardadoEl: new Date().toISOString(),
  };
  await DB.guardar('sesiones', sesion);
  estado.sesiones = estado.sesiones.filter((s) => s.id !== sesion.id).concat(sesion);
  estado.borrador = null;
  await DB.borrar('ajustes', 'borrador');
  aviso('Sesión guardada.');
  irA('hoy');
}

// ---------- MI PLAN ----------
function vistaPlan() {
  let h = `<header class="cabecera"><p class="eyebrow">Cuerpo completo · 3 días por semana</p><h1>Mi plan</h1></header>
    <section class="tarjeta"><h2>Calendario</h2>
      <p>Semana 1: Lun A, Mié B, Vie A.<br>Semana 2: Lun B, Mié A, Vie B.<br>Sábado y domingo: caminar.</p>
      <h2>Cada sesión</h2><p>Calentamiento 8–10 min (bici o elíptica suave) → ejercicios → cardio final 15–20 min.</p>
      <h2>Tu regla de progresión</h2><p>Terminar cada serie con 2–3 repeticiones de reserva. Cuando completes todas las series en el máximo de repeticiones, la app te avisa para subir el peso y volver al mínimo.</p></section>`;

  for (const dia of ['A', 'B']) {
    h += `<section class="tarjeta"><h2>Día ${dia}</h2><ul class="lista-plan">`;
    estado.plan[dia].forEach((ej, i) => {
      const editando = estado.editando && estado.editando.dia === dia && estado.editando.id === ej.id;
      if (editando) {
        h += `<li class="editor">${formularioEjercicio(dia, ej)}</li>`;
      } else {
        h += `<li><div><strong>${esc(ej.nombre)}</strong><span class="dato">${ej.series}×${rango(ej)} ${unidadTxt(ej)}</span></div>
          <div class="acciones">
            <button class="btn icono" data-accion="mover" data-dia="${dia}" data-i="${i}" data-dir="-1" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn icono" data-accion="mover" data-dia="${dia}" data-i="${i}" data-dir="1" aria-label="Bajar" ${i === estado.plan[dia].length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn texto" data-accion="editar-ej" data-dia="${dia}" data-id="${esc(ej.id)}">Editar</button>
          </div></li>`;
      }
    });
    const nuevo = estado.editando && estado.editando.dia === dia && estado.editando.id === '__nuevo';
    h += `</ul>${nuevo
      ? `<div class="editor">${formularioEjercicio(dia, { id: '__nuevo', nombre: '', series: 3, repMin: 10, repMax: 12, unidad: 'reps' })}</div>`
      : `<button class="btn secundario" data-accion="editar-ej" data-dia="${dia}" data-id="__nuevo">+ Agregar ejercicio</button>`}</section>`;
  }
  h += `<div class="fila-botones final"><button class="btn peligro" data-accion="restaurar-plan">Restaurar plan original</button></div>
    <p class="ayuda">"Editar" conserva el historial del ejercicio. "Sustituir" crea un ejercicio nuevo con su propio historial (útil si cambias de máquina).</p>`;
  return h;
}

function formularioEjercicio(dia, ej) {
  const esNuevo = ej.id === '__nuevo';
  return `<form data-form="ejercicio" data-dia="${dia}" data-id="${esc(ej.id)}">
    <label class="campo">Nombre <input id="ej-nombre" name="nombre" value="${esc(ej.nombre)}" required></label>
    <div class="rejilla-3">
      <label class="campo">Series <input id="ej-series" name="series" inputmode="numeric" value="${ej.series}" required></label>
      <label class="campo">Mín. <input id="ej-min" name="repMin" inputmode="numeric" value="${ej.repMin}" required></label>
      <label class="campo">Máx. <input id="ej-max" name="repMax" inputmode="numeric" value="${ej.repMax}" required></label>
    </div>
    <label class="campo">Se mide en
      <select id="ej-unidad" name="unidad">
        <option value="reps" ${ej.unidad === 'reps' ? 'selected' : ''}>Repeticiones</option>
        <option value="seg" ${ej.unidad === 'seg' ? 'selected' : ''}>Segundos</option>
      </select></label>
    <div class="fila-botones">
      <button class="btn primario" type="submit" name="modo" value="editar">${esNuevo ? 'Agregar' : 'Guardar'}</button>
      ${esNuevo ? '' : '<button class="btn secundario" type="submit" name="modo" value="sustituir">Sustituir</button>'}
      <button class="btn texto" type="button" data-accion="cancelar-ej">Cancelar</button>
      ${esNuevo ? '' : `<button class="btn peligro" type="button" data-accion="quitar-ej" data-dia="${dia}" data-id="${esc(ej.id)}">Quitar</button>`}
    </div></form>`;
}

async function guardarPlan(dia) {
  await DB.guardar('plan', { dia, ejercicios: estado.plan[dia] });
}

// ---------- PROGRESO ----------
function vistaProgreso() {
  // Lista de ejercicios: los del plan y los que aparecen en el historial.
  const opciones = new Map();
  for (const ej of [...estado.plan.A, ...estado.plan.B]) opciones.set(ej.id, { nombre: ej.nombre, unidad: ej.unidad });
  for (const s of estado.sesiones) for (const x of s.series) if (!opciones.has(x.ejercicioId)) opciones.set(x.ejercicioId, { nombre: x.nombre, unidad: x.unidad });
  if (!estado.ejercicioGrafica || !opciones.has(estado.ejercicioGrafica)) estado.ejercicioGrafica = opciones.keys().next().value;
  const sel = opciones.get(estado.ejercicioGrafica);

  // Un punto por sesión: el peso máximo, o el volumen (kg × reps sumado).
  const puntos = [];
  for (const s of estado.sesiones) {
    const series = s.series.filter((x) => x.ejercicioId === estado.ejercicioGrafica);
    if (!series.length) continue;
    let valor;
    if (sel.unidad === 'seg') valor = Math.max(...series.map((x) => x.reps));
    else if (estado.metricaGrafica === 'peso') valor = Math.max(...series.map((x) => x.kg || 0));
    else valor = series.reduce((t, x) => t + (x.kg || 0) * x.reps, 0);
    puntos.push({ fecha: s.fecha, valor });
  }
  // Si hay dos sesiones el mismo día, se queda el valor más alto.
  const porFecha = {};
  for (const p of puntos) porFecha[p.fecha] = Math.max(porFecha[p.fecha] ?? -Infinity, p.valor);
  const serie = Object.entries(porFecha).map(([fecha, valor]) => ({ fecha, valor }));
  const unidad = sel.unidad === 'seg' ? 's' : estado.metricaGrafica === 'peso' ? 'kg' : 'kg·rep';

  let h = `<header class="cabecera"><p class="eyebrow">${estado.sesiones.length} sesiones registradas</p><h1>Progreso</h1></header>
    <section class="tarjeta"><label class="campo">Ejercicio
      <select id="sel-ejercicio" data-control="ejercicio">${[...opciones].map(([id, o]) =>
        `<option value="${esc(id)}" ${id === estado.ejercicioGrafica ? 'selected' : ''}>${esc(o.nombre)}</option>`).join('')}</select></label>`;
  if (sel.unidad !== 'seg') {
    h += `<div class="segmentado" role="group" aria-label="Métrica">
      <button class="${estado.metricaGrafica === 'peso' ? 'activo' : ''}" data-accion="metrica" data-m="peso">Peso máximo</button>
      <button class="${estado.metricaGrafica === 'volumen' ? 'activo' : ''}" data-accion="metrica" data-m="volumen">Volumen</button></div>`;
  } else {
    h += '<p class="sub">Segundos máximos por sesión.</p>';
  }
  h += graficaLineas([{ nombre: sel.nombre, puntos: serie }], unidad);
  if (estado.metricaGrafica === 'volumen' && sel.unidad !== 'seg') h += '<p class="ayuda">Volumen = suma de kg × repeticiones de todas las series.</p>';
  h += '</section><h2 class="titulo-seccion">Historial</h2>';

  const lista = sesionesOrdenadas();
  if (!lista.length) h += '<p class="vacio">Cuando guardes tu primera sesión aparecerá aquí.</p>';
  for (const s of lista) {
    const porEj = {};
    for (const x of s.series) (porEj[x.ejercicioId] ||= { nombre: x.nombre, unidad: x.unidad, series: [] }).series.push(x);
    h += `<details class="tarjeta sesion"><summary><span><strong>Día ${esc(s.dia)}</strong> · ${esc(fechaMedia(s.fecha))}</span><span class="dato">${s.series.length} series</span></summary>
      <p class="sub">${s.calentamiento ? 'Calentamiento ✓' : 'Sin calentamiento anotado'}${s.cardioMin ? ` · Cardio ${fmt(s.cardioMin)} min` : ''}</p>
      <ul class="detalle">${Object.values(porEj).map((e) => `<li><strong>${esc(e.nombre)}</strong><br>${e.series.map((x) => esc(textoSerie(x, e.unidad))).join(' · ')}</li>`).join('')}</ul>
      ${s.notas ? `<p class="notas">${esc(s.notas)}</p>` : ''}
      <button class="btn peligro chico" data-accion="borrar-sesion" data-id="${esc(s.id)}">Borrar sesión</button></details>`;
  }
  return h;
}

// ---------- CUERPO ----------
function vistaCuerpo() {
  const reps = estado.reportes;
  const ult = reps[reps.length - 1];
  const ant = reps[reps.length - 2];
  let h = `<header class="cabecera"><p class="eyebrow">Bioimpedancia · estatura ${fmt(estado.ajustes.estaturaCm)} cm</p><h1>Cuerpo</h1></header>`;

  if (ult) {
    h += `<section class="tarjeta"><h2>Último reporte</h2><p class="sub">${esc(fechaLarga(ult.fecha))}${ant ? ` · comparado con ${esc(fechaMedia(ant.fecha))}` : ''}</p>
      <dl class="tabla-datos">${CAMPOS_REPORTE.map((c) => {
        const v = ult[c.k];
        let dif = '';
        if (ant && v !== null && ant[c.k] !== null && ant[c.k] !== undefined) {
          const d = Math.round((v - ant[c.k]) * 100) / 100;
          dif = `<span class="dif">${d > 0 ? '▲ +' : d < 0 ? '▼ ' : '= '}${d === 0 ? '0' : fmt(d)}</span>`;
        }
        return `<div><dt>${c.n}</dt><dd><span class="dato">${fmt(v)}</span> <span class="unidad">${c.u}</span>${dif}</dd></div>`;
      }).join('')}</dl>
      ${!ant ? '<p class="ayuda">Cuando captures tu siguiente reporte verás aquí la diferencia contra este.</p>' : ''}</section>`;
  }

  // Gráficas. El peso incluye también los pesajes semanales.
  const serieDe = (k) => reps.filter((r) => r[k] !== null && r[k] !== undefined).map((r) => ({ fecha: r.fecha, valor: r[k] }));
  const seriesPeso = [{ nombre: 'Reportes', puntos: serieDe('peso') }];
  if (estado.pesajes.length) seriesPeso.push({ nombre: 'Pesajes semanales', puntos: estado.pesajes.map((p) => ({ fecha: p.fecha, valor: p.kg })) });
  h += `<section class="tarjeta"><h2>Peso (kg)</h2>${graficaLineas(seriesPeso, 'kg')}</section>
    <section class="tarjeta"><h2>Grasa corporal (%)</h2>${graficaLineas([{ nombre: 'Grasa', puntos: serieDe('pctGrasa') }], '%')}</section>
    <section class="tarjeta"><h2>Grasa visceral (nivel)</h2>${graficaLineas([{ nombre: 'Visceral', puntos: serieDe('visceral') }], '')}</section>
    <section class="tarjeta"><h2>Masa muscular esquelética (kg)</h2>${graficaLineas([{ nombre: 'Músculo', puntos: serieDe('masaMuscular') }], 'kg')}</section>`;

  // Formulario de nuevo reporte (o edición).
  const editando = estado.editandoReporte ? reps.find((r) => r.id === estado.editandoReporte) : null;
  h += `<details class="tarjeta" ${editando ? 'open' : ''}><summary><strong>${editando ? 'Editar reporte' : '+ Capturar nuevo reporte'}</strong></summary>
    <form data-form="reporte">
      <label class="campo">Fecha <input type="date" id="rep-fecha" name="fecha" value="${esc(editando ? editando.fecha : hoyISO())}" required></label>
      <div class="rejilla-2">${CAMPOS_REPORTE.map((c) => `<label class="campo">${c.n}${c.u ? ` (${c.u})` : ''}
        <input id="rep-${c.k}" name="${c.k}" inputmode="decimal" value="${editando && editando[c.k] !== null ? esc(editando[c.k]) : ''}"></label>`).join('')}</div>
      <div class="fila-botones"><button class="btn primario" type="submit">${editando ? 'Guardar cambios' : 'Guardar reporte'}</button>
      ${editando ? '<button class="btn texto" type="button" data-accion="cancelar-reporte">Cancelar</button>' : ''}</div>
      <p class="ayuda">Copia los valores tal como vienen en tu reporte de Smart Fit. Puedes dejar campos vacíos.</p>
    </form></details>`;

  // Pesajes semanales.
  h += `<section class="tarjeta"><h2>Peso semanal (opcional)</h2>
    <form data-form="pesaje" class="fila-form">
      <input type="date" id="pes-fecha" name="fecha" value="${hoyISO()}" aria-label="Fecha" required>
      <input id="pes-kg" name="kg" inputmode="decimal" placeholder="kg" aria-label="Peso en kg" required>
      <button class="btn primario" type="submit">Agregar</button></form>
    ${estado.pesajes.length ? `<ul class="lista-simple">${[...estado.pesajes].reverse().map((p) =>
      `<li><span>${esc(fechaMedia(p.fecha))}</span><span class="dato">${fmt(p.kg)} kg</span><button class="btn icono" data-accion="borrar-pesaje" data-id="${esc(p.id)}" aria-label="Borrar pesaje">✕</button></li>`).join('')}</ul>` : ''}</section>`;

  // Todos los reportes.
  h += '<h2 class="titulo-seccion">Todos los reportes</h2>';
  [...reps].reverse().forEach((r) => {
    h += `<details class="tarjeta"><summary><span><strong>${esc(fechaMedia(r.fecha))}</strong></span><span class="dato">${fmt(r.peso)} kg · ${fmt(r.pctGrasa)} %</span></summary>
      <dl class="tabla-datos">${CAMPOS_REPORTE.map((c) => `<div><dt>${c.n}</dt><dd><span class="dato">${fmt(r[c.k])}</span> <span class="unidad">${c.u}</span></dd></div>`).join('')}</dl>
      <div class="fila-botones"><button class="btn secundario chico" data-accion="editar-reporte" data-id="${esc(r.id)}">Editar</button>
      <button class="btn peligro chico" data-accion="borrar-reporte" data-id="${esc(r.id)}">Borrar</button></div></details>`;
  });
  return h;
}

// ---------- AJUSTES ----------
function vistaAjustes() {
  const a = estado.ajustes;
  return `<header class="cabecera"><p class="eyebrow">Mi Entreno</p><h1>Ajustes</h1></header>
    <section class="tarjeta">
      <label class="campo">Tema
        <select id="aj-tema" data-ajuste="tema">
          <option value="auto" ${a.tema === 'auto' ? 'selected' : ''}>Automático (según el teléfono)</option>
          <option value="light" ${a.tema === 'light' ? 'selected' : ''}>Claro</option>
          <option value="dark" ${a.tema === 'dark' ? 'selected' : ''}>Oscuro</option>
        </select></label>
      <label class="campo">Inicio del plan (lunes de la Semana 1)
        <input type="date" id="aj-inicio" data-ajuste="fechaInicio" value="${esc(a.fechaInicio)}"></label>
      <label class="campo">Estatura (cm)
        <input id="aj-estatura" inputmode="decimal" data-ajuste="estaturaCm" value="${esc(a.estaturaCm)}"></label>
    </section>
    <section class="tarjeta"><h2>Respaldo</h2>
      <p>Tus datos se guardan solo en este teléfono. Exporta un respaldo de vez en cuando y guárdalo en otro lugar (correo, Drive, etc.).</p>
      <p class="sub">Último respaldo: ${a.ultimoRespaldo ? esc(fechaLarga(a.ultimoRespaldo.slice(0, 10))) : 'nunca'}</p>
      <div class="fila-botones">
        <button class="btn primario" data-accion="exportar">Exportar JSON</button>
        <label class="btn secundario">Importar JSON<input type="file" id="importar" accept="application/json,.json" hidden></label>
      </div>
      <p class="ayuda">Importar reemplaza todos los datos actuales por los del archivo.</p>
    </section>
    <section class="tarjeta"><h2>Acerca de</h2>
      <p>Esta app solo registra y muestra tus datos. No da consejos médicos ni nutricionales.</p>
      <p class="sub">Funciona sin internet. Versión 1.0</p></section>`;
}

/* ------------------------------------------------------------------
   8. Respaldo (exportar / importar)
------------------------------------------------------------------- */
async function exportar() {
  const datos = await DB.exportar();
  const nombre = `mi-entreno-respaldo-${hoyISO()}.json`;
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const archivo = new File([blob], nombre, { type: 'application/json' });
  try {
    // En el teléfono, "Compartir" permite guardarlo en Archivos, Drive, correo...
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: 'Respaldo Mi Entreno' });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  } catch (e) {
    if (e.name === 'AbortError') return; // el usuario canceló
    aviso('No se pudo exportar: ' + e.message);
    return;
  }
  estado.ajustes.ultimoRespaldo = new Date().toISOString();
  await DB.guardarAjuste('ultimoRespaldo', estado.ajustes.ultimoRespaldo);
  aviso('Respaldo exportado.');
  render();
}

async function importar(archivo) {
  try {
    const datos = JSON.parse(await archivo.text());
    await DB.importar(datos);
    await cargarTodo();
    aplicarTema();
    aviso('Datos importados.');
    irA('hoy');
  } catch (e) {
    aviso('No se pudo importar: ' + e.message);
  }
}

/* ------------------------------------------------------------------
   9. Eventos (un solo "escuchador" para toda la app)
------------------------------------------------------------------- */
document.addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-accion], nav [data-vista]');
  if (!b) return;
  if (!b.dataset.accion) { irA(b.dataset.vista); return; }
  const a = b.dataset.accion;
  const borr = estado.borrador;

  switch (a) {
    case 'ir': irA(b.dataset.vista); break;
    case 'iniciar': await iniciarSesion(b.dataset.dia); break;
    case 'mas-serie':
      borr.ejercicios[b.dataset.ej].series.push({ kg: '', reps: '' });
      guardarBorradorPronto(); render(); break;
    case 'menos-serie':
      borr.ejercicios[b.dataset.ej].series.pop();
      guardarBorradorPronto(); render(); break;
    case 'guardar-sesion': await guardarSesion(); break;
    case 'descartar-sesion':
      if (!confirmar(b)) return;
      estado.borrador = null;
      await DB.borrar('ajustes', 'borrador');
      aviso('Sesión descartada.');
      irA('hoy'); break;
    case 'borrar-sesion':
      if (!confirmar(b)) return;
      await DB.borrar('sesiones', b.dataset.id);
      estado.sesiones = estado.sesiones.filter((s) => s.id !== b.dataset.id);
      aviso('Sesión borrada.'); render(); break;
    case 'metrica': estado.metricaGrafica = b.dataset.m; render(); break;
    case 'editar-ej': estado.editando = { dia: b.dataset.dia, id: b.dataset.id }; render(); break;
    case 'cancelar-ej': estado.editando = null; render(); break;
    case 'quitar-ej': {
      if (!confirmar(b)) return;
      const dia = b.dataset.dia;
      estado.plan[dia] = estado.plan[dia].filter((e) => e.id !== b.dataset.id);
      await guardarPlan(dia);
      estado.editando = null; aviso('Ejercicio quitado. Su historial se conserva.'); render(); break;
    }
    case 'mover': {
      const dia = b.dataset.dia, i = Number(b.dataset.i), j = i + Number(b.dataset.dir);
      const lista = estado.plan[dia];
      [lista[i], lista[j]] = [lista[j], lista[i]];
      await guardarPlan(dia); render(); break;
    }
    case 'restaurar-plan':
      if (!confirmar(b)) return;
      estado.plan = JSON.parse(JSON.stringify(PLAN_ORIGINAL));
      await guardarPlan('A'); await guardarPlan('B');
      estado.editando = null; aviso('Plan original restaurado.'); render(); break;
    case 'editar-reporte': estado.editandoReporte = b.dataset.id; render(); window.scrollTo(0, 0); break;
    case 'cancelar-reporte': estado.editandoReporte = null; render(); break;
    case 'borrar-reporte':
      if (!confirmar(b)) return;
      await DB.borrar('reportes', b.dataset.id);
      estado.reportes = estado.reportes.filter((r) => r.id !== b.dataset.id);
      aviso('Reporte borrado.'); render(); break;
    case 'borrar-pesaje':
      await DB.borrar('pesajes', b.dataset.id);
      estado.pesajes = estado.pesajes.filter((p) => p.id !== b.dataset.id);
      render(); break;
    case 'exportar': await exportar(); break;
  }
});

// Escribir en la sesión en curso actualiza el borrador (sin redibujar la pantalla).
document.addEventListener('input', (ev) => {
  const el = ev.target;
  const borr = estado.borrador;
  if (!borr || estado.vista !== 'sesion') return;
  if (el.dataset.tipo) {
    borr.ejercicios[el.dataset.ej].series[el.dataset.serie][el.dataset.tipo] = el.value;
    guardarBorradorPronto();
  } else if (el.dataset.campo) {
    borr[el.dataset.campo] = el.type === 'checkbox' ? el.checked : el.value;
    guardarBorradorPronto();
  }
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.control === 'ejercicio') { estado.ejercicioGrafica = el.value; render(); }
  if (el.id === 'importar' && el.files[0]) await importar(el.files[0]);
  if (el.dataset.ajuste) {
    const clave = el.dataset.ajuste;
    let valor = el.value;
    if (clave === 'estaturaCm') valor = aNumero(valor);
    if (clave === 'fechaInicio' && !valor) return;
    if (valor === null) return;
    estado.ajustes[clave] = valor;
    await DB.guardarAjuste(clave, valor);
    if (clave === 'tema') aplicarTema();
    aviso('Ajuste guardado.');
  }
});

document.addEventListener('submit', async (ev) => {
  const form = ev.target;
  ev.preventDefault();
  const datos = Object.fromEntries(new FormData(form));

  if (form.dataset.form === 'ejercicio') {
    const dia = form.dataset.dia, id = form.dataset.id;
    const modo = ev.submitter ? ev.submitter.value : 'editar';
    const ej = {
      nombre: datos.nombre.trim(),
      series: Math.max(1, Math.round(aNumero(datos.series) || 1)),
      repMin: Math.round(aNumero(datos.repMin) || 0),
      repMax: Math.round(aNumero(datos.repMax) || 0),
      unidad: datos.unidad,
    };
    if (!ej.nombre) { aviso('Escribe un nombre.'); return; }
    if (ej.repMax < ej.repMin) [ej.repMin, ej.repMax] = [ej.repMax, ej.repMin];
    const lista = estado.plan[dia];
    if (id === '__nuevo') {
      lista.push({ id: idNuevo('ej'), ...ej });
    } else {
      const i = lista.findIndex((e) => e.id === id);
      // "Sustituir" le da un id nuevo: el historial del ejercicio anterior se conserva aparte.
      lista[i] = { id: modo === 'sustituir' ? idNuevo('ej') : id, ...ej };
    }
    await guardarPlan(dia);
    estado.editando = null;
    aviso(modo === 'sustituir' ? 'Ejercicio sustituido.' : 'Plan guardado.');
    render();
  }

  if (form.dataset.form === 'reporte') {
    const r = { id: estado.editandoReporte || idNuevo('reporte'), fecha: datos.fecha };
    for (const c of CAMPOS_REPORTE) r[c.k] = aNumero(datos[c.k]);
    await DB.guardar('reportes', r);
    estado.reportes = estado.reportes.filter((x) => x.id !== r.id).concat(r).sort((a, b) => a.fecha.localeCompare(b.fecha));
    estado.editandoReporte = null;
    aviso('Reporte guardado.');
    render();
  }

  if (form.dataset.form === 'pesaje') {
    const kg = aNumero(datos.kg);
    if (kg === null) { aviso('Escribe tu peso en kg.'); return; }
    const p = { id: idNuevo('pesaje'), fecha: datos.fecha, kg };
    await DB.guardar('pesajes', p);
    estado.pesajes = estado.pesajes.concat(p).sort((a, b) => a.fecha.localeCompare(b.fecha));
    aviso('Pesaje guardado.');
    render();
  }
});

/* ------------------------------------------------------------------
   10. Modo sin internet: registra el service worker
------------------------------------------------------------------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker no registrado:', e));
  });
}

iniciar().catch((e) => {
  document.getElementById('contenido').innerHTML = `<p class="vacio">No se pudo abrir la base de datos: ${esc(e.message)}</p>`;
});
