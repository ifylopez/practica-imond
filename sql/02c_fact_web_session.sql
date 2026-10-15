-- =====================================================================
-- fact_web_session
-- GRANO: una fila representa una sesión de navegación de un visitante
--        (identificado o anónimo) que empieza en un momento.
-- No tiene montos: se analiza contando filas (factless fact table).
-- Visitante anónimo -> customer_key = -1 ("Anónimo").
-- OJO: al contar usuarios activos hay que EXCLUIR el -1, si no todos los
-- anónimos cuentan como un único "usuario".
-- =====================================================================

CREATE TABLE fact_web_session (
    session_id   BIGINT PRIMARY KEY,
    date_key     INTEGER NOT NULL REFERENCES dim_date (date_key),
    customer_key INTEGER NOT NULL REFERENCES dim_customer (customer_key),  -- -1 = anónimo
    started_at   TIMESTAMP NOT NULL,
    ended_at     TIMESTAMP,
    source       VARCHAR,
    device       VARCHAR
);

INSERT INTO fact_web_session
SELECT
    ws.session_id,
    CAST(strftime(ws.started_at, '%Y%m%d') AS INTEGER) AS date_key,
    COALESCE(cu.customer_key, -1) AS customer_key,
    ws.started_at,
    ws.ended_at,
    ws.source,
    ws.device
FROM raw.web_session AS ws
LEFT JOIN dim_customer AS cu ON cu.customer_id = ws.customer_id;
