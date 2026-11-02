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
    EB.chispa("k-ventas-chispa", EB.serieMensual(ventas, (f) => EB.suma(f, "ventas")), COLOR.marca);
    // Pedidos
    EB.kpi("k-pedidos", { valor: fmt.entero(totP), anterior: anterior(totP, EB.suma(ventasPrev, "pedidos")) });
    EB.chispa("k-pedidos-chispa", EB.serieMensual(ventas, (f) => EB.suma(f, "pedidos")), COLOR.marca);
    // Ticket = ventas / pedidos (se divide después de sumar)
    const ticket = totV / totP;
    const ticketPrev = EB.suma(ventasPrev, "ventas") / EB.suma(ventasPrev, "pedidos");
    EB.kpi("k-ticket", { valor: fmt.miles(ticket), anterior: anterior(ticket, ticketPrev) });
    EB.chispa("k-ticket-chispa", EB.serieMensual(ventas, (f) => EB.suma(f, "ventas") / EB.suma(f, "pedidos")), COLOR.marca);
    // NPS
    const npsVal = EB.nps(EB.suma(npsF, "promotores"), EB.suma(npsF, "detractores"), EB.suma(npsF, "respuestas"));
    const npsPrevVal = EB.nps(EB.suma(npsPrev, "promotores"), EB.suma(npsPrev, "detractores"), EB.suma(npsPrev, "respuestas"));
    EB.kpi("k-nps", {
      valor: fmt.dec(npsVal) + "<small>puntos</small>",
      anterior: anterior(npsVal, npsPrevVal),
      formatoDelta: (x) => fmt.dec(Math.abs(x)) + " puntos",
    });
    EB.chispa("k-nps-chispa", EB.serieMensual(npsF, (f) => EB.nps(EB.suma(f, "promotores"), EB.suma(f, "detractores"), EB.suma(f, "respuestas"))), COLOR.marca);
    // Usuarios activos: promedio de los meses (el conteo distinto ya viene del ETL)
    const usuProm = EB.suma(usu, "usuarios_activos") / usu.length;
    const usuPrevProm = EB.suma(usuPrev, "usuarios_activos") / usuPrev.length;
    EB.kpi("k-usuarios", { valor: fmt.entero(usuProm), anterior: anterior(usuProm, usuPrevProm) });
    // Total con sesiones anónimas: cada sesión anónima cuenta como un usuario (columna calculada en el ETL)
    const altProm = EB.suma(usu, "usuarios_con_anonimos") / usu.length;
    document.getElementById("k-usuarios-alt").innerHTML = "<strong>" + fmt.entero(altProm) + "</strong> en total por mes, sumando las sesiones anónimas";
    EB.chispa("k-usuarios-chispa", EB.serieMensual(usu, (f) => EB.suma(f, "usuarios_activos")), COLOR.marca);

    // ---- Ventas mensuales por canal (barras apiladas) ----
    const canales = EB.filtros.canal === EB.TODOS ? EB.opciones.canales : [EB.filtros.canal];
    const series = canales.map((c) => ({
      name: c,
      type: "bar",
      stack: "v",
      barMaxWidth: 34,
      itemStyle: { color: COLOR[c], borderColor: COLOR.superficie, borderWidth: 1, borderRadius: 0 },
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
    const porCanal = EB.agruparLista(ventas, "canal", ["ventas", "pedidos"]).sort((a, b) => b.ventas - a.ventas);
    EB.grafico("g-canal", {
      grid: { top: 8, right: 64, bottom: 8 },
      tooltip: { trigger: "item", formatter: (p) => p.name + "<br><b>" + fmt.millones(porCanal[p.dataIndex].ventas) + "</b> (" + fmt.pct(p.value) + ")" },
      xAxis: { type: "value", max: 1, show: false },
      yAxis: { type: "category", data: porCanal.map((c) => c.canal), inverse: true, axisLine: { show: false }, axisLabel: { color: COLOR.tinta, fontSize: 13 } },
      series: [{
        type: "bar", barWidth: 18,
        showBackground: true, backgroundStyle: { color: COLOR.grilla },
        label: { show: true, position: "right", color: COLOR.tinta, fontWeight: 600, formatter: (p) => fmt.pct(p.value) },
        data: porCanal.map((c) => ({ value: c.ventas / totV, itemStyle: { color: COLOR[c.canal] } })),
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

  // 1) Crecimiento por canal: meses del último año contra los mismos meses del año anterior
  const ultimoAnio = EB.opciones.meses[EB.opciones.meses.length - 1].slice(0, 4);
  const mesesUlt = EB.opciones.meses.filter((m) => m.startsWith(ultimoAnio));
  const mesesAnt = mesesUlt.map(EB.mesAnterior);
  const ventasDe = (canal, meses) => EB.suma(d.mart_ventas.filter((f) => f.canal === canal && meses.includes(f.mes)), "ventas");
  const crec = (canal) => ventasDe(canal, mesesUlt) / ventasDe(canal, mesesAnt) - 1;
  const signo = (x, dec = 0) => (x >= 0 ? "+" : "−") + fmt.pct(Math.abs(x), dec);
  const rango = EB.etiquetaMes(mesesUlt[0]).slice(0, 3) + "–" + EB.etiquetaMes(mesesUlt[mesesUlt.length - 1]).slice(0, 3);
  document.getElementById("h-crecimiento").textContent = signo(crec("ONLINE"));
  document.getElementById("h-crecimiento-txt").textContent =
    "crecieron las ventas online en " + rango + " de " + ultimoAnio + " contra el mismo período de " + (+ultimoAnio - 1) + ". " +
    "Las tiendas quedaron casi iguales (" + signo(crec("OFFLINE"), 1) + "): todo el crecimiento viene de la web.";

  // 2) Brecha de NPS entre canales y en cuántos meses las tiendas superan a la web
  const porCanal = EB.agruparLista(d.mart_nps, "canal", ["respuestas", "promotores", "detractores"]);
  const n = {};
  porCanal.forEach((c) => (n[c.canal] = EB.nps(c.promotores, c.detractores, c.respuestas)));
  const porMesCanal = EB.agrupar(d.mart_nps, ["mes", "canal"], ["respuestas", "promotores", "detractores"]);
  const npsMes = (m, c) => { const f = porMesCanal.get(m + "|" + c); return f ? EB.nps(f.promotores, f.detractores, f.respuestas) : NaN; };
  const ganaTienda = EB.opciones.meses.filter((m) => npsMes(m, "OFFLINE") > npsMes(m, "ONLINE")).length;
  document.getElementById("h-nps").textContent = fmt.dec(n.OFFLINE - n.ONLINE) + " puntos";
  document.getElementById("h-nps-txt").textContent =
    "de diferencia de NPS entre las tiendas (" + fmt.dec(n.OFFLINE) + ") y el sitio web (" + fmt.dec(n.ONLINE) + "). " +
    (ganaTienda === EB.opciones.meses.length
      ? "Las tiendas superan a la web en todos los meses (" + ganaTienda + ")."
      : "Las tiendas superan a la web en " + ganaTienda + " de los " + EB.opciones.meses.length + " meses.");

  // 3) Meses con entregas lentas (más de 1,5 veces la mediana mensual)
  const porMes = EB.agruparLista(d.mart_logistica, "mes", ["entregados", "dias_entrega_suma"])
    .map((m) => ({ mes: m.mes, dias: m.dias_entrega_suma / m.entregados }));
  const ord = porMes.map((m) => m.dias).sort((a, b) => a - b);
  const mediana = ord[Math.floor(ord.length / 2)];
  const lentos = porMes.filter((m) => m.dias > mediana * 1.5).sort((a, b) => a.mes.localeCompare(b.mes));
  const peor = porMes.slice().sort((a, b) => b.dias - a.dias)[0];
  const nombres = lentos.map((m) => EB.etiquetaMesLarga(m.mes).replace(/ de \d{4}$/, ""));
  document.getElementById("h-entrega").textContent = fmt.dec(peor.dias) + " días";
  document.getElementById("h-entrega-txt").textContent =
    "tardaron en promedio las entregas de " + EB.etiquetaMesLarga(peor.mes) + ", contra " + fmt.dec(mediana) + " en un mes normal. " +
    (lentos.length > 1
      ? "Los meses con entregas lentas (" + nombres.join(" y ") + " de " + peor.mes.slice(0, 4) + ") coinciden con la caída del NPS online."
      : "Ese mes coincide con la caída del NPS online.");

  // 4) Compradores recurrentes en el último año (los primeros meses no tienen historia previa)
  const ult = d.mart_clientes_mes.filter((f) => String(f.mes).startsWith(ultimoAnio));
  const pctMes = ult.map((f) => f.compradores_recurrentes / f.compradores);
  document.getElementById("h-recurrentes").textContent = fmt.pct(EB.suma(ult, "compradores_recurrentes") / EB.suma(ult, "compradores"), 0);
  document.getElementById("h-recurrentes-txt").textContent =
    "de los compradores de cada mes de " + ultimoAnio + " ya habían comprado antes (entre " + fmt.pct(Math.min(...pctMes), 0) +
    " y " + fmt.pct(Math.max(...pctMes), 0) + " según el mes). La mayoría de quienes compran cada mes son clientes que vuelven.";
}
