/* Resumen: KPIs principales, ventas mensuales y hallazgos */
EB.pagina({
  id: "resumen",
  marts: ["mart_ventas", "mart_nps", "mart_usuarios", "mart_logistica", "mart_clientes_mes", "mart_dia_semana"],
  filtros: ["mes", "canal", "provincia"],
  render(d) {
    const { fmt, COLOR } = EB;
    const DIM_V = ["mes", "canal", "provincia"];
    const ventas = EB.filtrar(d.mart_ventas, DIM_V);
    const npsF = EB.filtrar(d.mart_nps, ["mes", "canal"]);
    const usu = EB.filtrar(d.mart_usuarios, ["mes"]);
    const meses = EB.mesesElegidos();
    const prev = EB.periodoAnterior();
    const sinComparar = true;
    document.getElementById("kpis-nota").textContent = prev
      ? "Las variaciones comparan con los mismos meses del año anterior."
      : "Para ver la variación contra el año anterior, elegí un período dentro de 2025.";

    // ---- Titular: una oración que cambia con los filtros ----
    const totV = EB.suma(ventas, "ventas");
    const totP = EB.suma(ventas, "pedidos");
    const quien = EB.describirFiltros(DIM_V);
    document.getElementById("titular").textContent =
      "EcoBottle vendió " + fmt.millones(totV) + " " +
      (meses.length === 1 ? "en " + EB.etiquetaMesLarga(meses[0]) : "entre " + EB.etiquetaMesLarga(meses[0]) + " y " + EB.etiquetaMesLarga(meses[meses.length - 1])) +
      (quien ? " (" + quien + ")" : "");
    document.getElementById("bajada").textContent =
      fmt.entero(totP) + " pedidos vendidos en " + meses.length + (meses.length === 1 ? " mes" : " meses") +
      ". Marca de botellas reutilizables con tiendas propias (OFFLINE) y sitio web (ONLINE).";

    // ---- Comparación interanual (solo si existen los meses del año anterior) ----
    const anterior = (fnActual, fnPrevio) => (prev ? { actual: fnActual, previo: fnPrevio } : { sinComparar });
    const ventasPrev = prev ? EB.filtrar(d.mart_ventas, DIM_V, prev) : [];
    const npsPrev = prev ? EB.filtrar(d.mart_nps, ["mes", "canal"], prev) : [];
    const usuPrev = prev ? EB.filtrar(d.mart_usuarios, ["mes"], prev) : [];

    // Ventas
    EB.kpi("k-ventas", { valor: fmt.millones(totV), anterior: anterior(totV, EB.suma(ventasPrev, "ventas")) });
    EB.chispa("k-ventas-chispa", EB.serieMensual(ventas, (f) => EB.suma(f, "ventas")), COLOR.ONLINE);
    // Pedidos
    EB.kpi("k-pedidos", { valor: fmt.entero(totP), anterior: anterior(totP, EB.suma(ventasPrev, "pedidos")) });
    EB.chispa("k-pedidos-chispa", EB.serieMensual(ventas, (f) => EB.suma(f, "pedidos")), COLOR.ONLINE);
    // Ticket = ventas / pedidos (se divide después de sumar)
    const ticket = totV / totP;
    const ticketPrev = EB.suma(ventasPrev, "ventas") / EB.suma(ventasPrev, "pedidos");
    EB.kpi("k-ticket", { valor: fmt.miles(ticket), anterior: anterior(ticket, ticketPrev) });
    EB.chispa("k-ticket-chispa", EB.serieMensual(ventas, (f) => EB.suma(f, "ventas") / EB.suma(f, "pedidos")), COLOR.azul);
    // NPS
    const npsVal = EB.nps(EB.suma(npsF, "promotores"), EB.suma(npsF, "detractores"), EB.suma(npsF, "respuestas"));
    const npsPrevVal = EB.nps(EB.suma(npsPrev, "promotores"), EB.suma(npsPrev, "detractores"), EB.suma(npsPrev, "respuestas"));
    EB.kpi("k-nps", {
      valor: fmt.dec(npsVal) + "<small>puntos</small>",
      anterior: anterior(npsVal, npsPrevVal),
      formatoDelta: (x) => fmt.dec(Math.abs(x)) + " puntos",
    });
    EB.chispa("k-nps-chispa", EB.serieMensual(npsF, (f) => EB.nps(EB.suma(f, "promotores"), EB.suma(f, "detractores"), EB.suma(f, "respuestas"))), COLOR.OFFLINE);
    // Usuarios activos: promedio de los meses (el conteo distinto ya viene del ETL)
    const usuProm = EB.suma(usu, "usuarios_activos") / usu.length;
    const usuPrevProm = EB.suma(usuPrev, "usuarios_activos") / usuPrev.length;
    EB.kpi("k-usuarios", { valor: fmt.entero(usuProm), anterior: anterior(usuProm, usuPrevProm) });
    EB.chispa("k-usuarios-chispa", EB.serieMensual(usu, (f) => EB.suma(f, "usuarios_activos")), COLOR.azul);

    // ---- Ventas mensuales por canal (barras apiladas) ----
    const canales = EB.filtros.canal === EB.TODOS ? EB.opciones.canales : [EB.filtros.canal];
    const series = canales.map((c) => ({
      name: c,
      type: "bar",
      stack: "v",
      barMaxWidth: 34,
      itemStyle: { color: COLOR[c], borderColor: COLOR.superficie, borderWidth: 1, borderRadius: c === canales[canales.length - 1] ? [4, 4, 0, 0] : 0 },
      data: EB.serieMensual(ventas.filter((f) => f.canal === c), (f) => EB.suma(f, "ventas")),
    }));
    EB.grafico("g-mensual", {
      legend: { top: 0, left: 0 },
      grid: { top: 36 },
      tooltip: EB.tooltipEje(fmt.millones),
      xAxis: { type: "category", data: meses.map(EB.etiquetaMes) },
      yAxis: { type: "value", axisLabel: { formatter: (v) => "$" + fmt.corto(v) } },
      series,
    });
    EB.tabla("g-mensual", ["Mes"].concat(canales, ["Total"]), meses.map((m, i) => {
      const vals = series.map((s) => s.data[i]);
      return [EB.etiquetaMes(m)].concat(vals.map(fmt.millones), [fmt.millones(vals.reduce((a, b) => a + b, 0))]);
    }));

    // ---- Participación por canal ----
    const porCanal = EB.agruparLista(ventas, "canal", ["ventas", "pedidos"]).sort((a, b) => a.canal.localeCompare(b.canal));
    EB.grafico("g-canal", {
      tooltip: { trigger: "item", formatter: (p) => p.marker + p.name + "<br><b>" + fmt.millones(p.value) + "</b> (" + p.percent.toLocaleString("es-AR") + "%)" },
      legend: { bottom: 0, left: "center" },
      series: [{
        type: "pie",
        radius: ["50%", "80%"],
        center: ["50%", "45%"],
        padAngle: 2,
        itemStyle: { borderRadius: 4, borderColor: COLOR.superficie, borderWidth: 2 },
        label: { position: "inside", color: "#fff", fontSize: 14, fontWeight: 700, formatter: (p) => p.percent.toLocaleString("es-AR", { maximumFractionDigits: 1 }) + "%" },
        data: porCanal.map((c) => ({ name: c.canal, value: c.ventas, itemStyle: { color: COLOR[c.canal] } })),
      }],
    });
    EB.tabla("g-canal", ["Canal", "Ventas", "Pedidos", "Participación"], porCanal.map((c) => [c.canal, fmt.millones(c.ventas), fmt.entero(c.pedidos), fmt.pct(c.ventas / totV)]));

    // ---- Hallazgos (período completo, sin filtros) ----
    hallazgos(d);
  },
});

let hallazgosListos = false;
function hallazgos(d) {
  if (hallazgosListos) return;
  hallazgosListos = true;
  const { fmt } = EB;

  // 1) Mes con entregas más lentas contra la mediana de los meses
  const porMes = EB.agruparLista(d.mart_logistica, "mes", ["entregados", "dias_entrega_suma"])
    .map((m) => ({ mes: m.mes, dias: m.dias_entrega_suma / m.entregados }))
    .sort((a, b) => b.dias - a.dias);
  const peor = porMes[0];
  const ord = porMes.map((m) => m.dias).sort((a, b) => a - b);
  const mediana = ord[Math.floor(ord.length / 2)];
  document.getElementById("h-entrega").textContent = fmt.dec(peor.dias) + " días";
  document.getElementById("h-entrega-txt").textContent =
    "tardaron en promedio las entregas de " + EB.etiquetaMesLarga(peor.mes) + ", contra " + fmt.dec(mediana) +
    " de un mes normal. En esos meses cae el NPS del canal online.";

  // 2) Brecha de NPS entre canales
  const porCanal = EB.agruparLista(d.mart_nps, "canal", ["respuestas", "promotores", "detractores"]);
  const n = {};
  porCanal.forEach((c) => (n[c.canal] = EB.nps(c.promotores, c.detractores, c.respuestas)));
  document.getElementById("h-nps").textContent = fmt.dec(n.OFFLINE - n.ONLINE) + " puntos";
  document.getElementById("h-nps-txt").textContent =
    "de diferencia de NPS entre las tiendas (" + fmt.dec(n.OFFLINE) + ") y el sitio web (" + fmt.dec(n.ONLINE) + "). La experiencia online es el punto débil.";

  // 3) Compradores recurrentes
  const nuevos = EB.suma(d.mart_clientes_mes, "compradores_nuevos");
  const recur = EB.suma(d.mart_clientes_mes, "compradores_recurrentes");
  document.getElementById("h-recurrentes").textContent = fmt.pct(recur / (nuevos + recur), 0);
  document.getElementById("h-recurrentes-txt").textContent =
    "de los compradores de cada mes ya habían comprado antes. El negocio se sostiene en clientes que vuelven.";

  // 4) Domingo en tiendas
  const dias = EB.agruparLista(d.mart_dia_semana, ["canal", "dia_num", "dia"], ["ventas"]);
  const off = dias.filter((x) => x.canal === "OFFLINE").sort((a, b) => b.ventas - a.ventas);
  const on = dias.filter((x) => x.canal === "ONLINE").sort((a, b) => b.ventas - a.ventas);
  const domingoOff = off.find((x) => x.dia_num === 7);
  document.getElementById("h-domingo").textContent = domingoOff ? fmt.millones(domingoOff.ventas) : "$0";
  document.getElementById("h-domingo-txt").textContent =
    "vendieron las tiendas los domingos: no abren. Su mejor día es el " + off[0].dia.toLowerCase() +
    "; la web, en cambio, vende todos los días y su pico es el " + on[0].dia.toLowerCase() + ".";
}
