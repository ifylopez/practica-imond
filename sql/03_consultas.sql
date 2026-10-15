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