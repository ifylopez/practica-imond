/* Clientes y web: usuarios activos, tráfico, recurrencia y cohortes */
EB.pagina({
  id: "clientes",
  marts: ["mart_usuarios", "mart_trafico", "mart_clientes_mes", "mart_cohortes"],
  filtros: ["mes"],
  render(d) {
    const { fmt, COLOR } = EB;
    const meses = EB.mesesElegidos();
    const usu = EB.filtrar(d.mart_usuarios, ["mes"]);
    const traf = EB.filtrar(d.mart_trafico, ["mes"]);
    const cli = EB.filtrar(d.mart_clientes_mes, ["mes"]);
    const ejeMeses = { type: "category", data: meses.map(EB.etiquetaMes) };

    // ---- KPIs ----
    const sesiones = EB.suma(traf, "sesiones");
    const ident = EB.suma(traf, "sesiones_identificadas");
    EB.kpi("k-usuarios", { valor: fmt.entero(EB.suma(usu, "usuarios_activos") / usu.length) });
    EB.kpi("k-sesiones", { valor: fmt.entero(sesiones) });
    EB.kpi("k-ident", { valor: fmt.pct(ident / sesiones) });
    EB.kpi("k-minutos", { valor: fmt.dec(EB.suma(traf, "minutos_suma") / EB.suma(traf, "sesiones_con_fin")) + "<small>min</small>" });

    // ---- Usuarios activos ----
    const usuarios = EB.serieMensual(usu, (f) => EB.suma(f, "usuarios_activos"));
    EB.grafico("g-usuarios", {
      grid: { top: 16 },
      tooltip: Object.assign(EB.tooltipEje(fmt.entero), { axisPointer: { type: "shadow", shadowStyle: { color: "rgba(196,184,255,0.06)" } } }),
      xAxis: ejeMeses,
      yAxis: { type: "value" },
      series: [{ name: "Usuarios activos", type: "bar", barMaxWidth: 28, itemStyle: { color: COLOR.azul, borderRadius: [4, 4, 0, 0] }, data: usuarios }],
    });
    EB.tabla("g-usuarios", ["Mes", "Usuarios activos"], meses.map((m, i) => [EB.etiquetaMes(m), fmt.entero(usuarios[i])]));
    document.getElementById("t-usuarios").textContent = usuarios.length > 1 && usuarios[0]
      ? "Los usuarios activos pasaron de " + fmt.entero(usuarios[0]) + " a " + fmt.entero(usuarios[usuarios.length - 1]) + " por mes"
      : "Usuarios activos por mes";

    // ---- Identificadas vs anónimas ----
    const sesIdent = EB.serieMensual(traf, (f) => EB.suma(f, "sesiones_identificadas"));
    const sesAnon = EB.serieMensual(traf, (f) => EB.suma(f, "sesiones") - EB.suma(f, "sesiones_identificadas"));
    EB.grafico("g-anon", {
      legend: { top: 0, left: 0 }, grid: { top: 36 },
      tooltip: Object.assign(EB.tooltipEje(fmt.entero), { axisPointer: { type: "shadow", shadowStyle: { color: "rgba(196,184,255,0.06)" } } }),
      xAxis: ejeMeses,
      yAxis: { type: "value", axisLabel: { formatter: fmt.corto } },
      series: [
        { name: "Identificadas", type: "bar", stack: "s", barMaxWidth: 28, itemStyle: { color: COLOR.azul, borderColor: COLOR.superficie, borderWidth: 1 }, data: sesIdent },
        { name: "Anónimas", type: "bar", stack: "s", barMaxWidth: 28, itemStyle: { color: COLOR.gris, borderColor: COLOR.superficie, borderWidth: 1, borderRadius: [4, 4, 0, 0] }, data: sesAnon },
      ],
    });
    EB.tabla("g-anon", ["Mes", "Identificadas", "Anónimas", "% identificadas"], meses.map((m, i) => [EB.etiquetaMes(m), fmt.entero(sesIdent[i]), fmt.entero(sesAnon[i]), fmt.pct(sesIdent[i] / (sesIdent[i] + sesAnon[i]))]));
    document.getElementById("t-anon").textContent = "El " + fmt.pct(1 - ident / sesiones, 0) + " de las sesiones son anónimas";

    // ---- Fuente x dispositivo (un solo tono, del claro al oscuro) ----
    const fuentes = EB.agruparLista(traf, ["fuente_desc"], ["sesiones", "sesiones_identificadas"]).sort((a, b) => a.sesiones - b.sesiones);
    const dispositivos = ["mobile", "desktop", "tablet"];
    const NOMBRE_DISP = { mobile: "Celular", desktop: "Computadora", tablet: "Tablet" };
    const TONO = { mobile: "#5B8DEF", desktop: "#3C64B8", tablet: "#9DB9F5" };
    const fd = EB.agrupar(traf, ["fuente_desc", "dispositivo"], ["sesiones"]);
    EB.grafico("g-fuente", {
      legend: { top: 0, left: 0 }, grid: { top: 36, right: 60 },
      tooltip: Object.assign(EB.tooltipEje(fmt.entero), { axisPointer: { type: "shadow", shadowStyle: { color: "rgba(196,184,255,0.06)" } } }),
      xAxis: { type: "value", axisLabel: { formatter: fmt.corto } },
      yAxis: { type: "category", data: fuentes.map((f) => f.fuente_desc), axisLabel: { color: COLOR.tinta, fontSize: 12.5 } },
      series: dispositivos.map((dv, i) => ({
        name: NOMBRE_DISP[dv], type: "bar", stack: "f", barMaxWidth: 26,
        itemStyle: { color: TONO[dv], borderColor: COLOR.superficie, borderWidth: 2, borderRadius: i === dispositivos.length - 1 ? [0, 4, 4, 0] : 0 },
        label: i === dispositivos.length - 1 ? { show: true, position: "right", color: COLOR.niebla, fontSize: 12, formatter: (p) => fmt.pct(fuentes[p.dataIndex].sesiones / sesiones, 0) } : undefined,
        data: fuentes.map((f) => (fd.get(f.fuente_desc + "|" + dv) || { sesiones: 0 }).sesiones),
      })),
    });
    EB.tabla("g-fuente", ["Fuente"].concat(dispositivos.map((x) => NOMBRE_DISP[x]), ["Total", "% identificadas"]),
      fuentes.slice().reverse().map((f) => [f.fuente_desc].concat(dispositivos.map((dv) => fmt.entero((fd.get(f.fuente_desc + "|" + dv) || { sesiones: 0 }).sesiones)), [fmt.entero(f.sesiones), fmt.pct(f.sesiones_identificadas / f.sesiones)])));
    const masIdent = fuentes.slice().sort((a, b) => b.sesiones_identificadas / b.sesiones - a.sesiones_identificadas / a.sesiones)[0];
    document.getElementById("t-fuente").textContent = "La mayoría entra desde el celular; " + masIdent.fuente_desc.toLowerCase() + " trae más clientes identificados (" + fmt.pct(masIdent.sesiones_identificadas / masIdent.sesiones, 0) + ")";

    // ---- Nuevos y recurrentes ----
    const nuevos = EB.serieMensual(cli, (f) => EB.suma(f, "compradores_nuevos"));
    const recur = EB.serieMensual(cli, (f) => EB.suma(f, "compradores_recurrentes"));
    EB.grafico("g-recurrentes", {
      legend: { top: 0, left: 0 }, grid: { top: 36 },
      tooltip: Object.assign(EB.tooltipEje(fmt.entero), { axisPointer: { type: "shadow", shadowStyle: { color: "rgba(196,184,255,0.06)" } } }),
      xAxis: ejeMeses,
      yAxis: { type: "value" },
      series: [
        { name: "Recurrentes", type: "bar", stack: "c", barMaxWidth: 28, itemStyle: { color: COLOR.ONLINE, borderColor: COLOR.superficie, borderWidth: 1 }, data: recur },
        { name: "Nuevos", type: "bar", stack: "c", barMaxWidth: 28, itemStyle: { color: COLOR.azul, borderColor: COLOR.superficie, borderWidth: 1, borderRadius: [4, 4, 0, 0] }, data: nuevos },
      ],
    });
    EB.tabla("g-recurrentes", ["Mes", "Nuevos", "Recurrentes", "% recurrentes"], meses.map((m, i) => [EB.etiquetaMes(m), fmt.entero(nuevos[i]), fmt.entero(recur[i]), fmt.pct(recur[i] / (nuevos[i] + recur[i] || 1))]));
    const totN = nuevos.reduce((a, b) => a + b, 0), totR = recur.reduce((a, b) => a + b, 0);
    document.getElementById("t-recurrentes").textContent = "El " + fmt.pct(totR / (totN + totR), 0) + " de los compradores de cada mes ya había comprado antes";

    cohortes(d.mart_cohortes);
  },
});

/* La matriz de cohortes tiene grano fijo: se dibuja una sola vez */
let cohortesListas = false;
function cohortes(filas) {
  if (cohortesListas) return;
  cohortesListas = true;
  const { fmt, COLOR } = EB;
  const lista = [...new Set(filas.map((f) => f.cohorte))].sort();
  const maxK = Math.max(...filas.map((f) => f.meses_desde_alta));
  const ks = Array.from({ length: maxK + 1 }, (_, i) => i);
  const idx = new Map(filas.map((f) => [f.cohorte + "|" + f.meses_desde_alta, f]));
  const tam = new Map(filas.map((f) => [f.cohorte, f.tamano_cohorte]));
  const ultimo = lista[lista.length - 1];
  const mesesEntre = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
  const datos = [];
  lista.forEach((c, y) => ks.forEach((k) => {
    if (k > mesesEntre(c, ultimo)) return; // todavía no pasó ese tiempo
    const f = idx.get(c + "|" + k);
    // Sin fila = nadie de esa cohorte compró ese mes (0%)
    const pct = f ? f.clientes_compradores / tam.get(c) * 100 : 0;
    // Texto oscuro sobre celdas claras para que se lea
    datos.push({ value: [k, y, pct, f ? f.clientes_compradores : 0], label: { color: pct >= 40 ? "#17152e" : "rgba(255,255,255,0.85)" } });
  }));
  const etiquetaC = (c) => EB.etiquetaMes(c + "-01");
  EB.grafico("g-cohortes", {
    grid: { top: 10, left: 8, right: 16, bottom: 56 },
    tooltip: { trigger: "item", formatter: (p) => "Cohorte " + etiquetaC(lista[p.value[1]]) + " (" + fmt.entero(tam.get(lista[p.value[1]])) + " clientes)<br>Mes " + p.value[0] + " desde el alta: <b>" + fmt.dec(p.value[2]) + "%</b> compró (" + fmt.entero(p.value[3]) + ")" },
    xAxis: { type: "category", data: ks.map(String), name: "Meses desde el alta", nameLocation: "middle", nameGap: 26, nameTextStyle: { color: COLOR.tenue }, splitArea: { show: false } },
    yAxis: { type: "category", data: lista.map(etiquetaC), inverse: true },
    visualMap: {
      min: 0, max: 60, calculable: false, orient: "horizontal", right: 16, bottom: 0, itemWidth: 12, itemHeight: 160,
      text: ["60% o más", "0%"], textStyle: { color: COLOR.niebla, fontSize: 12 },
      inRange: { color: ["#1B2A40", "#2D5C8F", "#5B8DEF", "#B8CDF8"] },
    },
    series: [{
      type: "heatmap", data: datos,
      itemStyle: { borderColor: COLOR.superficie, borderWidth: 2, borderRadius: 3 },
      label: { show: true, fontSize: 10, formatter: (p) => Math.round(p.value[2]) },
      emphasis: { itemStyle: { borderColor: "#C9BCFF", borderWidth: 2 } },
    }],
  });
  EB.tabla("g-cohortes", ["Cohorte", "Clientes"].concat(ks.map((k) => "Mes " + k)), lista.map((c) => [etiquetaC(c), fmt.entero(tam.get(c))].concat(ks.map((k) => {
    if (k > mesesEntre(c, ultimo)) return "";
    const f = idx.get(c + "|" + k);
    return fmt.pct(f ? f.clientes_compradores / tam.get(c) : 0, 0);
  }))));
  // Retención promedio al mes 1 (cohortes que ya lo cumplieron)
  const m1 = lista.filter((c) => mesesEntre(c, ultimo) >= 1).map((c) => { const f = idx.get(c + "|1"); return f ? f.clientes_compradores / tam.get(c) : 0; });
  document.getElementById("t-cohortes").textContent =
    "El " + fmt.pct(m1.reduce((x, y) => x + y, 0) / m1.length, 0) + " de los clientes vuelve a comprar al mes siguiente del alta";
}
