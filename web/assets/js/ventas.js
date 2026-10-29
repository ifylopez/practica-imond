/* Ventas: mapa, provincias, día de la semana, estacionalidad, pedidos y ticket */
(async function () {
  // El mapa se registra una sola vez (GeoJSON de Natural Earth, dominio público)
  const geo = await fetch("assets/data/argentina.geojson").then((r) => r.json());
  echarts.registerMap("argentina", geo);

  EB.pagina({
    id: "ventas",
    marts: ["mart_ventas", "mart_dia_semana"],
    filtros: ["mes", "canal", "provincia"],
    render(d) {
      const { fmt, COLOR } = EB;
      const meses = EB.mesesElegidos();
      const canales = EB.filtros.canal === EB.TODOS ? EB.opciones.canales : [EB.filtros.canal];
      const ventas = EB.filtrar(d.mart_ventas, ["mes", "canal", "provincia"]);

      // ---------------- Mapa (no se filtra por provincia: las muestra todas) ----------------
      const sinProv = EB.filtrar(d.mart_ventas, ["mes", "canal", "provincia"], { ignorar: ["provincia"] });
      const porProv = EB.agruparLista(sinProv, "provincia", ["ventas", "pedidos"]).sort((a, b) => b.ventas - a.ventas);
      const totalProv = EB.suma(porProv, "ventas");
      const elegida = EB.filtros.provincia;
      const maxV = Math.max(...porProv.map((p) => p.ventas), 1);
      const conDatos = new Set(porProv.map((p) => p.provincia));
      const g = EB.grafico("g-mapa", {
        tooltip: {
          trigger: "item",
          formatter: (p) => {
            const f = porProv.find((x) => x.provincia === p.name);
            if (!f) return p.name + "<br><span style='color:#a9a3c9'>Sin pedidos</span>";
            return "<b>" + p.name + "</b><br>" + fmt.millones(f.ventas) + " (" + fmt.pct(f.ventas / totalProv) + ")<br>" + fmt.entero(f.pedidos) + " pedidos";
          },
        },
        visualMap: {
          type: "continuous",
          min: 0,
          max: maxV,
          seriesIndex: 0,
          orient: "horizontal",
          left: "center",
          bottom: 0,
          itemWidth: 12,
          itemHeight: 160,
          text: [fmt.millones(maxV, 0), "$0"],
          textStyle: { color: COLOR.niebla, fontSize: 12 },
          calculable: false,
          // Secuencial de un solo tono: oscuro = poco, brillante = mucho
          inRange: { color: ["#1E4A4C", "#25A898", "#8DE3D3"] },
          outOfRange: { color: "rgba(255,255,255,0.06)" },
        },
        series: [{
          type: "map",
          map: "argentina",
          aspectScale: 0.8,
          layoutCenter: ["50%", "46%"],
          layoutSize: "128%",
          selectedMode: false,
          itemStyle: { areaColor: "rgba(255,255,255,0.06)", borderColor: "rgba(16,14,38,0.9)", borderWidth: 1 },
          emphasis: { label: { show: false }, itemStyle: { areaColor: null, borderColor: "#C9BCFF", borderWidth: 2 } },
          label: { show: false },
          data: geo.features.map((f) => {
            const n = f.properties.name;
            const row = porProv.find((x) => x.provincia === n);
            const item = { name: n, value: row ? row.ventas : NaN };
            if (!conDatos.has(n)) item.itemStyle = { areaColor: "rgba(255,255,255,0.06)" };
            if (n === elegida) item.itemStyle = Object.assign({}, item.itemStyle, { borderColor: "#C9BCFF", borderWidth: 2.5 });
            return item;
          }),
        }],
      });
      EB.tabla("g-mapa", ["Provincia", "Ventas", "Pedidos", "Participación"], porProv.map((p) => [p.provincia, fmt.millones(p.ventas), fmt.entero(p.pedidos), fmt.pct(p.ventas / totalProv)]));
      g.off("click");
      g.on("click", (p) => { if (conDatos.has(p.name)) EB.fijarFiltro("provincia", p.name); });

      // ---------------- Provincias por canal (barras horizontales apiladas) ----------------
      const provs = porProv.map((p) => p.provincia).reverse(); // la mayor arriba
      const provCanal = EB.agrupar(sinProv, ["provincia", "canal"], ["ventas", "pedidos"]);
      EB.grafico("g-provincias", {
        legend: { top: 0, left: 0 },
        grid: { top: 36, right: 70 },
        tooltip: Object.assign(EB.tooltipEje(fmt.millones), { axisPointer: { type: "shadow", shadowStyle: { color: "rgba(196,184,255,0.06)" } } }),
        xAxis: { type: "value", axisLabel: { formatter: (v) => "$" + fmt.corto(v) } },
        yAxis: { type: "category", data: provs, axisLabel: { color: COLOR.tinta, fontSize: 13 } },
        series: canales.map((c, i) => ({
          name: c,
          type: "bar",
          stack: "p",
          barMaxWidth: 26,
          itemStyle: {
            color: COLOR[c], borderColor: COLOR.superficie, borderWidth: 1,
            borderRadius: i === canales.length - 1 ? [0, 4, 4, 0] : 0,
            opacity: 1,
          },
          label: i === canales.length - 1 ? {
            show: true, position: "right", color: COLOR.niebla, fontSize: 12,
            formatter: (p) => fmt.pct((porProv.find((x) => x.provincia === p.name) || { ventas: 0 }).ventas / totalProv, 0),
          } : undefined,
          data: provs.map((p) => {
            const v = (provCanal.get(p + "|" + c) || { ventas: 0 }).ventas;
            return { value: v, itemStyle: elegida !== EB.TODOS && p !== elegida ? { opacity: 0.35 } : undefined };
          }),
        })),
      });
      const ticketProv = porProv.map((p) => ({ provincia: p.provincia, ticket: p.ventas / p.pedidos }));
      EB.grafico("g-ticket-prov", {
        grid: { top: 12, right: 70 },
        tooltip: { trigger: "item", formatter: (p) => p.name + "<br><b>" + fmt.miles(p.value) + "</b> por pedido" },
        xAxis: { type: "value", min: 0, axisLabel: { formatter: (v) => "$" + fmt.corto(v) } },
        yAxis: { type: "category", data: provs, axisLabel: { color: COLOR.tinta, fontSize: 13 } },
        series: [{
          type: "bar",
          barMaxWidth: 14,
          itemStyle: { color: COLOR.azul, borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: "right", color: COLOR.niebla, fontSize: 12, formatter: (p) => fmt.miles(p.value) },
          data: provs.map((p) => ticketProv.find((x) => x.provincia === p).ticket),
        }],
      });
      EB.tabla("g-provincias", ["Provincia"].concat(canales, ["Total", "Participación", "Ticket"]), porProv.map((p) =>
        [p.provincia].concat(canales.map((c) => fmt.millones((provCanal.get(p.provincia + "|" + c) || { ventas: 0 }).ventas)), [fmt.millones(p.ventas), fmt.pct(p.ventas / totalProv), fmt.miles(p.ventas / p.pedidos)])
      ));

      // ---------------- Día de la semana ----------------
      const dias = EB.filtrar(d.mart_dia_semana, ["mes", "canal", "provincia"]);
      const NOMBRES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
      const diaCanal = EB.agrupar(dias, ["dia_num", "canal"], ["ventas", "pedidos"]);
      const valorDia = (n, c) => (diaCanal.get(n + "|" + c) || { ventas: 0 }).ventas;
      EB.grafico("g-dias", {
        legend: { top: 0, left: 0 },
        grid: { top: 36 },
        tooltip: Object.assign(EB.tooltipEje(fmt.millones), { axisPointer: { type: "shadow", shadowStyle: { color: "rgba(196,184,255,0.06)" } } }),
        xAxis: { type: "category", data: NOMBRES.map((n) => n.slice(0, 3)) },
        yAxis: { type: "value", axisLabel: { formatter: (v) => "$" + fmt.corto(v) } },
        series: canales.map((c) => ({
          name: c, type: "bar", barMaxWidth: 22, barGap: "12%",
          itemStyle: { color: COLOR[c], borderRadius: [4, 4, 0, 0] },
          data: NOMBRES.map((_, i) => valorDia(i + 1, c)),
        })),
      });
      EB.tabla("g-dias", ["Día"].concat(canales), NOMBRES.map((n, i) => [n].concat(canales.map((c) => fmt.millones(valorDia(i + 1, c))))));

      // ---------------- Estacionalidad: mes del año, una línea por año ----------------
      const anios = [...new Set(meses.map((m) => m.slice(0, 4)))];
      const porMes = EB.agrupar(ventas, "mes", ["ventas"]);
      const COLOR_ANIO = { 2024: COLOR.azul, 2025: COLOR.verde };
      const MESES12 = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
      const serieAnio = (a) => MESES12.map((_, i) => {
        const m = a + "-" + String(i + 1).padStart(2, "0") + "-01";
        return meses.includes(m) ? (porMes.get(m) || { ventas: 0 }).ventas : null;
      });
      EB.grafico("g-estacion", {
        legend: { top: 0, left: 0 },
        grid: { top: 36 },
        tooltip: EB.tooltipEje(fmt.millones),
        xAxis: { type: "category", data: MESES12, boundaryGap: false },
        yAxis: { type: "value", axisLabel: { formatter: (v) => "$" + fmt.corto(v) } },
        series: anios.map((a) => ({
          name: a, type: "line", smooth: false, symbol: "circle", symbolSize: 8, connectNulls: false,
          lineStyle: { width: 2, color: COLOR_ANIO[a] || COLOR.verde },
          itemStyle: { color: COLOR_ANIO[a] || COLOR.verde, borderColor: COLOR.superficie, borderWidth: 2 },
          data: serieAnio(a),
        })),
      });
      EB.tabla("g-estacion", ["Mes"].concat(anios), MESES12.map((m, i) => [m].concat(anios.map((a) => { const v = serieAnio(a)[i]; return v == null ? "sin datos" : fmt.millones(v); }))));

      // ---------------- Pedidos y ticket mensual por canal ----------------
      const lineaCanal = (c, fn) => ({
        name: c, type: "line", smooth: false, symbol: "circle", symbolSize: 7, showSymbol: meses.length <= 12,
        lineStyle: { width: 2, color: COLOR[c] }, itemStyle: { color: COLOR[c], borderColor: COLOR.superficie, borderWidth: 2 },
        data: EB.serieMensual(ventas.filter((f) => f.canal === c), fn),
      });
      const pedidosSeries = canales.map((c) => lineaCanal(c, (f) => EB.suma(f, "pedidos")));
      EB.grafico("g-pedidos", {
        legend: { top: 0, left: 0 }, grid: { top: 36 },
        tooltip: EB.tooltipEje(fmt.entero),
        xAxis: { type: "category", data: meses.map(EB.etiquetaMes), boundaryGap: false },
        yAxis: { type: "value" },
        series: pedidosSeries,
      });
      EB.tabla("g-pedidos", ["Mes"].concat(canales), meses.map((m, i) => [EB.etiquetaMes(m)].concat(pedidosSeries.map((s) => fmt.entero(s.data[i])))));

      const ticketSeries = canales.map((c) => lineaCanal(c, (f) => { const p = EB.suma(f, "pedidos"); return p ? EB.suma(f, "ventas") / p : null; }));
      EB.grafico("g-ticket", {
        legend: { top: 0, left: 0 }, grid: { top: 36 },
        tooltip: EB.tooltipEje((v) => fmt.miles(v)),
        xAxis: { type: "category", data: meses.map(EB.etiquetaMes), boundaryGap: false },
        yAxis: { type: "value", scale: true, axisLabel: { formatter: (v) => "$" + fmt.corto(v) } },
        series: ticketSeries,
      });
      EB.tabla("g-ticket", ["Mes"].concat(canales), meses.map((m, i) => [EB.etiquetaMes(m)].concat(ticketSeries.map((s) => (s.data[i] == null ? "sin datos" : fmt.miles(s.data[i]))))));

      // Título dinámico del mapa
      const top = porProv[0];
      document.getElementById("t-mapa").textContent = top
        ? top.provincia + " concentra el " + fmt.pct(top.ventas / totalProv, 0) + " de las ventas"
        : "Ventas por provincia de destino";
    },
  });
})();
