-- =====================================================================
-- 01b_dimensiones.sql — Dimensiones del modelo estrella (Kimball)
-- =====================================================================
-- Se ejecuta después de 01_dimensiones.sql (dim_product, de los profes).
--
-- Convenciones (las mismas del ejemplo dim_product):
--   * <x>_key = clave SUBROGADA, propia del DW, generada con ROW_NUMBER().
--               Es la PRIMARY KEY y la que usan los hechos.
--   * <x>_id  = clave NATURAL del sistema de origen. Se guarda para poder
--               encontrar la clave subrogada al cargar los hechos.
--   * Fila -1 "Desconocido": para los casos donde el hecho no tiene ese
--     dato (cliente anónimo, pedido online sin tienda). Así ninguna FK
--     de los hechos queda vacía.
--   * dim_date usa una clave "inteligente" AAAAMMDD (práctica estándar
--     de Kimball para la dimensión fecha).
--   * Datos personales: NO se cargan email ni teléfono. El análisis no los
--     necesita (minimización de datos personales).
-- =====================================================================


-- ---------------------------------------------------------------------
-- dim_channel — canales de venta
-- ---------------------------------------------------------------------
CREATE TABLE dim_channel (
    channel_key INTEGER PRIMARY KEY,
    channel_id  INTEGER NOT NULL,
    code        VARCHAR NOT NULL,      -- ONLINE / OFFLINE
    name        VARCHAR
);

INSERT INTO dim_channel
SELECT
    ROW_NUMBER() OVER (ORDER BY channel_id) AS channel_key,
    channel_id,
    code,
    name
FROM raw.channel;


-- ---------------------------------------------------------------------
-- dim_customer — clientes (+ fila -1 para anónimos)
-- ---------------------------------------------------------------------
CREATE TABLE dim_customer (
    customer_key INTEGER PRIMARY KEY,
    customer_id  INTEGER,              -- NULL solo en la fila -1
    first_name   VARCHAR,
    last_name    VARCHAR,
    full_name    VARCHAR NOT NULL,
    status       VARCHAR,              -- A / I
    status_desc  VARCHAR NOT NULL,     -- Activo / Inactivo / Anónimo
    created_date DATE,                 -- fecha de alta
    cohort_month VARCHAR               -- mes de alta (AAAA-MM), para cohortes
);

INSERT INTO dim_customer VALUES
    (-1, NULL, NULL, NULL, 'Anónimo', NULL, 'Anónimo', NULL, NULL);

INSERT INTO dim_customer
SELECT
    ROW_NUMBER() OVER (ORDER BY customer_id) AS customer_key,
    customer_id,
    first_name,
    last_name,
    first_name || ' ' || last_name           AS full_name,
    status,
    CASE status WHEN 'A' THEN 'Activo' ELSE 'Inactivo' END AS status_desc,
    CAST(created_at AS DATE)                 AS created_date,
    strftime(created_at, '%Y-%m')            AS cohort_month
FROM raw.customer;


-- ---------------------------------------------------------------------
-- dim_address — direcciones con ciudad y provincia aplanadas
-- (+ fila -1 para pedidos sin dirección)
-- ---------------------------------------------------------------------
CREATE TABLE dim_address (
    address_key   INTEGER PRIMARY KEY,
    address_id    INTEGER,
    city          VARCHAR,
    province      VARCHAR NOT NULL,
    province_code VARCHAR,
    postal_code   VARCHAR,
    country_code  VARCHAR,
    is_store      BOOLEAN              -- TRUE si es la dirección de una tienda
);

INSERT INTO dim_address VALUES
    (-1, NULL, NULL, 'Desconocida', NULL, NULL, NULL, NULL);

INSERT INTO dim_address
SELECT
    ROW_NUMBER() OVER (ORDER BY a.address_id) AS address_key,
    a.address_id,
    a.city,
    p.name                                    AS province,
    p.code                                    AS province_code,
    a.postal_code,
    a.country_code,
    a.address_id IN (SELECT address_id FROM raw.store) AS is_store
FROM raw.address AS a
LEFT JOIN raw.province AS p ON p.province_id = a.province_id
ORDER BY a.address_id;


-- ---------------------------------------------------------------------
-- dim_store — tiendas físicas (+ fila -1 para pedidos online)
-- ---------------------------------------------------------------------
CREATE TABLE dim_store (
    store_key INTEGER PRIMARY KEY,
    store_id  INTEGER,
    name      VARCHAR NOT NULL,
    city      VARCHAR,
    province  VARCHAR
);

INSERT INTO dim_store VALUES
    (-1, NULL, 'Sin tienda (online)', NULL, NULL);

INSERT INTO dim_store
SELECT
    ROW_NUMBER() OVER (ORDER BY s.store_id) AS store_key,
    s.store_id,
    s.name,
    a.city,
    p.name                                  AS province
FROM raw.store AS s
LEFT JOIN raw.address  AS a ON a.address_id  = s.address_id
LEFT JOIN raw.province AS p ON p.province_id = a.province_id;


-- ---------------------------------------------------------------------
-- dim_date — calendario, un día por fila
-- ---------------------------------------------------------------------
CREATE TABLE dim_date (
    date_key     INTEGER PRIMARY KEY,  -- AAAAMMDD
    date         DATE NOT NULL,
    year         INTEGER,
    quarter      INTEGER,
    month        INTEGER,
    month_name   VARCHAR,
    year_month   VARCHAR,              -- AAAA-MM
    day          INTEGER,
    weekday_num  INTEGER,              -- 1 = lunes ... 7 = domingo
    weekday_name VARCHAR,
    is_weekend   BOOLEAN
);

INSERT INTO dim_date
SELECT
    CAST(strftime(d, '%Y%m%d') AS INTEGER) AS date_key,
    d                                      AS date,
    year(d),
    quarter(d),
    month(d),
    monthname(d),
    strftime(d, '%Y-%m'),
    day(d),
    isodow(d),
    dayname(d),
    isodow(d) >= 6                         AS is_weekend
FROM (
    SELECT CAST(range AS DATE) AS d
    FROM range(DATE '2023-01-01', DATE '2027-01-01', INTERVAL 1 DAY)
);
