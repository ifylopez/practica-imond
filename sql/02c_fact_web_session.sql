-- =====================================================================
-- fact_web_session
-- GRANO: una fila representa una sesión de navegación de un visitante
--        (identificado o anónimo) que empieza en un momento.
-- No tiene montos: se analiza contando filas (factless fact table).
-- Usuarios activos = COUNT(DISTINCT customer_id); NULL = anónimo.
-- =====================================================================

CREATE TABLE fact_web_session (
    session_id  BIGINT PRIMARY KEY,
    date_key    INTEGER NOT NULL REFERENCES dim_date (date_key),
    customer_id INTEGER          REFERENCES dim_customer (customer_id),  -- NULL = anónimo
    started_at  TIMESTAMP NOT NULL,
    ended_at    TIMESTAMP,
    source      VARCHAR,
    device      VARCHAR
);

INSERT INTO fact_web_session
SELECT
    session_id,
    CAST(strftime(started_at, '%Y%m%d') AS INTEGER) AS date_key,
    customer_id,
    started_at,
    ended_at,
    source,
    device
FROM raw.web_session;
