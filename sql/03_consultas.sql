-- =====================================================================
-- 03_consultas.sql — Consultas para revisar el modelo y calcular KPIs
-- =====================================================================
-- Cada SELECT de este archivo se muestra en la terminal al ejecutar
-- run_sql.py. Usalo para:
--   * comprobar que las tablas se cargaron bien (cantidad de filas, nulos...)
--   * escribir las consultas clave de los KPIs que pide la consigna
--     (ventas, usuarios activos, ticket promedio, NPS, ventas por provincia,
--     ranking mensual por producto) usando las tablas del modelo estrella.
-- =====================================================================


-- Ejemplo: revisar la dimensión producto
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

-- V4. ¿Se cumple que los pedidos ONLINE no tienen tienda? (ONLINE: con_tienda = 0)
SELECT c.code AS canal, COUNT(*) AS pedidos, COUNT(f.store_id) AS con_tienda
FROM fact_sales_order AS f
JOIN dim_channel AS c ON c.channel_id = f.channel_id
GROUP BY c.code;

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

-- K2. USUARIOS ACTIVOS por mes (nK)
SELECT
    d.year,
    d.month,
    COUNT(DISTINCT f.customer_id)                     AS usuarios_activos,
    COUNT(*) FILTER (WHERE f.customer_id IS NULL)     AS sesiones_anonimas
FROM fact_web_session AS f
JOIN dim_date AS d ON d.date_key = f.date_key
GROUP BY d.year, d.month
ORDER BY d.year, d.month;

-- K3. TICKET PROMEDIO por mes ($K)  ← TU TURNO
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
JOIN dim_date    AS d ON d.date_key   = f.date_key
JOIN dim_channel AS c ON c.channel_id = f.channel_id
GROUP BY d.year, d.month, c.code
ORDER BY d.year, d.month, c.code;

-- K5. VENTAS POR PROVINCIA (total del período)
SELECT
    a.province,
    ROUND(SUM(f.total_amount) / 1e6, 2) AS ventas_millones,
    ROUND(SUM(f.total_amount) * 100.0 / SUM(SUM(f.total_amount)) OVER (), 1) AS porcentaje
FROM fact_sales_order AS f
JOIN dim_address AS a ON a.address_id = f.shipping_address_id
WHERE f.is_sale
GROUP BY a.province
ORDER BY ventas_millones DESC;

-- K6. RANKING MENSUAL POR PRODUCTO
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