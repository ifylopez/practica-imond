-- =====================================================================
-- fact_web_session
-- GRANO: una fila representa una sesión de navegación de un visitante
--        (identificado o anónimo) que empieza en un momento.
-- No tiene montos: se analiza contando filas (factless fact table).
-- Visitante anónimo -> customer_key = -1 ("Anónimo").
-- Fuente y dispositivo -> traffic_key (dim_traffic).
-- OJO: al contar usuarios activos hay que EXCLUIR el -1, si no todos los
-- anónimos cuentan como un único "usuario".
-- =====================================================================

CREATE TABLE fact_web_session (
    session_id   BIGINT PRIMARY KEY,
    date_key     INTEGER NOT NULL REFERENCES dim_date (date_key),
    customer_key INTEGER NOT NULL REFERENCES dim_customer (customer_key),  -- -1 = anónimo
    traffic_key  INTEGER NOT NULL REFERENCES dim_traffic (traffic_key),
    started_at   TIMESTAMP NOT NULL,
    ended_at     TIMESTAMP
);

INSERT INTO fact_web_session
SELECT
    ws.session_id,
    CAST(strftime(ws.started_at, '%Y%m%d') AS INTEGER) AS date_key,
    COALESCE(cu.customer_key, -1) AS customer_key,
    COALESCE(tr.traffic_key, -1)  AS traffic_key,
    ws.started_at,
    ws.ended_at
FROM raw.web_session AS ws
LEFT JOIN dim_customer AS cu ON cu.customer_id = ws.customer_id
LEFT JOIN dim_traffic  AS tr ON tr.source = ws.source AND tr.device = ws.device;
