-- =====================================================================
-- 05_marts_web.sql — Marts adicionales para el sitio web
-- =====================================================================
-- Mismas reglas que 04_marts.sql:
--   * Leen SOLO el modelo estrella (fact_ y dim_), nunca raw.
--   * Guardan medidas ADITIVAS (conteos y sumas) a un grano que el sitio
--     pueda filtrar y volver a sumar. Los cocientes (promedios, tasas,
--     porcentajes) los calcula el sitio DESPUÉS de sumar, igual que las
--     medidas DAX de Power BI.
--   * Excepción: los conteos de clientes distintos (cohortes, compradores)
--     no son aditivos, así que se guardan terminados a un grano fijo y no
--     se pueden filtrar.
--   * ORDER BY en todos: la salida es siempre la misma y el diff de Git
--     muestra solo cambios reales.
-- =====================================================================


-- ---------------------------------------------------------------------
-- mart_estados — embudo de estados del pedido
-- Grano: mes x canal x provincia x estado del pedido
-- ---------------------------------------------------------------------
CREATE TABLE mart_estados AS
SELECT
    CAST(DATE_TRUNC('month', d.date) AS DATE) AS mes,
    c.code                                    AS canal,
    a.province                                AS provincia,
    s.status                                  AS estado,
    s.status_desc                             AS estado_desc,
    s.sort_order                              AS orden,
    COUNT(*)                                  AS pedidos,
    SUM(f.total_amount)                       AS monto
FROM fact_sales_order AS f
JOIN dim_date         AS d ON d.date_key         = f.date_key
JOIN dim_channel      AS c ON c.channel_key      = f.channel_key
JOIN dim_address      AS a ON a.address_key      = f.shipping_address_key
JOIN dim_order_status AS s ON s.order_status_key = f.order_status_key
GROUP BY ALL
ORDER BY mes, canal, provincia, orden;


-- ---------------------------------------------------------------------
-- mart_pagos — medios y estados del pago (y cómo terminó el pedido)
-- Grano: mes x canal x provincia x medio x estado del pago x estado del pedido
-- El estado del pedido permite ver, por ejemplo, cuántos cancelados
-- tuvieron el pago reembolsado (la consulta A4 de 03_consultas.sql).
-- ---------------------------------------------------------------------
CREATE TABLE mart_pagos AS
SELECT
    CAST(DATE_TRUNC('month', d.date) AS DATE) AS mes,
    c.code                                    AS canal,
    a.province                                AS provincia,
    p.method_desc                             AS medio,
    p.status_desc                             AS estado_pago,
    s.status_desc                             AS estado_pedido,
    COUNT(*)                                  AS pagos,
    SUM(f.total_amount)                       AS monto
FROM fact_sales_order AS f
JOIN dim_date    AS d ON d.date_key    = f.date_key
JOIN dim_channel AS c ON c.channel_key = f.channel_key
JOIN dim_address AS a ON a.address_key = f.shipping_address_key
JOIN dim_payment AS p ON p.payment_key = f.payment_key
JOIN dim_order_status AS s ON s.order_status_key = f.order_status_key
GROUP BY ALL
ORDER BY mes, canal, provincia, medio, estado_pago, estado_pedido;


-- ---------------------------------------------------------------------
-- mart_logistica — envíos y tiempos de entrega
-- Grano: mes del pedido x canal x provincia de destino x estado del envío
-- Solo pedidos con envío (shipment_status_key <> -1).
-- Días promedio de entrega = dias_entrega_suma / entregados (en el sitio).
-- ---------------------------------------------------------------------
CREATE TABLE mart_logistica AS
SELECT
    CAST(DATE_TRUNC('month', d.date) AS DATE)                     AS mes,
    c.code                                                        AS canal,
    a.province                                                    AS provincia,
    s.status_desc                                                 AS estado_envio,
    COUNT(*)                                                      AS envios,
    COUNT(f.delivered_at)                                         AS entregados,
    SUM(date_diff('day', f.order_date, f.delivered_at))           AS dias_entrega_suma,
    COUNT(*) FILTER (WHERE date_diff('day', f.order_date, f.delivered_at) > 7) AS entregas_mas_7_dias
FROM fact_sales_order    AS f
JOIN dim_date            AS d ON d.date_key            = f.date_key
JOIN dim_channel         AS c ON c.channel_key         = f.channel_key
JOIN dim_address         AS a ON a.address_key         = f.shipping_address_key
JOIN dim_shipment_status AS s ON s.shipment_status_key = f.shipment_status_key
WHERE f.shipment_status_key <> -1
GROUP BY ALL
ORDER BY mes, canal, provincia, estado_envio;


-- ---------------------------------------------------------------------
-- mart_trafico — sesiones web por fuente y dispositivo
-- Grano: mes x fuente x dispositivo
-- ---------------------------------------------------------------------
CREATE TABLE mart_trafico AS
SELECT
    CAST(DATE_TRUNC('month', d.date) AS DATE)                 AS mes,
    t.source                                                  AS fuente,
    t.source_desc                                             AS fuente_desc,
    t.device                                                  AS dispositivo,
    COUNT(*)                                                  AS sesiones,
    COUNT(*) FILTER (WHERE f.customer_key <> -1)              AS sesiones_identificadas,
    COUNT(f.ended_at)                                         AS sesiones_con_fin,
    SUM(date_diff('minute', f.started_at, f.ended_at))        AS minutos_suma
FROM fact_web_session AS f
JOIN dim_date    AS d ON d.date_key    = f.date_key
JOIN dim_traffic AS t ON t.traffic_key = f.traffic_key
GROUP BY ALL
ORDER BY mes, fuente, dispositivo;


-- ---------------------------------------------------------------------
-- mart_nps_puntajes — distribución de puntajes NPS
-- Grano: mes x canal x puntaje (0 a 10)
-- ---------------------------------------------------------------------
CREATE TABLE mart_nps_puntajes AS
SELECT
    CAST(DATE_TRUNC('month', d.date) AS DATE) AS mes,
    c.code                                    AS canal,
    f.score                                   AS puntaje,
    COUNT(*)                                  AS respuestas
FROM fact_nps_response AS f
JOIN dim_date    AS d ON d.date_key    = f.date_key
JOIN dim_channel AS c ON c.channel_key = f.channel_key
GROUP BY ALL
ORDER BY mes, canal, puntaje;


-- ---------------------------------------------------------------------
-- mart_dia_semana — ventas por día de la semana
-- Grano: mes x canal x provincia x día de la semana (solo ventas)
-- ---------------------------------------------------------------------
CREATE TABLE mart_dia_semana AS
SELECT
    CAST(DATE_TRUNC('month', d.date) AS DATE) AS mes,
    c.code                                    AS canal,
    a.province                                AS provincia,
    d.weekday_num                             AS dia_num,
    CASE d.weekday_num
        WHEN 1 THEN 'Lunes'  WHEN 2 THEN 'Martes' WHEN 3 THEN 'Miércoles'
        WHEN 4 THEN 'Jueves' WHEN 5 THEN 'Viernes' WHEN 6 THEN 'Sábado'
        ELSE 'Domingo'
    END                                       AS dia,
    COUNT(*)                                  AS pedidos,
    SUM(f.total_amount)                       AS ventas
FROM fact_sales_order AS f
JOIN dim_date    AS d ON d.date_key    = f.date_key
JOIN dim_channel AS c ON c.channel_key = f.channel_key
JOIN dim_address AS a ON a.address_key = f.shipping_address_key
WHERE f.is_sale
GROUP BY ALL
ORDER BY mes, canal, provincia, dia_num;


-- ---------------------------------------------------------------------
-- mart_clientes_mes — compradores nuevos y recurrentes
-- Grano: mes (fijo: un conteo de clientes distintos no se puede sumar
-- entre canales ni provincias, así que no se filtra)
-- Nuevo = el mes de su primera compra; recurrente = ya había comprado.
-- ---------------------------------------------------------------------
CREATE TABLE mart_clientes_mes AS
WITH compras AS (
    SELECT DISTINCT f.customer_key, CAST(DATE_TRUNC('month', d.date) AS DATE) AS mes
    FROM fact_sales_order AS f
    JOIN dim_date AS d ON d.date_key = f.date_key
    WHERE f.is_sale AND f.customer_key <> -1
),
primera AS (
    SELECT customer_key, MIN(mes) AS primer_mes
    FROM compras
    GROUP BY customer_key
)
SELECT
    c.mes,
    COUNT(*)                                              AS compradores,
    COUNT(*) FILTER (WHERE c.mes = p.primer_mes)          AS compradores_nuevos,
    COUNT(*) FILTER (WHERE c.mes > p.primer_mes)          AS compradores_recurrentes
FROM compras AS c
JOIN primera AS p ON p.customer_key = c.customer_key
GROUP BY c.mes
ORDER BY c.mes;


-- ---------------------------------------------------------------------
-- mart_cohortes — retención de clientes por mes de alta
-- Grano: cohorte (mes de alta) x meses desde el alta (fijo, no se filtra)
-- Solo cohortes desde 2024-01, cuando empiezan los pedidos.
-- Retención = clientes_compradores / tamano_cohorte (en el sitio).
-- ---------------------------------------------------------------------
CREATE TABLE mart_cohortes AS
WITH clientes AS (
    SELECT customer_key, cohort_month
    FROM dim_customer
    WHERE customer_key <> -1 AND cohort_month >= '2024-01'
),
tamano AS (
    SELECT cohort_month, COUNT(*) AS tamano_cohorte
    FROM clientes
    GROUP BY cohort_month
),
compras AS (
    SELECT DISTINCT f.customer_key, d.year_month
    FROM fact_sales_order AS f
    JOIN dim_date AS d ON d.date_key = f.date_key
    WHERE f.is_sale
)
SELECT
    cl.cohort_month                                                   AS cohorte,
    (CAST(substr(co.year_month, 1, 4) AS INTEGER) * 12 + CAST(substr(co.year_month, 6, 2) AS INTEGER))
  - (CAST(substr(cl.cohort_month, 1, 4) AS INTEGER) * 12 + CAST(substr(cl.cohort_month, 6, 2) AS INTEGER))
                                                                      AS meses_desde_alta,
    t.tamano_cohorte,
    COUNT(DISTINCT cl.customer_key)                                   AS clientes_compradores
FROM clientes AS cl
JOIN compras  AS co ON co.customer_key  = cl.customer_key
JOIN tamano   AS t  ON t.cohort_month   = cl.cohort_month
WHERE co.year_month >= cl.cohort_month
GROUP BY ALL
ORDER BY cohorte, meses_desde_alta;


-- ---------------------------------------------------------------------
-- CONTROLES: los marts nuevos tienen que cerrar con los anteriores
-- ---------------------------------------------------------------------
-- Ventas: dia_semana (ventas) = mart_ventas (ventas); estados: total de pedidos
SELECT
    (SELECT ROUND(SUM(ventas) / 1e6, 2) FROM mart_dia_semana)            AS ventas_dia_semana_M,
    (SELECT ROUND(SUM(ventas) / 1e6, 2) FROM mart_ventas)                AS ventas_mart_ventas_M,
    (SELECT SUM(pedidos) FROM mart_estados)                              AS pedidos_estados,
    (SELECT SUM(pagos) FROM mart_pagos)                                  AS pedidos_pagos,
    (SELECT SUM(sesiones) FROM mart_trafico)                             AS sesiones_trafico,
    (SELECT SUM(respuestas) FROM mart_nps_puntajes)                      AS respuestas_nps;

-- Tiempo de entrega promedio por mes (días): confirma la hipótesis logística
SELECT
    mes,
    SUM(entregados)                                       AS entregados,
    ROUND(SUM(dias_entrega_suma) / SUM(entregados), 2)    AS dias_promedio
FROM mart_logistica
GROUP BY mes
ORDER BY mes;
