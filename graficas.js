// graficas.js — Gráficas de líneas en SVG hechas a mano (sin librerías,
// para que funcionen sin internet). Los colores salen del CSS (clases .serie-N).

// Convierte "2026-10-10" en milisegundos (hora local) para el eje X.
function fechaAMs(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).getTime();
}

// Formato corto para etiquetas: "10/10".
function fechaCorta(ms) {
  const f = new Date(ms);
  return `${f.getDate()}/${f.getMonth() + 1}`;
}

// Redondea a 1 decimal y quita ".0".
function num(v) {
  return String(Math.round(v * 10) / 10);
}

/**
 * Dibuja una gráfica de líneas.
 * series: [{ nombre, puntos: [{ fecha: "AAAA-MM-DD", valor: número }] }]
 * unidad: texto que acompaña los valores ("kg", "%", ...)
 * Devuelve un string con el <svg>.
 */
function graficaLineas(series, unidad = '') {
  const todos = series.flatMap((s) => s.puntos);
  if (todos.length === 0) {
    return '<p class="vacio">Aún no hay datos para graficar.</p>';
  }

  // Tamaño interno del dibujo; el SVG se escala al ancho de la pantalla.
  const ancho = 340, alto = 180;
  const margen = { izq: 40, der: 14, arr: 14, aba: 26 };

  const xs = todos.map((p) => fechaAMs(p.fecha));
  const ys = todos.map((p) => p.valor);
  let xMin = Math.min(...xs), xMax = Math.max(...xs);
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  // Si solo hay un valor, abrimos un rango para que el punto quede centrado.
  if (xMin === xMax) { xMin -= 86400000 * 3; xMax += 86400000 * 3; }
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const holgura = (yMax - yMin) * 0.12;
  yMin -= holgura; yMax += holgura;

  const px = (x) => margen.izq + ((x - xMin) / (xMax - xMin)) * (ancho - margen.izq - margen.der);
  const py = (y) => alto - margen.aba - ((y - yMin) / (yMax - yMin)) * (alto - margen.arr - margen.aba);

  let svg = `<svg class="grafica" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Gráfica">`;

  // Líneas guía horizontales con su valor.
  for (let i = 0; i <= 3; i++) {
    const v = yMin + ((yMax - yMin) * i) / 3;
    const y = py(v);
    svg += `<line class="guia" x1="${margen.izq}" x2="${ancho - margen.der}" y1="${y}" y2="${y}"/>`;
    svg += `<text class="eje" x="${margen.izq - 6}" y="${y + 4}" text-anchor="end">${num(v)}</text>`;
  }

  // Etiquetas de fecha: primera y última (y la del medio si hay espacio).
  const fechasUnicas = [...new Set(xs)].sort((a, b) => a - b);
  const etiquetas = fechasUnicas.length > 2
    ? [fechasUnicas[0], fechasUnicas[Math.floor(fechasUnicas.length / 2)], fechasUnicas[fechasUnicas.length - 1]]
    : fechasUnicas;
  for (const x of etiquetas) {
    svg += `<text class="eje" x="${px(x)}" y="${alto - 6}" text-anchor="middle">${fechaCorta(x)}</text>`;
  }

  // Cada serie: línea + puntos. El último punto se resalta con su valor.
  series.forEach((s, i) => {
    const puntos = [...s.puntos].sort((a, b) => fechaAMs(a.fecha) - fechaAMs(b.fecha));
    if (puntos.length === 0) return;
    const coords = puntos.map((p) => `${px(fechaAMs(p.fecha)).toFixed(1)},${py(p.valor).toFixed(1)}`);
    if (coords.length > 1) svg += `<polyline class="linea serie-${i}" points="${coords.join(' ')}"/>`;
    puntos.forEach((p, j) => {
      const ultimo = j === puntos.length - 1;
      svg += `<circle class="punto serie-${i}" cx="${px(fechaAMs(p.fecha))}" cy="${py(p.valor)}" r="${ultimo ? 4.5 : 3}"><title>${p.fecha}: ${num(p.valor)} ${unidad}</title></circle>`;
    });
    if (i === 0) {
      const u = puntos[puntos.length - 1];
      const x = px(fechaAMs(u.fecha));
      const ancla = x > ancho - 60 ? 'end' : 'start';
      const dx = ancla === 'end' ? -8 : 8;
      svg += `<text class="valor-final" x="${x + dx}" y="${py(u.valor) - 12}" text-anchor="${ancla}">${num(u.valor)} ${unidad}</text>`;
    }
  });

  svg += '</svg>';

  // Leyenda si hay más de una serie.
  if (series.length > 1) {
    svg += '<div class="leyenda">' + series.map((s, i) =>
      `<span><i class="marca serie-${i}"></i>${s.nombre}</span>`).join('') + '</div>';
  }
  return svg;
}
