# Modelo estrella

Generado por `run_sql.py` a partir de las tablas de `warehouse.duckdb`.

```mermaid
erDiagram
    dim_address ||--o{ fact_sales_order : "shipping_address_key"
    dim_address ||--o{ fact_sales_order_item : "shipping_address_key"
    dim_channel ||--o{ fact_nps_response : "channel_key"
    dim_channel ||--o{ fact_sales_order : "channel_key"
    dim_channel ||--o{ fact_sales_order_item : "channel_key"
    dim_customer ||--o{ fact_nps_response : "customer_key"
    dim_customer ||--o{ fact_sales_order : "customer_key"
    dim_customer ||--o{ fact_sales_order_item : "customer_key"
    dim_customer ||--o{ fact_web_session : "customer_key"
    dim_date ||--o{ fact_nps_response : "date_key"
    dim_date ||--o{ fact_sales_order : "date_key"
    dim_date ||--o{ fact_sales_order_item : "date_key"
    dim_date ||--o{ fact_web_session : "date_key"
    dim_order_status ||--o{ fact_sales_order : "order_status_key"
    dim_payment ||--o{ fact_sales_order : "payment_key"
    dim_product ||--o{ fact_sales_order_item : "product_key"
    dim_shipment_status ||--o{ fact_sales_order : "shipment_status_key"
    dim_store ||--o{ fact_sales_order : "store_key"
    dim_traffic ||--o{ fact_web_session : "traffic_key"
    dim_address {
        INTEGER address_key PK
        INTEGER address_id
        VARCHAR city
        VARCHAR province
        VARCHAR province_code
        VARCHAR postal_code
        VARCHAR country_code
        BOOLEAN is_store
    }
    dim_channel {
        INTEGER channel_key PK
        INTEGER channel_id
        VARCHAR code
        VARCHAR name
    }
    dim_customer {
        INTEGER customer_key PK
        INTEGER customer_id
        VARCHAR first_name
        VARCHAR last_name
        VARCHAR full_name
        VARCHAR status
        VARCHAR status_desc
        DATE created_date
        VARCHAR cohort_month
    }
    dim_date {
        INTEGER date_key PK
        DATE date
        INTEGER year
        INTEGER quarter
        INTEGER month
        VARCHAR month_name
        VARCHAR year_month
        INTEGER day
        INTEGER weekday_num
        VARCHAR weekday_name
        BOOLEAN is_weekend
    }
    dim_order_status {
        INTEGER order_status_key PK
        VARCHAR status
        VARCHAR status_desc
        BOOLEAN is_sale
        INTEGER sort_order
    }
    dim_payment {
        INTEGER payment_key PK
        VARCHAR method
        VARCHAR method_desc
        VARCHAR payment_status
        VARCHAR status_desc
    }
    dim_product {
        INTEGER product_key PK
        INTEGER product_id
        VARCHAR sku
        VARCHAR name
        VARCHAR category
        VARCHAR family
        DECIMAL list_price
    }
    dim_shipment_status {
        INTEGER shipment_status_key PK
        VARCHAR status
        VARCHAR status_desc
    }
    dim_store {
        INTEGER store_key PK
        INTEGER store_id
        VARCHAR name
        VARCHAR city
        VARCHAR province
    }
    dim_traffic {
        INTEGER traffic_key PK
        VARCHAR source
        VARCHAR source_desc
        VARCHAR device
    }
    fact_nps_response {
        BIGINT nps_id PK
        INTEGER date_key FK
        INTEGER customer_key FK
        INTEGER channel_key FK
        TIMESTAMP responded_at
        SMALLINT score
        INTEGER is_promoter
        INTEGER is_detractor
    }
    fact_sales_order {
        BIGINT order_id PK
        INTEGER date_key FK
        INTEGER customer_key FK
        INTEGER channel_key FK
        INTEGER store_key FK
        INTEGER shipping_address_key FK
        INTEGER order_status_key FK
        INTEGER payment_key FK
        INTEGER shipment_status_key FK
        TIMESTAMP order_date
        BOOLEAN is_sale
        DECIMAL subtotal
        DECIMAL tax_amount
        DECIMAL shipping_fee
        DECIMAL total_amount
        TIMESTAMP paid_at
        TIMESTAMP shipped_at
        TIMESTAMP delivered_at
    }
    fact_sales_order_item {
        BIGINT order_item_id PK
        BIGINT order_id
        INTEGER product_key FK
        INTEGER date_key FK
        INTEGER customer_key FK
        INTEGER channel_key FK
        INTEGER shipping_address_key FK
        BOOLEAN is_sale
        INTEGER quantity
        DECIMAL unit_price
        DECIMAL discount_amount
        DECIMAL line_total
    }
    fact_web_session {
        BIGINT session_id PK
        INTEGER date_key FK
        INTEGER customer_key FK
        INTEGER traffic_key FK
        TIMESTAMP started_at
        TIMESTAMP ended_at
    }
    filtro_canal {
        VARCHAR canal
    }
    filtro_mes {
        DATE mes
    }
    filtro_producto {
        VARCHAR producto
    }
    filtro_provincia {
        VARCHAR provincia
    }
    mart_clientes_mes {
        DATE mes
        BIGINT compradores
        BIGINT compradores_nuevos
        BIGINT compradores_recurrentes
    }
    mart_cohortes {
        VARCHAR cohorte
        INTEGER meses_desde_alta
        BIGINT tamano_cohorte
        BIGINT clientes_compradores
    }
    mart_dia_semana {
        DATE mes
        VARCHAR canal
        VARCHAR provincia
        INTEGER dia_num
        VARCHAR dia
        BIGINT pedidos
        DECIMAL ventas
    }
    mart_estados {
        DATE mes
        VARCHAR canal
        VARCHAR provincia
        VARCHAR estado
        VARCHAR estado_desc
        INTEGER orden
        BIGINT pedidos
        DECIMAL monto
    }
    mart_logistica {
        DATE mes
        VARCHAR canal
        VARCHAR provincia
        VARCHAR estado_envio
        BIGINT envios
        BIGINT entregados
        HUGEINT dias_entrega_suma
        BIGINT entregas_mas_7_dias
    }
    mart_nps {
        DATE mes
        VARCHAR canal
        BIGINT respuestas
        HUGEINT promotores
        HUGEINT detractores
    }
    mart_nps_puntajes {
        DATE mes
        VARCHAR canal
        SMALLINT puntaje
        BIGINT respuestas
    }
    mart_pagos {
        DATE mes
        VARCHAR canal
        VARCHAR provincia
        VARCHAR medio
        VARCHAR estado_pago
        VARCHAR estado_pedido
        BIGINT pagos
        DECIMAL monto
    }
    mart_productos {
        DATE mes
        VARCHAR canal
        VARCHAR provincia
        VARCHAR producto
        HUGEINT unidades
        DECIMAL ventas_productos
    }
    mart_trafico {
        DATE mes
        VARCHAR fuente
        VARCHAR fuente_desc
        VARCHAR dispositivo
        BIGINT sesiones
        BIGINT sesiones_identificadas
        BIGINT sesiones_con_fin
        HUGEINT minutos_suma
    }
    mart_usuarios {
        DATE mes
        BIGINT usuarios_activos
        BIGINT sesiones
        BIGINT sesiones_anonimas
    }
    mart_ventas {
        DATE mes
        VARCHAR canal
        VARCHAR provincia
        BIGINT pedidos
        DECIMAL ventas
    }
```
