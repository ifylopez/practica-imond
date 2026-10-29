/* Acerca del modelo: tabla de marts con su grano, filas y filtros que responden */
const MARTS = [
  ["mart_ventas", "mes × canal × provincia", ["mes", "canal", "provincia"], "Resumen, Ventas"],
  ["mart_productos", "mes × canal × provincia × producto", ["mes", "canal", "provincia", "producto"], "Productos"],
  ["mart_usuarios", "mes", ["mes"], "Resumen, Clientes"],
  ["mart_nps", "mes × canal", ["mes", "canal"], "Resumen, Experiencia"],
  ["mart_dia_semana", "mes × canal × provincia × día", ["mes", "canal", "provincia"], "Ventas"],
  ["mart_estados", "mes × canal × provincia × estado", ["mes", "canal", "provincia"], "Operaciones"],
  ["mart_pagos", "mes × canal × provincia × medio × estado del pago × estado del pedido", ["mes", "canal", "provincia"], "Operaciones"],
  ["mart_logistica", "mes × canal × provincia × estado del envío", ["mes", "canal", "provincia"], "Experiencia, Operaciones"],
  ["mart_trafico", "mes × fuente × dispositivo", ["mes"], "Clientes"],
  ["mart_nps_puntajes", "mes × canal × puntaje", ["mes", "canal"], "Experiencia"],
  ["mart_clientes_mes", "mes (conteo distinto, fijo)", ["mes"], "Clientes"],
  ["mart_cohortes", "cohorte × meses desde el alta (fijo)", [], "Clientes"],
];

EB.pagina({
  id: "modelo",
  marts: MARTS.map((m) => m[0]),
  filtros: [],
  render(d) {
    const tilde = (ok) => (ok ? '<span class="si" aria-label="sí">Sí</span>' : '<span class="no" aria-label="no">No</span>');
    document.querySelector("#tabla-marts tbody").innerHTML = MARTS.map(([n, grano, dims, pags]) =>
      "<tr><td><code>" + n + "</code></td><td>" + grano + "</td><td>" + EB.fmt.entero(d[n].length) + "</td>" +
      ["mes", "canal", "provincia", "producto"].map((x) => "<td>" + tilde(dims.includes(x)) + "</td>").join("") +
      "<td>" + pags + "</td></tr>"
    ).join("");
  },
});
