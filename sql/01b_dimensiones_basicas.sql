-- =====================================================================
-- 01b_dimensiones_basicas.sql — Dimensiones mínimas para las FK
-- =====================================================================
-- Se ejecuta después de 01_dimensiones.sql (que crea dim_product)
-- y antes de los hechos (02a...02d), porque los hechos apuntan acá.
--
-- Simplificación: estas dimensiones usan la clave del origen (customer_id,
-- channel_id, ...) como PRIMARY KEY, en lugar de una clave subrogada.
-- dim_date usa una clave numérica AAAAMMDD (ej. 20240131).
-- =====================================================================

-- Canales de venta (ONLINE / OFFLINE)
CREATE TABLE dim_channel (
    channel_id INTEGER PRIMARY KEY,
    code       VARCHAR,
    name       VARCHAR
);
INSERT INTO dim_channel
SELECT channel_id, code, name
FROM raw.channel;

-- Clientes
CREATE TABLE dim_customer (
    customer_id INTEGER PRIMARY KEY,
    first_name  VARCHAR,
    last_name   VARCHAR,
    status      VARCHAR,
    created_at  TIMESTAMP
);
INSERT INTO dim_customer
SELECT customer_id, first_name, last_name, status, created_at
FROM raw.customer;

-- Direcciones, con la provincia "aplanada" (para Ventas por Provincia)
CREATE TABLE dim_address (
    address_id  INTEGER PRIMARY KEY,
    city        VARCHAR,
    province    VARCHAR,
    postal_code VARCHAR
);
INSERT INTO dim_address
SELECT a.address_id, a.city, p.name, a.postal_code
FROM raw.address AS a
LEFT JOIN raw.province AS p ON p.province_id = a.province_id;

-- Tiendas físicas, con su ciudad y provincia
CREATE TABLE dim_store (
    store_id INTEGER PRIMARY KEY,
    name     VARCHAR,
    city     VARCHAR,
    province VARCHAR
);
INSERT INTO dim_store
SELECT s.store_id, s.name, a.city, p.name
FROM raw.store AS s
LEFT JOIN raw.address  AS a ON a.address_id  = s.address_id
LEFT JOIN raw.province AS p ON p.province_id = a.province_id;

-- Calendario: un día por fila (rango amplio para cubrir todas las fechas)
CREATE TABLE dim_date (
    date_key  INTEGER PRIMARY KEY,   -- AAAAMMDD
    date      DATE,
    year      INTEGER,
    month     INTEGER,
    month_name VARCHAR,
    day       INTEGER,
    weekday   VARCHAR
);
INSERT INTO dim_date
SELECT
    CAST(strftime(d, '%Y%m%d') AS INTEGER),
    d,
    year(d),
    month(d),
    monthname(d),
    day(d),
    dayname(d)
FROM (
    SELECT CAST(range AS DATE) AS d
    FROM range(DATE '2023-01-01', DATE '2027-01-01', INTERVAL 1 DAY)
);
