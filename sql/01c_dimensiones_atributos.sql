-- =====================================================================
-- 01c_dimensiones_atributos.sql — Dimensiones de atributos descriptivos
-- =====================================================================
-- Se ejecuta después de 01b_dimensiones.sql y antes de los hechos.
--
-- Los estados, el medio de pago y el origen del tráfico son atributos
-- descriptivos: según Kimball no van como texto suelto en los hechos sino
-- en dimensiones propias. Son dimensiones chicas (pocas filas).
--
--   * dim_order_status    — estado del pedido (5 valores del dominio)
--   * dim_payment         — "junk dimension": combina medio y estado del pago
--   * dim_shipment_status — estado del envío (+ fila -1 "Sin envío")
--   * dim_traffic         — "junk dimension": combina fuente y dispositivo
--                           de la sesión web
--
-- Junk dimension: agrupa en una sola dimensión varios atributos de pocos
-- valores que no justifican una dimensión cada uno. Tiene una fila por
-- cada combinación que existe en los datos.
-- =====================================================================


-- ---------------------------------------------------------------------
-- dim_order_status — estado del pedido
-- El dominio es fijo (CHECK de la tabla de origen), por eso se carga con
-- VALUES: así existen los 5 estados aunque alguno no tenga pedidos.
-- ---------------------------------------------------------------------
CREATE TABLE dim_order_status (
    order_status_key INTEGER PRIMARY KEY,
    status           VARCHAR NOT NULL,     -- código del sistema de origen
    status_desc      VARCHAR NOT NULL,     -- descripción en español
    is_sale          BOOLEAN NOT NULL,     -- TRUE si cuenta como venta
    sort_order       INTEGER NOT NULL      -- orden del ciclo de vida
);

INSERT INTO dim_order_status VALUES
    (1, 'CREATED',   'Creado (sin pagar)',        FALSE, 1),
    (2, 'PAID',      'Pagado (sin entregar)',     TRUE,  2),
    (3, 'FULFILLED', 'Entregado',                 TRUE,  3),
    (4, 'CANCELLED', 'Cancelado',                 FALSE, 4),
    (5, 'REFUNDED',  'Reembolsado',               FALSE, 5);


-- ---------------------------------------------------------------------
-- dim_payment — medio y estado del pago (junk dimension)
-- (+ fila -1 para pedidos sin pago registrado)
-- ---------------------------------------------------------------------
CREATE TABLE dim_payment (
    payment_key    INTEGER PRIMARY KEY,
    method         VARCHAR,                -- CASH / CARD / TRANSFER / GATEWAY
    method_desc    VARCHAR NOT NULL,
    payment_status VARCHAR,                -- PENDING / PAID / FAILED / REFUNDED
    status_desc    VARCHAR NOT NULL
);

INSERT INTO dim_payment VALUES
    (-1, NULL, 'Sin pago', NULL, 'Sin pago');

INSERT INTO dim_payment
SELECT
    ROW_NUMBER() OVER (ORDER BY method, status) AS payment_key,
    method,
    CASE method
        WHEN 'CASH'     THEN 'Efectivo'
        WHEN 'CARD'     THEN 'Tarjeta'
        WHEN 'TRANSFER' THEN 'Transferencia'
        WHEN 'GATEWAY'  THEN 'Pasarela de pago'
        ELSE method
    END AS method_desc,
    status AS payment_status,
    CASE status
        WHEN 'PENDING'  THEN 'Pendiente'
        WHEN 'PAID'     THEN 'Pagado'
        WHEN 'FAILED'   THEN 'Rechazado'
        WHEN 'REFUNDED' THEN 'Reembolsado'
        ELSE status
    END AS status_desc
FROM (SELECT DISTINCT method, status FROM raw.payment);


-- ---------------------------------------------------------------------
-- dim_shipment_status — estado del envío (+ fila -1 "Sin envío")
-- ---------------------------------------------------------------------
CREATE TABLE dim_shipment_status (
    shipment_status_key INTEGER PRIMARY KEY,
    status              VARCHAR,           -- READY / SHIPPED / DELIVERED / CANCELLED
    status_desc         VARCHAR NOT NULL
);

INSERT INTO dim_shipment_status VALUES
    (-1, NULL,        'Sin envío'),
    ( 1, 'READY',     'En preparación'),
    ( 2, 'SHIPPED',   'En viaje'),
    ( 3, 'DELIVERED', 'Entregado'),
    ( 4, 'CANCELLED', 'Cancelado');


-- ---------------------------------------------------------------------
-- dim_traffic — fuente y dispositivo de la sesión web (junk dimension)
-- (+ fila -1 "Desconocido" por si alguna sesión no trae fuente/dispositivo)
-- ---------------------------------------------------------------------
CREATE TABLE dim_traffic (
    traffic_key INTEGER PRIMARY KEY,
    source      VARCHAR,                   -- ads / direct / referral / organic
    source_desc VARCHAR NOT NULL,
    device      VARCHAR                    -- mobile / desktop / tablet
);

INSERT INTO dim_traffic VALUES
    (-1, NULL, 'Desconocido', NULL);

INSERT INTO dim_traffic
SELECT
    ROW_NUMBER() OVER (ORDER BY source, device) AS traffic_key,
    source,
    CASE source
        WHEN 'ads'      THEN 'Publicidad en redes'
        WHEN 'direct'   THEN 'Directo / newsletter'
        WHEN 'referral' THEN 'Otro sitio / newsletter'
        WHEN 'organic'  THEN 'Buscadores'
        ELSE source
    END AS source_desc,
    device
FROM (
    SELECT DISTINCT source, device
    FROM raw.web_session
    WHERE source IS NOT NULL AND device IS NOT NULL
);
