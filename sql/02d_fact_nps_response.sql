-- =====================================================================
-- fact_nps_response
-- GRANO: una fila representa una respuesta a la encuesta NPS de un
--        cliente (o anónima), en un canal, en una fecha.
-- Sin order_id: no se puede cruzar con producto ni pedido.
-- Respuesta anónima -> customer_key = -1.
-- NPS = (SUM(is_promoter) - SUM(is_detractor)) * 100.0 / COUNT(*)
-- =====================================================================

CREATE TABLE fact_nps_response (
    nps_id       BIGINT PRIMARY KEY,
    date_key     INTEGER NOT NULL REFERENCES dim_date (date_key),
    customer_key INTEGER NOT NULL REFERENCES dim_customer (customer_key),  -- -1 = anónima
    channel_key  INTEGER NOT NULL REFERENCES dim_channel (channel_key),
    responded_at TIMESTAMP NOT NULL,
    score        SMALLINT NOT NULL,
    is_promoter  INTEGER NOT NULL,     -- 1 si score 9-10
    is_detractor INTEGER NOT NULL      -- 1 si score 0-6
);

INSERT INTO fact_nps_response
SELECT
    n.nps_id,
    CAST(strftime(n.responded_at, '%Y%m%d') AS INTEGER) AS date_key,
    COALESCE(cu.customer_key, -1) AS customer_key,
    ch.channel_key                AS channel_key,
    n.responded_at,
    n.score,
    CASE WHEN n.score >= 9 THEN 1 ELSE 0 END AS is_promoter,
    CASE WHEN n.score <= 6 THEN 1 ELSE 0 END AS is_detractor
FROM raw.nps_response AS n
LEFT JOIN dim_customer AS cu ON cu.customer_id = n.customer_id
LEFT JOIN dim_channel  AS ch ON ch.channel_id  = n.channel_id;
