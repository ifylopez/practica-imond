-- =====================================================================
-- 04_marts.sql — MARTS para el tablero
-- =====================================================================
-- Un mart por proceso de negocio, agregado por MES y con los nombres de
-- las dimensiones ya pegados: la herramienta de visualización no hace
-- JOINs ni recorre miles de filas, solo suma y muestra.
--
-- Regla: los marts guardan solo medidas ADITIVAS (sumas y conteos).
-- Los KPIs que son cocientes (Ticket = ventas / pedidos, NPS) se dividen
-- en el tablero, DESPUÉS de sumar, porque un promedio de promedios da mal
-- cuando se filtran varios meses, canales o provincias.
--
-- Fuente: SOLO tablas del data warehouse (fact_ y dim_), nunca raw.
-- =====================================================================


-- ---------------------------------------------------------------------
-- MART 1: VENTAS — grano: mes x canal x provincia
-- KPIs: Total Ventas ($M), Ticket Promedio ($K) = ventas / pedidos,
--       Ventas por Provincia
-- ---------------------------------------------------------------------
CREATE TABLE mart_ventas AS
SELECT
    CAST(DATE_TRUNC('month', d.date) AS DATE) AS mes,
    c.code                                    AS canal,
    a.province                                AS provincia,
    COUNT(*)                                  AS pedidos,
    SUM(f.total_amount)                       AS ventas
FROM fact_sales_order AS f
JOIN dim_date    AS d ON d.date_key   = f.date_key
JOIN dim_channel AS c ON c.channel_key = f.channel_key
JOIN dim_address AS a ON a.address_key = f.shipping_address_key
WHERE f.is_sale
GROUP BY CAST(DATE_TRUNC('month', d.date) AS DATE), c.code, a.province;


-- ---------------------------------------------------------------------
-- MART 2: PRODUCTOS — grano: mes x canal x provincia x producto
-- KPI: Ranking mensual por producto (por facturación sin IVA ni envío)
-- ---------------------------------------------------------------------
CREATE TABLE mart_productos AS
SELECT
    CAST(DATE_TRUNC('month', d.date) AS DATE) AS mes,
    c.code                                    AS canal,
    a.province                                AS provincia,
    p.name                                    AS producto,
    SUM(f.quantity)                           AS unidades,
    SUM(f.line_total)                         AS ventas_productos
FROM fact_sales_order_item AS f
JOIN dim_date    AS d ON d.date_key    = f.date_key
JOIN dim_channel AS c ON c.channel_key = f.channel_key
JOIN dim_address AS a ON a.address_key = f.shipping_address_key
JOIN dim_product AS p ON p.product_key = f.product_key
WHERE f.is_sale
GROUP BY CAST(DATE_TRUNC('month', d.date) AS DATE), c.code, a.province, p.name;


-- ---------------------------------------------------------------------
-- MART 3: USUARIOS — grano: mes
-- KPI: Usuarios Activos (nK)
-- COUNT(DISTINCT) NO es aditivo (un usuario activo en enero y febrero
-- cuenta 1 en cada mes, pero 1 solo en el bimestre), por eso se calcula
-- acá ya terminado y por mes. Las sesiones no tienen provincia ni producto.
-- ---------------------------------------------------------------------
CREATE TABLE mart_usuarios AS
SELECT
    CAST(DATE_TRUNC('month', d.date) AS DATE)       AS mes,
    COUNT(DISTINCT f.customer_key) FILTER (WHERE f.customer_key <> -1) AS usuarios_activos,
    COUNT(*)                                        AS sesiones,
    COUNT(*) FILTER (WHERE f.customer_key = -1)                        AS sesiones_anonimas
FROM fact_web_session AS f
JOIN dim_date AS d ON d.date_key = f.date_key
GROUP BY CAST(DATE_TRUNC('month', d.date) AS DATE);


-- ---------------------------------------------------------------------
-- MART 4: NPS — grano: mes x canal
-- KPI: NPS = (promotores - detractores) * 100 / respuestas
-- Las respuestas no tienen pedido: no se pueden cortar por producto
-- ni por provincia.
-- ---------------------------------------------------------------------
CREATE TABLE mart_nps AS
SELECT
    CAST(DATE_TRUNC('month', d.date) AS DATE) AS mes,
    c.code                                    AS canal,
    COUNT(*)                                  AS respuestas,
    SUM(f.is_promoter)                        AS promotores,
    SUM(f.is_detractor)                       AS detractores
FROM fact_nps_response AS f
JOIN dim_date    AS d ON d.date_key   = f.date_key
JOIN dim_channel AS c ON c.channel_key = f.channel_key
GROUP BY CAST(DATE_TRUNC('month', d.date) AS DATE), c.code;


-- ---------------------------------------------------------------------
-- TABLAS DE FILTRO (una lista de valores por filtro del tablero)
-- En Power BI se relacionan con los marts para que un mismo filtro
-- afecte a todos los gráficos a la vez.
-- ---------------------------------------------------------------------
CREATE TABLE filtro_mes AS
SELECT DISTINCT CAST(DATE_TRUNC('month', date) AS DATE) AS mes
FROM dim_date
WHERE date BETWEEN DATE '2024-01-01' AND DATE '2025-09-30'   -- período de los datos
ORDER BY mes;

CREATE TABLE filtro_canal AS
SELECT code AS canal FROM dim_channel;

CREATE TABLE filtro_provincia AS
SELECT DISTINCT province AS provincia FROM dim_address WHERE address_key <> -1;

CREATE TABLE filtro_producto AS
SELECT name AS producto FROM dim_product;


-- ---------------------------------------------------------------------
-- CONTROL: los marts tienen que dar lo mismo que los KPIs del 03
-- ---------------------------------------------------------------------
SELECT
    ROUND(SUM(ventas) / 1e6, 2)                  AS ventas_totales_millones,
    ROUND(SUM(ventas) / SUM(pedidos) / 1e3, 1)   AS ticket_promedio_miles
FROM mart_ventas;

SELECT
    canal,
    ROUND((SUM(promotores) - SUM(detractores)) * 100.0 / SUM(respuestas), 1) AS nps_total
FROM mart_nps
GROUP BY canal;
