-- =====================================================================
-- fact_nps_response
-- GRANO: una fila representa una respuesta a la encuesta NPS de un
--        cliente (o anónima), en un canal, en una fecha.
-- Sin order_id: no se puede cruzar con producto ni pedido.
-- NPS = (SUM(is_promoter) - SUM(is_detractor)) * 100.0 / COUNT(*)
-- =====================================================================

CREATE TABLE fact_nps_response (
    nps_id       BIGINT PRIMARY KEY,
    date_key     INTEGER NOT NULL REFERENCES dim_date (date_key),
    customer_id  INTEGER          REFERENCES dim_customer (customer_id),  -- NULL = anónima
    channel_id   INTEGER NOT NULL REFERENCES dim_channel (channel_id),
    responded_at TIMESTAMP NOT NULL,
    score        SMALLINT NOT NULL,
    is_promoter  INTEGER NOT NULL,     -- 1 si score 9-10
    is_detractor INTEGER NOT NULL      -- 1 si score 0-6
);

INSERT INTO fact_nps_response
SELECT
    nps_id,
    CAST(strftime(responded_at, '%Y%m%d') AS INTEGER) AS date_key,
    customer_id,
    channel_id,
    responded_at,
    score,
    CASE WHEN score >= 9 THEN 1 ELSE 0 END AS is_promoter,
    CASE WHEN score <= 6 THEN 1 ELSE 0 END AS is_detractor
FROM raw.nps_response;
