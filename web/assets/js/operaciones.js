/* Operaciones: estados, cancelaciones, medios de pago y tiempos de entrega */
EB.pagina({
  id: "operaciones",
  marts: ["mart_estados", "mart_pagos", "mart_logistica"],
  filtros: ["mes", "canal", "provincia"],
  render(d) {
    const { fmt, COLOR } = EB;
    const DIMS = ["mes", "canal", "provincia"];
    const meses = EB.mesesElegidos();
    const estados = EB.filtrar(d.mart_estados, DIMS);
    const pagos = EB.filtrar(d.mart_pagos, DIMS);
    const log = EB.filtrar(d.mart_logistica, DIMS);
    const canales = EB.filtros.canal === EB.TODOS ? EB.opciones.canales : [EB.filtros.canal];
    const sombra = { type: "shadow", shadowStyle: { color: "rgba(196,184,255,0.06)" } };

    // ---- KPIs ----
    const totPed = EB.suma(estados, "pedidos");
    const vendidos = EB.suma(estados.filter((f) => f.estado === "PAID" || f.estado === "FULFILLED"), "pedidos");
    const cancel = pagos.filter((f) => f.estado_pedido === "Cancelado");
    const cancelReemb = EB.suma(cancel.filter((f) => f.estado_pago === "Reembolsado"), "pagos");
    const entregados = EB.suma(log, "entregados");
    const lentas = EB.suma(log, "entregas_mas_7_dias");
    EB.kpi("k-pedidos", { valor: fmt.entero(totPed) });
    EB.kpi("k-venta", { valor: fmt.pct(vendidos / totPed) });
    EB.kpi("k-cancel", { valor: fmt.entero(cancelReemb) });
    document.getElementById("k-cancel-nota").textContent = "De " + fmt.entero(EB.suma(cancel, "pagos")) + " pedidos cancelados; el resto tuvo el pago rechazado.";
    EB.kpi("k-lentas", { valor: fmt.pct(entregados ? lentas / entregados : 0) });
    document.getElementById("k-lentas-nota").textContent = fmt.entero(lentas) + " de " + fmt.entero(entregados) + " entregas. Promedio: " + fmt.dec(entregados ? EB.suma(log, "dias_entrega_suma") / entregados : 0) + " días.";

    // ---- Estados del pedido ----
    const COLOR_ESTADO = { CREATED: COLOR.gris, PAID: COLOR.azul, FULFILLED: COLOR.bien, CANCELLED: COLOR.critico, REFUNDED: COLOR.alerta };
    const porEstado = EB.agruparLista(estados, ["orden", "estado", "estado_desc"], ["pedidos", "monto"]).sort((a, b) => b.orden - a.orden);
    EB.grafico("g-estados", {
      grid: { top: 8, right: 90 },
      tooltip: { trigger: "item", formatter: (p) => { const e = porEstado[p.dataIndex]; return "<b>" + e.estado_desc + "</b><br>" + fmt.entero(e.pedidos) + " pedidos (" + fmt.pct(e.pedidos / totPed) + ")<br>" + fmt.millones(e.monto); } },
      xAxis: { type: "value", axisLabel: { formatter: fmt.corto } },
      yAxis: { type: "category", data: porEstado.map((e) => e.estado_desc), axisLabel: { color: COLOR.tinta, fontSize: 13 } },
      series: [{
        type: "bar", barMaxWidth: 28,
        label: { show: true, position: "right", color: COLOR.niebla, fontSize: 12, formatter: (p) => fmt.entero(p.value) + " (" + fmt.pct(p.value / totPed, 1) + ")" },
        data: porEstado.map((e) => ({ value: e.pedidos, itemStyle: { color: COLOR_ESTADO[e.estado], borderRadius: [0, 4, 4, 0] } })),
      }],
    });
    EB.tabla("g-estados", ["Estado", "Pedidos", "% del total", "Monto"], porEstado.slice().reverse().map((e) => [e.estado_desc, fmt.entero(e.pedidos), fmt.pct(e.pedidos / totPed), fmt.millones(e.monto)]));
    const ent = porEstado.find((e) => e.estado === "FULFILLED");
    if (ent) document.getElementById("t-estados").textContent = fmt.pct(ent.pedidos / totPed, 0) + " de los pedidos llegan a entregarse";

    // ---- Cancelados según el pago ----
    const porPagoCancel = EB.agruparLista(cancel, "estado_pago", ["pagos", "monto"]).sort((a, b) => a.pagos - b.pagos);
    const COLOR_PAGO = { Reembolsado: COLOR.alerta, Rechazado: COLOR.critico, Pendiente: COLOR.gris, Pagado: COLOR.bien };
    EB.grafico("g-cancel", {
      grid: { top: 8, right: 60 },
      tooltip: { trigger: "item", formatter: (p) => { const e = porPagoCancel[p.dataIndex]; return "Pago " + e.estado_pago.toLowerCase() + "<br><b>" + fmt.entero(e.pagos) + "</b> pedidos cancelados<br>" + fmt.millones(e.monto); } },
      xAxis: { type: "value", axisLabel: { formatter: fmt.corto } },
      yAxis: { type: "category", data: porPagoCancel.map((e) => "Pago " + e.estado_pago.toLowerCase()), axisLabel: { color: COLOR.tinta, fontSize: 13 } },
      series: [{
        type: "bar", barMaxWidth: 32,
        label: { show: true, position: "right", color: COLOR.niebla, formatter: (p) => fmt.entero(p.value) },
        data: porPagoCancel.map((e) => ({ value: e.pagos, itemStyle: { color: COLOR_PAGO[e.estado_pago] || COLOR.gris, borderRadius: [0, 4, 4, 0] } })),
      }],
    });
    EB.tabla("g-cancel", ["Estado del pago", "Pedidos cancelados", "Monto"], porPagoCancel.slice().reverse().map((e) => [e.estado_pago, fmt.entero(e.pagos), fmt.millones(e.monto)]));
    document.getElementById("t-cancel").textContent = fmt.entero(cancelReemb) + " cancelados tuvieron el pago reembolsado";

    // ---- Medios de pago por canal (pagos concretados) ----
    const concretados = pagos.filter((f) => f.estado_pago === "Pagado");
    const medios = EB.agruparLista(concretados, "medio", ["pagos"]).sort((a, b) => b.pagos - a.pagos).map((m) => m.medio);
    // Medios = categoría nominal sin color propio: un solo tono con etiquetas directas
    const TONOS = ["#2F4F9A", "#6F9BF2", "#A9C2F7", "#DCE6FC"];
    const mc = EB.agrupar(concretados, ["canal", "medio"], ["pagos"]);
    const totCanal = EB.agrupar(concretados, "canal", ["pagos"]);
    const pctMC = (c, m) => ((mc.get(c + "|" + m) || { pagos: 0 }).pagos / ((totCanal.get(c) || { pagos: 1 }).pagos || 1)) * 100;
    EB.grafico("g-medios", {
      legend: { top: 0, left: 0 }, grid: { top: 36, right: 16 },
      tooltip: { trigger: "item", formatter: (p) => p.marker + p.seriesName + " en " + p.name + "<br><b>" + fmt.dec(p.value) + "%</b> de los pagos" },
      xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%" } },
      yAxis: { type: "category", data: canales, axisLabel: { color: COLOR.tinta, fontSize: 13 } },
      series: medios.map((m, i) => ({
        name: m, type: "bar", stack: "m", barMaxWidth: 44,
        itemStyle: { color: TONOS[i % TONOS.length], borderColor: COLOR.superficie, borderWidth: 2, borderRadius: i === medios.length - 1 ? [0, 4, 4, 0] : i === 0 ? [4, 0, 0, 4] : 0 },
        label: { show: true, color: i >= 2 ? "#17152e" : "#fff", fontWeight: 700, formatter: (p) => (p.value >= 7 ? fmt.dec(p.value, 0) + "%" : "") },
        data: canales.map((c) => pctMC(c, m)),
      })),
    });
    EB.tabla("g-medios", ["Canal"].concat(medios), canales.map((c) => [c].concat(medios.map((m) => fmt.dec(pctMC(c, m)) + "%"))));
    // Título: qué medios usa cada canal (los que superan el 1% de sus pagos)
    const usa = (c) => medios.filter((m) => pctMC(c, m) >= 1).map((m) => m.toLowerCase());
    const unir = (l) => (l.length > 1 ? l.slice(0, -1).join(", ") + " y " + l[l.length - 1] : l[0] || "");
    document.getElementById("t-medios").textContent = canales.length > 1
      ? "Las tiendas cobran con " + unir(usa("OFFLINE")) + "; la web, con " + unir(usa("ONLINE"))
      : "Medios de pago del canal " + canales[0];

    // ---- Tasa de rechazo por medio ----
    const porMedio = EB.agruparLista(pagos, "medio", ["pagos"]);
    const rech = EB.agrupar(pagos.filter((f) => f.estado_pago === "Rechazado"), "medio", ["pagos"]);
    const tasas = porMedio.map((m) => ({ medio: m.medio, intentos: m.pagos, rechazados: (rech.get(m.medio) || { pagos: 0 }).pagos }))
      .map((m) => Object.assign(m, { tasa: m.rechazados / m.intentos })).sort((a, b) => a.tasa - b.tasa);
    EB.grafico("g-rechazo", {
      grid: { top: 8, right: 60 },
      tooltip: { trigger: "item", formatter: (p) => { const m = tasas[p.dataIndex]; return m.medio + "<br><b>" + fmt.pct(m.tasa) + "</b> rechazados (" + fmt.entero(m.rechazados) + " de " + fmt.entero(m.intentos) + ")"; } },
      xAxis: { type: "value", axisLabel: { formatter: (v) => v + "%" } },
      yAxis: { type: "category", data: tasas.map((m) => m.medio), axisLabel: { color: COLOR.tinta, fontSize: 13 } },
      series: [{
        type: "bar", barMaxWidth: 26,
        itemStyle: { color: COLOR.critico, borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: "right", color: COLOR.niebla, formatter: (p) => fmt.dec(p.value) + "%" },
        data: tasas.map((m) => m.tasa * 100),
      }],
    });
    EB.tabla("g-rechazo", ["Medio", "Intentos", "Rechazados", "% rechazado"], tasas.slice().reverse().map((m) => [m.medio, fmt.entero(m.intentos), fmt.entero(m.rechazados), fmt.pct(m.tasa)]));
    const peorMedio = tasas[tasas.length - 1];
    if (peorMedio) document.getElementById("t-rechazo").textContent = peorMedio.medio + " es el medio con más rechazos (" + fmt.pct(peorMedio.tasa, 0) + ")";

    // ---- Días de entrega por provincia (todas las provincias) ----
    const logTodas = EB.filtrar(d.mart_logistica, DIMS, { ignorar: ["provincia"] });
    const porProv = EB.agruparLista(logTodas, "provincia", ["entregados", "dias_entrega_suma", "entregas_mas_7_dias"])
      .filter((p) => p.entregados > 0)
      .map((p) => Object.assign(p, { dias: p.dias_entrega_suma / p.entregados })).sort((a, b) => a.dias - b.dias);
    const elegida = EB.filtros.provincia;
    EB.grafico("g-prov", {
      grid: { top: 8, right: 70 },
      tooltip: { trigger: "item", formatter: (p) => { const r = porProv[p.dataIndex]; return r.provincia + "<br><b>" + fmt.dec(r.dias) + " días</b> en promedio<br>" + fmt.entero(r.entregados) + " entregas"; } },
      xAxis: { type: "value", axisLabel: { formatter: (v) => v + " d" } },
      yAxis: { type: "category", data: porProv.map((p) => p.provincia), axisLabel: { color: COLOR.tinta, fontSize: 13 } },
      series: [{
        type: "bar", barMaxWidth: 26,
        label: { show: true, position: "right", color: COLOR.niebla, formatter: (p) => fmt.dec(p.value) + " días" },
        data: porProv.map((p) => ({ value: p.dias, itemStyle: { color: COLOR.azul, opacity: elegida !== EB.TODOS && p.provincia !== elegida ? 0.35 : 1, borderRadius: [0, 4, 4, 0] } })),
      }],
    });
    EB.tabla("g-prov", ["Provincia", "Entregas", "Días promedio", "% más de 7 días"], porProv.slice().reverse().map((p) => [p.provincia, fmt.entero(p.entregados), fmt.dec(p.dias), fmt.pct(p.entregas_mas_7_dias / p.entregados)]));
    const lenta = porProv[porProv.length - 1], rapida = porProv[0];
    if (lenta && rapida && lenta !== rapida) document.getElementById("t-prov").textContent = "A " + rapida.provincia + " se entrega en " + fmt.dec(rapida.dias) + " días; a " + lenta.provincia + ", en " + fmt.dec(lenta.dias);

    // ---- Entregas lentas por mes ----
    const pctLentas = EB.serieMensual(log, (f) => { const e = EB.suma(f, "entregados"); return e ? EB.suma(f, "entregas_mas_7_dias") / e * 100 : null; });
    const max = Math.max(...pctLentas.filter((v) => v != null));
    EB.grafico("g-lentas", {
      grid: { top: 16 },
      tooltip: Object.assign(EB.tooltipEje((v) => fmt.dec(v) + "%"), { axisPointer: sombra }),
      xAxis: { type: "category", data: meses.map(EB.etiquetaMes) },
      yAxis: { type: "value", axisLabel: { formatter: "{value}%" } },
      series: [{
        name: "Más de 7 días", type: "bar", barMaxWidth: 26,
        data: pctLentas.map((v) => ({ value: v, itemStyle: { color: v != null && v >= max * 0.6 ? COLOR.alerta : "rgba(201,188,255,0.35)", borderRadius: [4, 4, 0, 0] } })),
      }],
    });
    EB.tabla("g-lentas", ["Mes", "% de entregas de más de 7 días"], meses.map((m, i) => [EB.etiquetaMes(m), pctLentas[i] == null ? "sin datos" : fmt.dec(pctLentas[i]) + "%"]));
    const iMax = pctLentas.indexOf(max);
    if (iMax >= 0) document.getElementById("t-lentas").textContent = "En " + EB.etiquetaMesLarga(meses[iMax]) + " el " + fmt.dec(max, 0) + "% de las entregas tardó más de 7 días";
  },
});
