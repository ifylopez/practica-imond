-- =====================================================================
-- fact_sales_order_item
-- GRANO: una fila representa una línea de pedido (un producto dentro
--        de un pedido), en la fecha del pedido.
-- Se une con la cabecera (raw.sales_order) para traer fecha, cliente,
-- canal, dirección y estado: cada línea tiene 1 sola cabecera, no duplica.
-- Las claves naturales se traducen a claves subrogadas con LEFT JOIN.
-- No se traen los montos de cabecera: se repetirían en cada línea.
-- =====================================================================

CREATE TABLE fact_sales_order_item (
    order_item_id        BIGINT PRIMARY KEY,
    order_id             BIGINT NOT NULL,      -- dimensión degenerada
    product_key          INTEGER NOT NULL REFERENCES dim_product (product_key),
    date_key             INTEGER NOT NULL REFERENCES dim_date (date_key),
    customer_key         INTEGER NOT NULL REFERENCES dim_customer (customer_key),
    channel_key          INTEGER NOT NULL REFERENCES dim_channel (channel_key),
    shipping_address_key INTEGER NOT NULL REFERENCES dim_address (address_key),
    is_sale              BOOLEAN NOT NULL,
    quantity             INTEGER,
    unit_price           DECIMAL(12, 2),
    discount_amount      DECIMAL(12, 2),
    line_total           DECIMAL(12, 2)
);

INSERT INTO fact_sales_order_item
SELECT
    i.order_item_id,
    i.order_id,
    p.product_key,
    CAST(strftime(so.order_date, '%Y%m%d') AS INTEGER) AS date_key,
    COALESCE(cu.customer_key, -1) AS customer_key,
    ch.channel_key                AS channel_key,
    COALESCE(ad.address_key, -1)  AS shipping_address_key,
    so.status IN ('PAID', 'FULFILLED') AS is_sale,
    i.quantity,
    i.unit_price,
    i.discount_amount,
    i.line_total
FROM raw.sales_order_item AS i
JOIN raw.sales_order      AS so ON so.order_id    = i.order_id
JOIN dim_product          AS p  ON p.product_id   = i.product_id
LEFT JOIN dim_customer    AS cu ON cu.customer_id = so.customer_id
LEFT JOIN dim_channel     AS ch ON ch.channel_id  = so.channel_id
LEFT JOIN dim_address     AS ad ON ad.address_id  = so.shipping_address_id;
