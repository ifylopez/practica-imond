/* Experiencia: NPS por canal, puntajes y relación con los tiempos de entrega */
EB.pagina({
  id: "experiencia",
  marts: ["mart_nps", "mart_nps_puntajes", "mart_logistica"],
  filtros: ["mes", "canal"],
  render(d) {
    const { fmt, COLOR } = EB;
    const meses = EB.mesesElegidos();
    const npsDe = (f) => EB.nps(EB.suma(f, "promotores"), EB.suma(f, "detractores"), EB.suma(f, "respuestas"));
    const nps = EB.filtrar(d.mart_nps, ["mes", "canal"]);
    const npsTodos = EB.filtrar(d.mart_nps, ["mes", "canal"], { ignorar: ["canal"] });
    const canales = EB.filtros.canal === EB.TODOS ? EB.opciones.canales : [EB.filtros.canal];
    const GRUPO = { Detractores: COLOR.critico, Pasivos: COLOR.gris, Promotores: COLOR.bien };
    const grupoDe = (s) => (s <= 6 ? "Detractores" : s <= 8 ? "Pasivos" : "Promotores");

    // ---- KPIs ----
    EB.kpi("k-nps", { valor: fmt.dec(npsDe(nps)) + "<small>puntos</small>" });
    EB.kpi("k-off", { valor: fmt.dec(npsDe(npsTodos.filter((f) => f.canal === "OFFLINE"))) + "<small>puntos</small>" });
    EB.kpi("k-on", { valor: fmt.dec(npsDe(npsTodos.filter((f) => f.canal === "ONLINE"))) + "<small>puntos</small>" });
    EB.kpi("k-resp", { valor: fmt.entero(EB.suma(nps, "respuestas")) });

    // ---- NPS online vs días de entrega: dos paneles alineados (no doble eje) ----
    const npsOn = EB.serieMensual(npsTodos.filter((f) => f.canal === "ONLINE"), (f) => (f.length ? npsDe(f) : null));
    const log = EB.filtrar(d.mart_logistica, ["mes"]).filter((f) => f.canal === "ONLINE");
    const dias = EB.serieMensual(log, (f) => { const e = EB.suma(f, "entregados"); return e ? EB.suma(f, "dias_entrega_suma") / e : null; });
    const diasOrden = dias.filter((x) => x != null).slice().sort((a, b) => a - b);
    const mediana = diasOrden[Math.floor(diasOrden.length / 2)];
    const lento = (v) => v != null && v > mediana * 1.5; // meses con entregas 50% más lentas que lo normal
    const etiquetas = meses.map(EB.etiquetaMes);
    EB.grafico("g-relacion", {
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      tooltip: { trigger: "axis", axisPointer: { type: "line", lineStyle: { color: "rgba(196,184,255,0.4)" } },
        formatter: (ps) => ps[0].axisValue + ps.map((p) => "<br>" + p.marker + p.seriesName + ": <b>" + (p.value == null ? "sin datos" : p.seriesIndex === 0 ? fmt.dec(p.value) + " puntos" : fmt.dec(p.value) + " días") + "</b>").join("") },
      grid: [{ left: 8, right: 16, top: 26, height: "38%", containLabel: true }, { left: 8, right: 16, top: "60%", bottom: 8, containLabel: true }],
      xAxis: [
        { type: "category", data: etiquetas, gridIndex: 0, axisLabel: { show: false }, boundaryGap: true },
        { type: "category", data: etiquetas, gridIndex: 1, boundaryGap: true },
      ],
      yAxis: [
        { type: "value", gridIndex: 0, name: "NPS online", nameTextStyle: { align: "left" }, splitNumber: 3 },
        { type: "value", gridIndex: 1, name: "Días de entrega", nameTextStyle: { align: "left" }, splitNumber: 3 },
      ],
      series: [
        { name: "NPS online", type: "line", xAxisIndex: 0, yAxisIndex: 0, symbol: "circle", symbolSize: 8,
          lineStyle: { width: 2, color: COLOR.ONLINE }, itemStyle: { color: COLOR.ONLINE, borderColor: COLOR.superficie, borderWidth: 2 },
          data: npsOn },
        { name: "Días promedio de entrega", type: "bar", xAxisIndex: 1, yAxisIndex: 1, barMaxWidth: 26,
          data: dias.map((v) => ({ value: v, itemStyle: { color: lento(v) ? COLOR.alerta : "rgba(201,188,255,0.35)", borderRadius: [4, 4, 0, 0] } })),
          label: { show: true, position: "top", fontSize: 11, color: COLOR.niebla, formatter: (p) => (lento(p.value) ? fmt.dec(p.value) : "") },
          markLine: { silent: true, symbol: "none", label: { color: COLOR.tenue, fontSize: 11, formatter: "Mediana " + fmt.dec(mediana || 0) + " días", position: "insideEndTop" }, lineStyle: { color: COLOR.tenue, type: "dashed" }, data: mediana ? [{ yAxis: mediana }] : [] } },
      ],
    });
    EB.tabla("g-relacion", ["Mes", "NPS online", "Días promedio de entrega"], meses.map((m, i) => [etiquetas[i], npsOn[i] == null ? "sin datos" : fmt.dec(npsOn[i]), dias[i] == null ? "sin datos" : fmt.dec(dias[i])]));

    // ---- NPS mensual por canal ----
    const series = canales.map((c) => ({
      name: c, type: "line", symbol: "circle", symbolSize: 7, showSymbol: meses.length <= 12,
      lineStyle: { width: 2, color: COLOR[c] }, itemStyle: { color: COLOR[c], borderColor: COLOR.superficie, borderWidth: 2 },
      data: EB.serieMensual(nps.filter((f) => f.canal === c), (f) => (f.length ? npsDe(f) : null)),
    }));
    EB.grafico("g-mensual", {
      legend: { top: 0, left: 0 }, grid: { top: 36 },
      tooltip: EB.tooltipEje((v) => fmt.dec(v) + " puntos"),
      xAxis: { type: "category", data: etiquetas, boundaryGap: false },
      yAxis: { type: "value" },
      series,
    });
    EB.tabla("g-mensual", ["Mes"].concat(canales), meses.map((m, i) => [etiquetas[i]].concat(series.map((s) => (s.data[i] == null ? "sin datos" : fmt.dec(s.data[i]))))));

    // ---- Distribución de puntajes ----
    const punt = EB.filtrar(d.mart_nps_puntajes, ["mes", "canal"]);
    const porPuntaje = EB.agrupar(punt, "puntaje", ["respuestas"]);
    const totResp = EB.suma(punt, "respuestas");
    const valores = Array.from({ length: 11 }, (_, s) => (porPuntaje.get(String(s)) || porPuntaje.get(s) || { respuestas: 0 }).respuestas);
    EB.grafico("g-puntajes", {
      legend: { top: 0, left: 0, data: Object.keys(GRUPO) },
      grid: { top: 36 },
      tooltip: { trigger: "item", formatter: (p) => "Puntaje " + p.name + " (" + grupoDe(+p.name).toLowerCase() + ")<br><b>" + fmt.entero(p.value) + "</b> respuestas, " + fmt.pct(p.value / totResp) },
      xAxis: { type: "category", data: valores.map((_, s) => String(s)) },
      yAxis: { type: "value" },
      // Una serie por grupo para que la leyenda explique el color
      series: Object.keys(GRUPO).map((g) => ({
        name: g, type: "bar", stack: "p", barMaxWidth: 34,
        itemStyle: { color: GRUPO[g], borderRadius: [4, 4, 0, 0] },
        data: valores.map((v, s) => (grupoDe(s) === g ? v : null)),
      })),
    });
    EB.tabla("g-puntajes", ["Puntaje", "Grupo", "Respuestas", "% del total"], valores.map((v, s) => [s, grupoDe(s), fmt.entero(v), fmt.pct(v / totResp)]));
    const moda = valores.indexOf(Math.max(...valores));
    document.getElementById("t-puntajes").textContent = "El puntaje más frecuente es " + moda + ", pero hay una cola larga de detractores";

    // ---- Grupos por canal (100%) ----
    const grupos = EB.agruparLista(npsTodos, "canal", ["respuestas", "promotores", "detractores"]).sort((a, b) => a.canal.localeCompare(b.canal));
    const pctGrupo = (c, g) => (g === "Promotores" ? c.promotores : g === "Detractores" ? c.detractores : c.respuestas - c.promotores - c.detractores) / c.respuestas * 100;
    const orden = ["Detractores", "Pasivos", "Promotores"];
    EB.grafico("g-grupos", {
      legend: { top: 0, left: 0 }, grid: { top: 36, right: 16 },
      tooltip: { trigger: "item", formatter: (p) => p.marker + p.seriesName + " en " + p.name + "<br><b>" + fmt.dec(p.value) + "%</b>" },
      xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%" } },
      yAxis: { type: "category", data: grupos.map((c) => c.canal), axisLabel: { color: COLOR.tinta, fontSize: 13 } },
      series: orden.map((g, i) => ({
        name: g, type: "bar", stack: "g", barMaxWidth: 40,
        itemStyle: { color: GRUPO[g], borderColor: COLOR.superficie, borderWidth: 2, borderRadius: i === orden.length - 1 ? [0, 4, 4, 0] : i === 0 ? [4, 0, 0, 4] : 0 },
        label: { show: true, color: "#fff", fontWeight: 700, formatter: (p) => fmt.dec(p.value, 0) + "%" },
        data: grupos.map((c) => pctGrupo(c, g)),
      })),
    });
    EB.tabla("g-grupos", ["Canal", "Respuestas", "Promotores", "Pasivos", "Detractores", "NPS"], grupos.map((c) => [c.canal, fmt.entero(c.respuestas), fmt.dec(pctGrupo(c, "Promotores")) + "%", fmt.dec(pctGrupo(c, "Pasivos")) + "%", fmt.dec(pctGrupo(c, "Detractores")) + "%", fmt.dec(EB.nps(c.promotores, c.detractores, c.respuestas))]));
  },
});
