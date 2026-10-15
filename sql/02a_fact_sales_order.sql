-- =====================================================================
-- fact_sales_order
-- GRANO: una fila representa un pedido realizado por un cliente,
--        en un canal, en una fecha.
-- Une pedido + pago (1 a 1) + envío (1 a 0..1). LEFT JOIN para no perder
-- las compras en tienda, que no tienen envío.
-- Cada clave natural del origen se traduce a la clave subrogada de su
-- dimensión con un LEFT JOIN; si no hay dato (ej. pedido online sin
-- tienda), COALESCE la manda a la fila -1 "Desconocido".
-- =====================================================================

CREATE TABLE fact_sales_order (
    order_id             BIGINT PRIMARY KEY,   -- dimensión degenerada
    date_key             INTEGER NOT NULL REFERENCES dim_date (date_key),
    customer_key         INTEGER NOT NULL REFERENCES dim_customer (customer_key),
    channel_key          INTEGER NOT NULL REFERENCES dim_channel (channel_key),
    store_key            INTEGER NOT NULL REFERENCES dim_store (store_key),      -- -1 si es ONLINE
    shipping_address_key INTEGER NOT NULL REFERENCES dim_address (address_key),
    order_date           TIMESTAMP NOT NULL,
    status               VARCHAR NOT NULL,
    is_sale              BOOLEAN NOT NULL,     -- TRUE si PAID o FULFILLED
    subtotal             DECIMAL(12, 2),
    tax_amount           DECIMAL(12, 2),
    shipping_fee         DECIMAL(12, 2),
    total_amount         DECIMAL(12, 2),
    payment_method       VARCHAR,
    payment_status       VARCHAR,
    paid_at              TIMESTAMP,
    shipment_status      VARCHAR,
    shipped_at           TIMESTAMP,
    delivered_at         TIMESTAMP
);

INSERT INTO fact_sales_order
SELECT
    so.order_id,
    CAST(strftime(so.order_date, '%Y%m%d') AS INTEGER) AS date_key,
    COALESCE(cu.customer_key, -1)  AS customer_key,
    ch.channel_key                AS channel_key,
    COALESCE(st.store_key, -1)     AS store_key,
    COALESCE(ad.address_key, -1)   AS shipping_address_key,
    so.order_date,
    so.status,
    so.status IN ('PAID', 'FULFILLED') AS is_sale,
    so.subtotal,
    so.tax_amount,
    so.shipping_fee,
    so.total_amount,
    pay.method,
    pay.status,
    pay.paid_at,
    sh.status,
    sh.shipped_at,
    sh.delivered_at
FROM raw.sales_order AS so
LEFT JOIN raw.payment    AS pay ON pay.order_id   = so.order_id
LEFT JOIN raw.shipment   AS sh  ON sh.order_id    = so.order_id
-- traducir claves naturales -> subrogadas
LEFT JOIN dim_customer   AS cu  ON cu.customer_id = so.customer_id
LEFT JOIN dim_channel    AS ch  ON ch.channel_id  = so.channel_id
LEFT JOIN dim_store      AS st  ON st.store_id    = so.store_id
LEFT JOIN dim_address    AS ad  ON ad.address_id  = so.shipping_address_id;
