-- =====================================================================
-- fact_sales_order
-- GRANO: una fila representa un pedido realizado por un cliente,
--        en un canal, en una fecha.
-- Une pedido + pago (1 a 1) + envío (1 a 0..1). LEFT JOIN para no perder
-- las compras en tienda, que no tienen envío.
-- =====================================================================

CREATE TABLE fact_sales_order (
    order_id            BIGINT PRIMARY KEY,
    date_key            INTEGER NOT NULL REFERENCES dim_date (date_key),
    customer_id         INTEGER NOT NULL REFERENCES dim_customer (customer_id),
    channel_id          INTEGER NOT NULL REFERENCES dim_channel (channel_id),
    store_id            INTEGER          REFERENCES dim_store (store_id),       -- NULL si es ONLINE
    shipping_address_id INTEGER          REFERENCES dim_address (address_id),
    order_date          TIMESTAMP NOT NULL,
    status              VARCHAR NOT NULL,
    is_sale             BOOLEAN NOT NULL,      -- TRUE si PAID o FULFILLED
    subtotal            DECIMAL(12, 2),
    tax_amount          DECIMAL(12, 2),
    shipping_fee        DECIMAL(12, 2),
    total_amount        DECIMAL(12, 2),
    payment_method      VARCHAR,
    payment_status      VARCHAR,
    paid_at             TIMESTAMP,
    shipment_status     VARCHAR,
    shipped_at          TIMESTAMP,
    delivered_at        TIMESTAMP
);

INSERT INTO fact_sales_order
SELECT
    so.order_id,
    CAST(strftime(so.order_date, '%Y%m%d') AS INTEGER) AS date_key,
    so.customer_id,
    so.channel_id,
    so.store_id,
    so.shipping_address_id,
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
LEFT JOIN raw.payment  AS pay ON pay.order_id = so.order_id
LEFT JOIN raw.shipment AS sh  ON sh.order_id  = so.order_id;
