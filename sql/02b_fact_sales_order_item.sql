-- =====================================================================
-- fact_sales_order_item
-- GRANO: una fila representa una línea de pedido (un producto dentro
--        de un pedido), en la fecha del pedido.
-- Se une con la cabecera para traer fecha, cliente, canal y estado
-- (cada línea tiene 1 sola cabecera: no duplica).
-- Se une con dim_product para obtener product_key (clave subrogada).
-- No se traen los montos de cabecera: se repetirían en cada línea.
-- =====================================================================

CREATE TABLE fact_sales_order_item (
    order_item_id   BIGINT PRIMARY KEY,
    order_id        BIGINT NOT NULL,
    product_key     INTEGER NOT NULL REFERENCES dim_product (product_key),
    date_key        INTEGER NOT NULL REFERENCES dim_date (date_key),
    customer_id     INTEGER NOT NULL REFERENCES dim_customer (customer_id),
    channel_id      INTEGER NOT NULL REFERENCES dim_channel (channel_id),
	shipping_address_id INTEGER REFERENCES dim_address (address_id),
    is_sale         BOOLEAN NOT NULL,
    quantity        INTEGER,
    unit_price      DECIMAL(12, 2),
    discount_amount DECIMAL(12, 2),
    line_total      DECIMAL(12, 2)
);

INSERT INTO fact_sales_order_item
SELECT
    i.order_item_id,
    i.order_id,
    p.product_key,
    CAST(strftime(so.order_date, '%Y%m%d') AS INTEGER) AS date_key,
    so.customer_id,
    so.channel_id,
	so.shipping_address_id,
    so.status IN ('PAID', 'FULFILLED') AS is_sale,
    i.quantity,
    i.unit_price,
    i.discount_amount,
    i.line_total
FROM raw.sales_order_item AS i
JOIN raw.sales_order AS so ON so.order_id  = i.order_id
JOIN dim_product     AS p  ON p.product_id = i.product_id;
