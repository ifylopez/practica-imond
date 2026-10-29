/* Productos: facturación, unidades, participación y ranking mensual */
EB.pagina({
  id: "productos",
  marts: ["mart_productos"],
  filtros: ["mes", "canal", "provincia", "producto"],
  render(d) {
    const { fmt, COLOR } = EB;
    const DIMS = ["mes", "canal", "provincia", "producto"];
    const filas = EB.filtrar(d.mart_productos, DIMS);
    const meses = EB.mesesElegidos();
    const productos = EB.filtros.producto === EB.TODOS ? EB.opciones.productos : [EB.filtros.producto];

    // ---- KPIs ----
    const fact = EB.suma(filas, "ventas_productos");
    const unid = EB.suma(filas, "unidades");
    EB.kpi("k-fact", { valor: fmt.millones(fact) });
    EB.kpi("k-unid", { valor: fmt.entero(unid) });
    EB.kpi("k-precio", { valor: fmt.miles(fact / unid) });
    EB.chispa("k-fact-chispa", EB.serieMensual(filas, (f) => EB.suma(f, "ventas_productos")), COLOR.ONLINE);
    EB.chispa("k-unid-chispa", EB.serieMensual(filas, (f) => EB.suma(f, "unidades")), COLOR.ONLINE);
    EB.chispa("k-precio-chispa", EB.serieMensual(filas, (f) => { const u = EB.suma(f, "unidades"); return u ? EB.suma(f, "ventas_productos") / u : null; }), COLOR.azul);

    // ---- Facturación mensual por producto ----
    const series = productos.map((p) => ({
      name: p, type: "line", symbol: "circle", symbolSize: 7, showSymbol: meses.length <= 12,
      lineStyle: { width: 2, color: COLOR[p] }, itemStyle: { color: COLOR[p], borderColor: COLOR.superficie, borderWidth: 2 },
      data: EB.serieMensual(filas.filter((f) => f.producto === p), (f) => EB.suma(f, "ventas_productos")),
    }));
    EB.grafico("g-mensual", {
      legend: { top: 0, left: 0 }, grid: { top: 36 },
      tooltip: EB.tooltipEje(fmt.millones),
      xAxis: { type: "category", data: meses.map(EB.etiquetaMes), boundaryGap: false },
      yAxis: { type: "value", axisLabel: { formatter: (v) => "$" + fmt.corto(v) } },
      series,
    });
    EB.tabla("g-mensual", ["Mes"].concat(productos), meses.map((m, i) => [EB.etiquetaMes(m)].concat(series.map((s) => fmt.millones(s.data[i])))));

    // ---- Participación ----
    const porProd = EB.agruparLista(filas, "producto", ["ventas_productos", "unidades"]).sort((a, b) => a.producto.localeCompare(b.producto));
    EB.grafico("g-share", {
      tooltip: { trigger: "item", formatter: (p) => p.marker + p.name + "<br><b>" + fmt.millones(p.value) + "</b> (" + p.percent.toLocaleString("es-AR") + "%)" },
      legend: { bottom: 0, left: "center" },
      series: [{
        type: "pie", radius: ["50%", "80%"], center: ["50%", "45%"], padAngle: 2,
        itemStyle: { borderRadius: 4, borderColor: COLOR.superficie, borderWidth: 2 },
        label: { position: "inside", color: "#fff", fontSize: 14, fontWeight: 700, formatter: (p) => p.percent.toLocaleString("es-AR", { maximumFractionDigits: 1 }) + "%" },
        data: porProd.map((p) => ({ name: p.producto, value: p.ventas_productos, itemStyle: { color: COLOR[p.producto] } })),
      }],
    });
    EB.tabla("g-share", ["Producto", "Facturación", "Unidades", "Precio medio", "Participación"],
      porProd.map((p) => [p.producto, fmt.millones(p.ventas_productos), fmt.entero(p.unidades), fmt.miles(p.ventas_productos / p.unidades), fmt.pct(p.ventas_productos / fact)]));

    // ---- Unidades contra facturación (100%) ----
    EB.grafico("g-mix", {
      legend: { top: 0, left: 0 }, grid: { top: 36, right: 24 },
      tooltip: { trigger: "item", formatter: (p) => p.marker + p.seriesName + "<br>" + p.name + ": <b>" + fmt.pct(p.value / 100) + "</b>" },
      xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%" } },
      yAxis: { type: "category", data: ["Unidades", "Facturación"], axisLabel: { color: COLOR.tinta, fontSize: 13 } },
      series: porProd.map((p, i) => ({
        name: p.producto, type: "bar", stack: "m", barMaxWidth: 40,
        itemStyle: { color: COLOR[p.producto], borderColor: COLOR.superficie, borderWidth: 2, borderRadius: i === porProd.length - 1 ? [0, 4, 4, 0] : 0 },
        label: { show: true, color: "#fff", fontWeight: 700, formatter: (x) => fmt.pct(x.value / 100, 0) },
        data: [p.unidades / unid * 100, p.ventas_productos / fact * 100],
      })),
    });
    EB.tabla("g-mix", ["Producto", "% de unidades", "% de facturación"], porProd.map((p) => [p.producto, fmt.pct(p.unidades / unid), fmt.pct(p.ventas_productos / fact)]));
    const caro = porProd.slice().sort((a, b) => b.ventas_productos / b.unidades - a.ventas_productos / a.unidades)[0];
    document.getElementById("t-mix").textContent = porProd.length > 1
      ? caro.producto + " pesa más en la facturación que en las unidades"
      : "Unidades contra facturación";

    // ---- Ranking mensual (siempre con todos los productos, como RANKX) ----
    const todos = EB.filtrar(d.mart_productos, DIMS, { ignorar: ["producto"] });
    const porMesProd = EB.agrupar(todos, ["mes", "producto"], ["ventas_productos"]);
    const ranking = meses.map((m) => EB.opciones.productos
      .map((p) => ({ producto: p, ventas: (porMesProd.get(m + "|" + p) || { ventas_productos: 0 }).ventas_productos }))
      .sort((a, b) => b.ventas - a.ventas));
    const puestos = EB.opciones.productos.map((_, i) => i);
    EB.grafico("g-ranking", {
      grid: { top: 8, left: 8, right: 8, bottom: 8 },
      tooltip: { trigger: "item", formatter: (p) => { const r = ranking[p.dataIndex][p.seriesIndex]; return meses[p.dataIndex] ? EB.etiquetaMes(meses[p.dataIndex]) + ", puesto " + (p.seriesIndex + 1) + "<br>" + r.producto + ": <b>" + fmt.millones(r.ventas) + "</b>" : ""; } },
      xAxis: { type: "category", data: meses.map(EB.etiquetaMes), axisLine: { show: false } },
      yAxis: { type: "value", show: false, max: puestos.length, inverse: true },
      series: puestos.map((i) => ({
        type: "bar", stack: "r", barCategoryGap: "8%",
        itemStyle: { borderColor: COLOR.superficie, borderWidth: 2, borderRadius: 4 },
        label: { show: meses.length <= 21, color: "#fff", fontSize: 11, fontWeight: 700, formatter: (p) => i + 1 + "º" },
        data: ranking.map((r) => ({ value: 1, itemStyle: { color: COLOR[r[i].producto] } })),
      })),
    });
    document.getElementById("ley-ranking").innerHTML = EB.opciones.productos.map((p) => '<span><i style="background:' + COLOR[p] + '"></i>' + p + "</span>").join("");
    EB.tabla("g-ranking", ["Mes"].concat(puestos.map((i) => "Puesto " + (i + 1))), ranking.map((r, k) => [EB.etiquetaMes(meses[k])].concat(r.map((x) => x.producto + " (" + fmt.millones(x.ventas) + ")"))));
    const lider = EB.opciones.productos.map((p) => ({ p, n: ranking.filter((r) => r[0].producto === p).length })).sort((a, b) => b.n - a.n)[0];
    document.getElementById("t-ranking").textContent = lider.p + " fue el primero en " + lider.n + " de " + meses.length + " meses";
  },
});
