-- =====================================================================
-- 03_consultas.sql — Validación del modelo y KPIs
-- =====================================================================

-- Ejemplo de los profes: la dimensión producto
SELECT product_key, name, category, family, list_price
FROM dim_product
ORDER BY product_key;


-- =====================================================================
-- VALIDACIÓN DEL MODELO
-- =====================================================================

-- V1. ¿Se cargaron todas las filas? (cada par tiene que dar igual)
SELECT 'pedidos' AS tabla, (SELECT COUNT(*) FROM raw.sales_order) AS en_raw, (SELECT COUNT(*) FROM fact_sales_order) AS en_dw
UNION ALL SELECT 'lineas',   (SELECT COUNT(*) FROM raw.sales_order_item), (SELECT COUNT(*) FROM fact_sales_order_item)
UNION ALL SELECT 'sesiones', (SELECT COUNT(*) FROM raw.web_session),      (SELECT COUNT(*) FROM fact_web_session)
UNION ALL SELECT 'nps',      (SELECT COUNT(*) FROM raw.nps_response),     (SELECT COUNT(*) FROM fact_nps_response);

-- V2. ¿Los montos de las líneas cierran con el subtotal del pedido? (tiene que dar 0)
SELECT COUNT(*) AS pedidos_que_no_cierran
FROM fact_sales_order AS o
JOIN (
    SELECT order_id, SUM(line_total) AS suma_lineas
    FROM fact_sales_order_item
    GROUP BY order_id
) AS i ON i.order_id = o.order_id
WHERE i.suma_lineas <> o.subtotal;

-- V3. ¿Hay pedidos sin ninguna línea? (tiene que dar 0)
SELECT COUNT(*) AS pedidos_sin_lineas
FROM fact_sales_order AS o
WHERE NOT EXISTS (
    SELECT 1 FROM fact_sales_order_item AS i WHERE i.order_id = o.order_id
);

-- V4. ¿Los pedidos ONLINE no tienen tienda? (ONLINE: con_tienda = 0)
SELECT
    c.code AS canal,
    COUNT(*) AS pedidos,
    COUNT(*) FILTER (WHERE f.store_key <> -1) AS con_tienda
FROM fact_sales_order AS f
JOIN dim_channel AS c ON c.channel_key = f.channel_key
GROUP BY c.code;

-- V5. ¿Cuántas filas apuntan al miembro "Desconocido" (-1)? (informativo)
SELECT 'pedidos sin dirección'  AS caso, COUNT(*) AS filas FROM fact_sales_order  WHERE shipping_address_key = -1
UNION ALL SELECT 'sesiones anónimas',   COUNT(*) FROM fact_web_session  WHERE customer_key = -1
UNION ALL SELECT 'respuestas NPS anónimas', COUNT(*) FROM fact_nps_response WHERE customer_key = -1
UNION ALL SELECT 'pedidos sin pago',        COUNT(*) FROM fact_sales_order  WHERE payment_key = -1
UNION ALL SELECT 'pedidos sin envío',       COUNT(*) FROM fact_sales_order  WHERE shipment_status_key = -1
UNION ALL SELECT 'sesiones sin fuente',     COUNT(*) FROM fact_web_session  WHERE traffic_key = -1;

-- V6. ¿Pago concretado <=> venta? (las dos columnas tienen que dar igual)
SELECT
    COUNT(*) FILTER (WHERE f.is_sale)                    AS ventas,
    COUNT(*) FILTER (WHERE p.payment_status = 'PAID')    AS pagos_concretados
FROM fact_sales_order AS f
JOIN dim_payment AS p ON p.payment_key = f.payment_key;


-- =====================================================================
-- KPIs (solo desde el data warehouse)
-- =====================================================================

-- K1. VENTAS por mes ($M) — pedidos PAID o FULFILLED
SELECT
    d.year,
    d.month,
    ROUND(SUM(f.total_amount) / 1e6, 2) AS ventas_millones
FROM fact_sales_order AS f
JOIN dim_date AS d ON d.date_key = f.date_key
WHERE f.is_sale
GROUP BY d.year, d.month
ORDER BY d.year, d.month;

-- K2. USUARIOS ACTIVOS por mes (nK) — se excluye el -1 (anónimos)
SELECT
    d.year,
    d.month,
    COUNT(DISTINCT f.customer_key) FILTER (WHERE f.customer_key <> -1) AS usuarios_activos,
    COUNT(*) FILTER (WHERE f.customer_key = -1)                        AS sesiones_anonimas
FROM fact_web_session AS f
JOIN dim_date AS d ON d.date_key = f.date_key
GROUP BY d.year, d.month
ORDER BY d.year, d.month;

-- K3. TICKET PROMEDIO por mes ($K) — mismo filtro que Ventas
SELECT
    d.year,
    d.month,
    COUNT(*)                                          AS pedidos,
    ROUND(SUM(f.total_amount) / COUNT(*) / 1e3, 1)    AS ticket_promedio_miles
FROM fact_sales_order AS f
JOIN dim_date AS d ON d.date_key = f.date_key
WHERE f.is_sale
GROUP BY d.year, d.month
ORDER BY d.year, d.month;

-- K4. NPS por mes y canal
SELECT
    d.year,
    d.month,
    c.code AS canal,
    COUNT(*) AS respuestas,
    ROUND((SUM(f.is_promoter) - SUM(f.is_detractor)) * 100.0 / COUNT(*), 1) AS nps
FROM fact_nps_response AS f
JOIN dim_date    AS d ON d.date_key    = f.date_key
JOIN dim_channel AS c ON c.channel_key = f.channel_key
GROUP BY d.year, d.month, c.code
ORDER BY d.year, d.month, c.code;

-- K5. VENTAS POR PROVINCIA (total del período)
SELECT
    a.province,
    ROUND(SUM(f.total_amount) / 1e6, 2) AS ventas_millones,
    ROUND(SUM(f.total_amount) * 100.0 / SUM(SUM(f.total_amount)) OVER (), 1) AS porcentaje
FROM fact_sales_order AS f
JOIN dim_address AS a ON a.address_key = f.shipping_address_key
WHERE f.is_sale
GROUP BY a.province
ORDER BY ventas_millones DESC;

-- K6. RANKING MENSUAL POR PRODUCTO (por facturación sin IVA ni envío)
SELECT
    d.year,
    d.month,
    p.name AS producto,
    SUM(f.quantity)                       AS unidades,
    ROUND(SUM(f.line_total) / 1e6, 2)     AS ventas_millones,
    RANK() OVER (
        PARTITION BY d.year, d.month
        ORDER BY SUM(f.line_total) DESC
    ) AS ranking
FROM fact_sales_order_item AS f
JOIN dim_date    AS d ON d.date_key    = f.date_key
JOIN dim_product AS p ON p.product_key = f.product_key
WHERE f.is_sale
GROUP BY d.year, d.month, p.name
ORDER BY d.year, d.month, ranking;


-- =====================================================================
-- CONSULTAS ADICIONALES (con las dimensiones de atributos)
-- =====================================================================

-- A1. Embudo de estados del pedido
SELECT
    s.status_desc                                         AS estado,
    COUNT(*)                                              AS pedidos,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1)   AS porcentaje
FROM fact_sales_order AS f
JOIN dim_order_status AS s ON s.order_status_key = f.order_status_key
GROUP BY s.status_desc, s.sort_order
ORDER BY s.sort_order;

-- A2. Mix de medios de pago por canal (solo ventas)
SELECT
    c.code          AS canal,
    p.method_desc   AS medio_de_pago,
    COUNT(*)        AS ventas,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY c.code), 1) AS porcentaje_del_canal
FROM fact_sales_order AS f
JOIN dim_channel AS c ON c.channel_key = f.channel_key
JOIN dim_payment AS p ON p.payment_key = f.payment_key
WHERE f.is_sale
GROUP BY c.code, p.method_desc
ORDER BY c.code, ventas DESC;

-- A3. Tráfico web por fuente y dispositivo
SELECT
    t.source_desc   AS fuente,
    t.device        AS dispositivo,
    COUNT(*)        AS sesiones,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS porcentaje
FROM fact_web_session AS f
JOIN dim_traffic AS t ON t.traffic_key = f.traffic_key
GROUP BY t.source_desc, t.device
ORDER BY sesiones DESC;

-- A4. Los 93 pedidos cancelados con pago reembolsado: ¿tuvieron envío cancelado?
SELECT
    s.status_desc   AS estado_pedido,
    p.status_desc   AS estado_pago,
    e.status_desc   AS estado_envio,
    COUNT(*)        AS pedidos
FROM fact_sales_order AS f
JOIN dim_order_status    AS s ON s.order_status_key    = f.order_status_key
JOIN dim_payment         AS p ON p.payment_key         = f.payment_key
JOIN dim_shipment_status AS e ON e.shipment_status_key = f.shipment_status_key
WHERE s.status = 'CANCELLED'
GROUP BY s.status_desc, p.status_desc, e.status_desc
ORDER BY pedidos DESC;
