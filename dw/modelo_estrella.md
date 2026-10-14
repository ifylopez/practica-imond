# Modelo estrella

Generado por `run_sql.py` a partir de las tablas de `warehouse.duckdb`.

```mermaid
erDiagram
    dim_address ||--o{ fact_sales_order : "shipping_address_id"
    dim_channel ||--o{ fact_nps_response : "channel_id"
    dim_channel ||--o{ fact_sales_order : "channel_id"
    dim_channel ||--o{ fact_sales_order_item : "channel_id"
    dim_customer ||--o{ fact_nps_response : "customer_id"
    dim_customer ||--o{ fact_sales_order : "customer_id"
    dim_customer ||--o{ fact_sales_order_item : "customer_id"
    dim_customer ||--o{ fact_web_session : "customer_id"
    dim_date ||--o{ fact_nps_response : "date_key"
    dim_date ||--o{ fact_sales_order : "date_key"
    dim_date ||--o{ fact_sales_order_item : "date_key"
    dim_date ||--o{ fact_web_session : "date_key"
    dim_product ||--o{ fact_sales_order_item : "product_key"
    dim_store ||--o{ fact_sales_order : "store_id"
    dim_address {
        INTEGER address_id PK
        VARCHAR city
        VARCHAR province
        VARCHAR postal_code
    }
    dim_channel {
        INTEGER channel_id PK
        VARCHAR code
        VARCHAR name
    }
    dim_customer {
        INTEGER customer_id PK
        VARCHAR first_name
        VARCHAR last_name
        VARCHAR status
        TIMESTAMP created_at
    }
    dim_date {
        INTEGER date_key PK
        DATE date
        INTEGER year
        INTEGER month
        VARCHAR month_name
        INTEGER day
        VARCHAR weekday
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
    dim_store {
        INTEGER store_id PK
        VARCHAR name
        VARCHAR city
        VARCHAR province
    }
    fact_nps_response {
        BIGINT nps_id PK
        INTEGER date_key FK
        INTEGER customer_id FK
        INTEGER channel_id FK
        TIMESTAMP responded_at
        SMALLINT score
        INTEGER is_promoter
        INTEGER is_detractor
    }
    fact_sales_order {
        BIGINT order_id PK
        INTEGER date_key FK
        INTEGER customer_id FK
        INTEGER channel_id FK
        INTEGER store_id FK
        INTEGER shipping_address_id FK
        TIMESTAMP order_date
        VARCHAR status
        BOOLEAN is_sale
        DECIMAL subtotal
        DECIMAL tax_amount
        DECIMAL shipping_fee
        DECIMAL total_amount
        VARCHAR payment_method
        VARCHAR payment_status
        TIMESTAMP paid_at
        VARCHAR shipment_status
        TIMESTAMP shipped_at
        TIMESTAMP delivered_at
    }
    fact_sales_order_item {
        BIGINT order_item_id PK
        BIGINT order_id
        INTEGER product_key FK
        INTEGER date_key FK
        INTEGER customer_id FK
        INTEGER channel_id FK
        BOOLEAN is_sale
        INTEGER quantity
        DECIMAL unit_price
        DECIMAL discount_amount
        DECIMAL line_total
    }
    fact_web_session {
        BIGINT session_id PK
        INTEGER date_key FK
        INTEGER customer_id FK
        TIMESTAMP started_at
        TIMESTAMP ended_at
        VARCHAR source
        VARCHAR device
    }
```
