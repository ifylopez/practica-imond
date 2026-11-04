/* =====================================================================
   core.js: piezas compartidas por todas las páginas
   ---------------------------------------------------------------------
   * Carga los marts (dw/*.csv) con PapaParse.
   * Filtros globales (período, canal, provincia, producto), guardados en
     el navegador para que se mantengan al cambiar de página.
   * Agregaciones mínimas: filtrar, sumar y dividir. Es lo mismo que hacían
     las medidas DAX en Power BI. Todo lo pesado ya viene hecho del ETL.
   * Tema de ECharts, formatos de números y la vista de tabla de cada gráfico.
   ===================================================================== */
(function () {
  "use strict";

  const DW = "../dw/";
  const CLAVE_FILTROS = "ecobottle-filtros-v1";

  // ------------------------------------------------------------------
  // Paleta sobre fondo blanco (validada para contraste y daltonismo).
  // El color sigue a la entidad: cada canal y cada producto tiene el suyo
  // en todas las páginas. Las series sueltas usan el color de marca.
  // ------------------------------------------------------------------
  const COLOR = {
    OFFLINE: "#4A63C9",
    ONLINE: "#008A7B",
    "Classic A Bottle": "#B5701A",
    "Sport B Bottle": "#9E3D8F",
    marca: "#0B4A45",
    marcaClara: "#7FBFB5",
    gris: "#A3ADAA",
    bien: "#2E7D4F",
    alerta: "#D97706",
    critico: "#B42318",
    tinta: "#13201F",
    niebla: "#4E5D5A",
    tenue: "#6B7875",
    borde: "#DADFDC",
    grilla: "#ECEFED",
    superficie: "#FFFFFF",
  };
  // Orden categórico fijo para categorías sin color propio
  const CATEGORICO = ["#008A7B", "#4A63C9", "#B5701A", "#9E3D8F", "#0B4A45", "#6B7875"];

  // ------------------------------------------------------------------
  // Formatos (es-AR)
  // ------------------------------------------------------------------
  const nf = (dec) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const fmt = {
    entero: (v) => nf(0).format(v),
    dec: (v, d = 1) => nf(d).format(v),
    pct: (v, d = 1) => nf(d).format(v * 100) + "%",
    millones: (v, d = 2) => "$" + nf(d).format(v / 1e6) + "M",
    miles: (v, d = 1) => "$" + nf(d).format(v / 1e3) + "K",
    plata: (v) => (Math.abs(v) >= 1e6 ? fmt.millones(v) : fmt.miles(v)),
    corto: (v) => (Math.abs(v) >= 1e6 ? nf(1).format(v / 1e6) + "M" : Math.abs(v) >= 1e3 ? nf(0).format(v / 1e3) + "K" : nf(0).format(v)),
  };
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  // "2024-07-01" -> "jul 24"
  const etiquetaMes = (m) => MESES[+m.slice(5, 7) - 1] + " " + m.slice(2, 4);
  const etiquetaMesLarga = (m) => MESES_LARGO[+m.slice(5, 7) - 1] + " de " + m.slice(0, 4);
  // Resta 12 meses a "AAAA-MM-01"
  const mesAnterior = (m) => String(+m.slice(0, 4) - 1) + m.slice(4);

  // ------------------------------------------------------------------
  // Carga de datos
  // ------------------------------------------------------------------
  const cache = {};
  function cargarCSV(nombre) {
    if (!cache[nombre]) {
      cache[nombre] = new Promise((ok, mal) => {
        Papa.parse(DW + nombre + ".csv", {
          download: true,
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (r) => {
            // "mes" queda como texto AAAA-MM-01 (sirve para ordenar y comparar)
            r.data.forEach((f) => { if (f.mes instanceof Date) f.mes = f.mes.toISOString().slice(0, 10); });
            ok(r.data);
          },
          error: (e) => mal(new Error("No se pudo leer dw/" + nombre + ".csv (" + e + ")")),
        });
      });
    }
    return cache[nombre];
  }
  async function cargar(nombres) {
    const filas = await Promise.all(nombres.map(cargarCSV));
    const out = {};
    nombres.forEach((n, i) => (out[n] = filas[i]));
    return out;
  }

  // ------------------------------------------------------------------
  // Filtros globales
  // ------------------------------------------------------------------
  const TODOS = "Todos";
  let filtros = { desde: null, hasta: null, canal: TODOS, provincia: TODOS, producto: TODOS };
  let opciones = { meses: [], canales: [], provincias: [], productos: [] };

  function leerGuardados() {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE_FILTROS) || "null");
      if (g && typeof g === "object") Object.assign(filtros, g);
    } catch (e) { /* sin almacenamiento: se usan los valores por defecto */ }
  }
  function guardar() {
    try { localStorage.setItem(CLAVE_FILTROS, JSON.stringify(filtros)); } catch (e) { /* sin almacenamiento */ }
  }
  function validarFiltros() {
    const m = opciones.meses;
    if (!m.includes(filtros.desde)) filtros.desde = m[0];
    if (!m.includes(filtros.hasta)) filtros.hasta = m[m.length - 1];
    if (filtros.desde > filtros.hasta) [filtros.desde, filtros.hasta] = [filtros.hasta, filtros.desde];
    if (filtros.canal !== TODOS && !opciones.canales.includes(filtros.canal)) filtros.canal = TODOS;
    if (filtros.provincia !== TODOS && !opciones.provincias.includes(filtros.provincia)) filtros.provincia = TODOS;
    if (filtros.producto !== TODOS && !opciones.productos.includes(filtros.producto)) filtros.producto = TODOS;
  }

  /**
   * Filtra filas de un mart. `dims` dice qué columnas del mart se pueden
   * filtrar (es la "aplicabilidad" que se muestra al pie de cada gráfico).
   * opts.ignorar: dimensiones a no filtrar (p. ej. el mapa no filtra por
   * provincia, porque muestra todas).
   */
  function filtrar(filas, dims, opts = {}) {
    const ign = new Set(opts.ignorar || []);
    const desde = opts.desde || filtros.desde;
    const hasta = opts.hasta || filtros.hasta;
    return filas.filter((f) =>
      (!dims.includes("mes") || ign.has("mes") || (f.mes >= desde && f.mes <= hasta)) &&
      (!dims.includes("canal") || ign.has("canal") || filtros.canal === TODOS || f.canal === filtros.canal) &&
      (!dims.includes("provincia") || ign.has("provincia") || filtros.provincia === TODOS || f.provincia === filtros.provincia) &&
      (!dims.includes("producto") || ign.has("producto") || filtros.producto === TODOS || f.producto === filtros.producto)
    );
  }

  /** Meses del período elegido (para ejes X completos) */
  const mesesElegidos = () => opciones.meses.filter((m) => m >= filtros.desde && m <= filtros.hasta);

  /** ¿Existen los mismos meses del año anterior? (para la variación interanual) */
  function periodoAnterior() {
    const sel = mesesElegidos();
    const prev = sel.map(mesAnterior);
    if (!prev.every((m) => opciones.meses.includes(m))) return null;
    return { desde: prev[0], hasta: prev[prev.length - 1] };
  }

  // ------------------------------------------------------------------
  // Agregaciones mínimas (suma y agrupación)
  // ------------------------------------------------------------------
  const suma = (filas, col) => filas.reduce((a, f) => a + (+f[col] || 0), 0);

  /** Agrupa por una o varias columnas y suma las medidas. Devuelve un Map. */
  function agrupar(filas, claves, medidas) {
    claves = [].concat(claves);
    const m = new Map();
    for (const f of filas) {
      const k = claves.map((c) => f[c]).join("|");
      let g = m.get(k);
      if (!g) {
        g = {};
        claves.forEach((c) => (g[c] = f[c]));
        medidas.forEach((x) => (g[x] = 0));
        m.set(k, g);
      }
      medidas.forEach((x) => (g[x] += +f[x] || 0));
    }
    return m;
  }
  /** Igual que agrupar pero devuelve un array */
  const agruparLista = (filas, claves, medidas) => Array.from(agrupar(filas, claves, medidas).values());

  /** Serie mensual: un valor por cada mes del período (0 si no hay filas) */
  function serieMensual(filas, fn) {
    const porMes = new Map();
    filas.forEach((f) => { if (!porMes.has(f.mes)) porMes.set(f.mes, []); porMes.get(f.mes).push(f); });
    return mesesElegidos().map((m) => fn(porMes.get(m) || []));
  }

  // ------------------------------------------------------------------
  // ECharts: tema y utilidades
  // ------------------------------------------------------------------
  const tema = {
    color: CATEGORICO,
    backgroundColor: "transparent",
    textStyle: { fontFamily: "Public Sans, Segoe UI, system-ui, sans-serif", color: COLOR.niebla },
    grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
    categoryAxis: {
      axisLine: { lineStyle: { color: COLOR.tinta } },
      axisTick: { show: false },
      axisLabel: { color: COLOR.tenue, fontSize: 12 },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: COLOR.tenue, fontSize: 12 },
      splitLine: { lineStyle: { color: COLOR.grilla } },
      nameTextStyle: { color: COLOR.tenue, fontSize: 12 },
    },
    legend: { textStyle: { color: COLOR.niebla, fontSize: 12.5 }, icon: "rect", itemWidth: 10, itemHeight: 10, itemGap: 18 },
    tooltip: {
      backgroundColor: "#FFFFFF",
      borderColor: COLOR.borde,
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: COLOR.tinta, fontSize: 13 },
      extraCssText: "border-radius:4px;box-shadow:0 4px 16px rgba(19,32,31,.12);",
    },
    line: { symbolSize: 8, lineStyle: { width: 2 } },
    bar: { itemStyle: { borderRadius: 0 } },
  };
  echarts.registerTheme("ecobottle", tema);

  const graficos = new Map();
  function grafico(id, opcion) {
    const el = document.getElementById(id);
    if (!el) return null;
    let g = graficos.get(id);
    if (!g || g.isDisposed()) {
      g = echarts.init(el, "ecobottle", { renderer: "canvas" });
      graficos.set(id, g);
    }
    const reducido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    g.setOption(Object.assign({ animation: !reducido, animationDuration: 500 }, opcion), true);
    return g;
  }
  let pendienteResize = null;
  window.addEventListener("resize", () => {
    clearTimeout(pendienteResize);
    pendienteResize = setTimeout(() => graficos.forEach((g) => g.resize()), 120);
  });

  /** Tooltip de eje con valores formateados */
  function tooltipEje(formato) {
    return {
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: COLOR.tenue } },
      valueFormatter: (v) => (v == null || Number.isNaN(v) ? "sin datos" : formato(v)),
    };
  }

  // ------------------------------------------------------------------
  // Tarjetas: pie con filtros que aplican + vista de tabla
  // ------------------------------------------------------------------
  const NOMBRE_DIM = { mes: "período", canal: "canal", provincia: "provincia", producto: "producto" };
  const tablas = new Map();

  /** Guarda la tabla que muestra "Ver tabla" en la tarjeta del gráfico `id` */
  function tabla(id, columnas, filas) {
    tablas.set(id, { columnas, filas });
    const cont = document.querySelector('[data-tabla-de="' + id + '"]');
    if (cont && !cont.hidden) pintarTabla(cont, id);
  }
  function pintarTabla(cont, id) {
    const t = tablas.get(id);
    if (!t) { cont.innerHTML = '<p class="nota" style="padding:10px">Sin datos para mostrar.</p>'; return; }
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    cont.innerHTML =
      "<table><thead><tr>" + t.columnas.map((c) => "<th>" + esc(c) + "</th>").join("") + "</tr></thead><tbody>" +
      t.filas.map((f) => "<tr>" + f.map((v) => "<td>" + esc(v) + "</td>").join("") + "</tr>").join("") +
      "</tbody></table>";
  }

  /** Arma el pie de cada .tarjeta[data-aplica] (una sola vez) */
  function armarTarjetas() {
    document.querySelectorAll(".tarjeta[data-aplica]").forEach((t) => {
      if (t.querySelector(".tarjeta-pie")) return;
      const dims = t.dataset.aplica.trim() ? t.dataset.aplica.trim().split(/\s+/) : [];
      const fijo = t.dataset.fijo;
      const g = t.querySelector(".grafico");
      const pie = document.createElement("div");
      pie.className = "tarjeta-pie";
      const txt = dims.length
        ? "Responde a: <b>" + dims.map((d) => NOMBRE_DIM[d]).join(", ") + "</b>"
        : "<b>No cambia con los filtros</b>";
      pie.innerHTML = '<span class="aplica">' + txt + (fijo ? ". " + fijo : "") + "</span>";
      if (g && g.id) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "boton-tabla";
        b.textContent = "Ver tabla";
        b.setAttribute("aria-expanded", "false");
        const cont = document.createElement("div");
        cont.className = "tabla-datos";
        cont.hidden = true;
        cont.dataset.tablaDe = g.id;
        b.addEventListener("click", () => {
          cont.hidden = !cont.hidden;
          b.textContent = cont.hidden ? "Ver tabla" : "Ocultar tabla";
          b.setAttribute("aria-expanded", String(!cont.hidden));
          if (!cont.hidden) pintarTabla(cont, g.id);
        });
        pie.appendChild(b);
        t.appendChild(pie);
        t.appendChild(cont);
      } else {
        t.appendChild(pie);
      }
    });
  }

  // ------------------------------------------------------------------
  // Barra superior: marca, pestañas de navegación y filtros
  // ------------------------------------------------------------------
  const PAGINAS = [
    ["resumen", "index.html", "Resumen"],
    ["ventas", "ventas.html", "Ventas"],
    ["productos", "productos.html", "Productos"],
    ["clientes", "clientes.html", "Clientes y web"],
    ["experiencia", "experiencia.html", "Experiencia"],
    ["operaciones", "operaciones.html", "Operaciones"],
    ["guia", "guia.html", "Cómo leer"],
  ];
  function armarBarra(actual) {
    const el = document.getElementById("barra");
    if (!el) return;
    el.innerHTML =
      '<a class="marca" href="index.html">EcoBottle</a>' +
      '<nav class="nav" aria-label="Páginas del tablero">' +
      PAGINAS.map(([k, href, txt]) => '<a href="' + href + '"' + (k === actual ? ' aria-current="page"' : "") + ">" + txt + "</a>").join("") +
      "</nav>";
    // Pie de página con la fuente de los datos y la autoría
    const main = document.getElementById("contenido-pagina");
    if (main && !document.querySelector(".pie-pagina")) {
      const pie = document.createElement("footer");
      pie.className = "pie-pagina";
      pie.innerHTML = 'Datos de EcoBottle AR, enero de 2024 a septiembre de 2025. <a href="https://github.com/ifylopez/practica-imond#readme">Documentación técnica</a>. Mateo Andrés López Valci.';
      main.appendChild(pie);
    }
  }

  // ------------------------------------------------------------------
  // Filtros (se ubican en la barra superior, a la derecha de las pestañas)
  // ------------------------------------------------------------------
  const TEXTO_TODOS = { canal: "Canal: todos", provincia: "Provincia: todas", producto: "Producto: todos" };
  function armarFiltros(usados, alCambiar) {
    const el = document.getElementById("filtros");
    if (!el) return;
    if (!usados.length) { el.remove(); return; }
    const barra = document.getElementById("barra");
    if (barra) barra.appendChild(el);
    const opt = (vals, sel, rotulo = (v) => v) => vals.map((v) => '<option value="' + v + '"' + (v === sel ? " selected" : "") + ">" + rotulo(v) + "</option>").join("");
    let html = "";
    if (usados.includes("mes")) {
      html +=
        '<span class="filtro-periodo">' +
        '<select id="f-desde" aria-label="Período desde">' + opt(opciones.meses, filtros.desde, etiquetaMes) + "</select>" +
        '<span aria-hidden="true">–</span>' +
        '<select id="f-hasta" aria-label="Período hasta">' + opt(opciones.meses, filtros.hasta, etiquetaMes) + "</select></span>";
    }
    const simple = (dim, rotulo, vals) =>
      '<select id="f-' + dim + '" aria-label="' + rotulo + '">' + opt([TODOS].concat(vals), filtros[dim], (v) => (v === TODOS ? TEXTO_TODOS[dim] : v)) + "</select>";
    if (usados.includes("canal")) html += simple("canal", "Canal", opciones.canales);
    if (usados.includes("provincia")) html += simple("provincia", "Provincia", opciones.provincias);
    if (usados.includes("producto")) html += simple("producto", "Producto", opciones.productos);
    html += '<button type="button" class="boton" id="f-limpiar">Quitar filtros</button>';
    el.innerHTML = html;

    const leer = () => {
      const d = document.getElementById("f-desde"), h = document.getElementById("f-hasta");
      if (d) { filtros.desde = d.value; filtros.hasta = h.value; }
      ["canal", "provincia", "producto"].forEach((k) => { const s = document.getElementById("f-" + k); if (s) filtros[k] = s.value; });
      validarFiltros();
      sincronizar();
      guardar();
      alCambiar();
    };
    el.querySelectorAll("select").forEach((s) => s.addEventListener("change", leer));
    document.getElementById("f-limpiar").addEventListener("click", () => {
      filtros = { desde: opciones.meses[0], hasta: opciones.meses[opciones.meses.length - 1], canal: TODOS, provincia: TODOS, producto: TODOS };
      sincronizar();
      guardar();
      alCambiar();
    });
  }
  function sincronizar() {
    const set = (id, v) => { const s = document.getElementById(id); if (s) s.value = v; };
    set("f-desde", filtros.desde); set("f-hasta", filtros.hasta);
    set("f-canal", filtros.canal); set("f-provincia", filtros.provincia); set("f-producto", filtros.producto);
  }
  /** Cambia un filtro desde un gráfico (p. ej. clic en el mapa) */
  function fijarFiltro(dim, valor) {
    filtros[dim] = filtros[dim] === valor ? TODOS : valor;
    sincronizar();
    guardar();
    if (estadoPagina.render) ejecutarRender();
  }

  // ------------------------------------------------------------------
  // Arranque de cada página
  // ------------------------------------------------------------------
  const estadoPagina = { render: null, datos: null };
  function ejecutarRender() {
    try {
      estadoPagina.render(estadoPagina.datos);
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * EB.pagina({ id, marts, filtros, render })
   *  id:      clave de la página en la navegación
   *  marts:   nombres de los CSV de dw/ que usa
   *  filtros: qué filtros globales se muestran en la barra
   *  render:  función que dibuja todo con los datos ya filtrables
   */
  async function pagina(cfg) {
    armarBarra(cfg.id);
    const usados = cfg.filtros || [];
    const cont = document.getElementById("contenido-pagina");
    try {
      const base = await cargar(["filtro_mes", "filtro_canal", "filtro_provincia", "filtro_producto"]);
      opciones = {
        meses: base.filtro_mes.map((f) => (f.mes instanceof Date ? f.mes.toISOString().slice(0, 10) : String(f.mes))).sort(),
        canales: base.filtro_canal.map((f) => f.canal),
        provincias: base.filtro_provincia.map((f) => f.provincia),
        productos: base.filtro_producto.map((f) => f.producto),
      };
      leerGuardados();
      validarFiltros();
      estadoPagina.datos = await cargar(cfg.marts || []);
      estadoPagina.render = cfg.render;
      armarFiltros(usados, ejecutarRender);
      sincronizar();
      armarTarjetas();
      ejecutarRender();
    } catch (e) {
      console.error(e);
      if (cont) {
        const div = document.createElement("div");
        div.className = "error";
        div.innerHTML =
          "<strong>No se pudieron cargar los datos.</strong> " + e.message +
          ". Si abriste el archivo con doble clic, el navegador bloquea la lectura de los CSV: " +
          "serví la carpeta del repo con <code>python -m http.server</code> y entrá a <code>http://localhost:8000/web/</code>.";
        cont.prepend(div);
      }
    }
  }

  // ------------------------------------------------------------------
  // Utilidades de presentación
  // ------------------------------------------------------------------
  /** Pinta un KPI: valor, variación interanual y nota */
  function kpi(id, { valor, anterior, nota, invertir = false, formatoDelta }) {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelector(".kpi-valor").innerHTML = valor;
    const d = el.querySelector(".kpi-delta");
    if (d) {
      if (anterior == null || !Number.isFinite(anterior.actual) || !Number.isFinite(anterior.previo) || anterior.previo === 0) {
        d.className = "kpi-delta neutro";
        d.textContent = "";
      } else {
        const delta = formatoDelta ? null : anterior.actual / anterior.previo - 1;
        const sube = formatoDelta ? anterior.actual - anterior.previo >= 0 : delta >= 0;
        const bueno = invertir ? !sube : sube;
        d.className = "kpi-delta " + (bueno ? "sube" : "baja");
        const flecha = sube ? "▲" : "▼";
        d.textContent = flecha + " " + (formatoDelta ? formatoDelta(anterior.actual - anterior.previo) : fmt.pct(Math.abs(delta))) + " contra el mismo período del año anterior";
      }
    }
    const n = el.querySelector(".kpi-nota");
    if (n && nota != null) n.textContent = nota;
  }

  /** Mini serie dentro de un KPI */
  function chispa(id, valores, color) {
    grafico(id, {
      grid: { left: 0, right: 0, top: 4, bottom: 0 },
      xAxis: { type: "category", show: false, data: mesesElegidos().map(etiquetaMes) },
      yAxis: { type: "value", show: false, scale: true },
      tooltip: { show: false },
      series: [{ type: "line", data: valores, showSymbol: false, smooth: 0.3, lineStyle: { width: 2, color }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: color + "55" }, { offset: 1, color: color + "00" }]) } }],
    });
  }

  /** NPS = (promotores - detractores) / respuestas x 100, siempre después de sumar */
  const nps = (prom, detr, resp) => (resp ? ((prom - detr) / resp) * 100 : NaN);

  /** Texto con los filtros activos, para titulares */
  function describirFiltros(dims) {
    const partes = [];
    if (dims.includes("canal") && filtros.canal !== TODOS) partes.push("canal " + filtros.canal);
    if (dims.includes("provincia") && filtros.provincia !== TODOS) partes.push(filtros.provincia);
    if (dims.includes("producto") && filtros.producto !== TODOS) partes.push(filtros.producto);
    return partes.join(", ");
  }

  window.EB = {
    COLOR, CATEGORICO, TODOS, fmt, etiquetaMes, etiquetaMesLarga, mesAnterior,
    cargar, filtrar, mesesElegidos, periodoAnterior, suma, agrupar, agruparLista, serieMensual,
    grafico, tooltipEje, tabla, kpi, chispa, nps, fijarFiltro, describirFiltros, pagina,
    get filtros() { return filtros; },
    get opciones() { return opciones; },
  };
})();
