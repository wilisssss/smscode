//! Thin hand-written client untuk publik `/v1` API (IDR).
//! Satu fungsi per operationId di OpenAPI; tidak ada logic bisnis di sini.
use std::time::Duration;

use serde::de::DeserializeOwned;
use serde::Serialize;

use super::error::CommandError;
use super::types::*;

const BASE_URL: &str = "https://api.smscode.gg/v1";
const USER_AGENT: &str = concat!("smscode-desktop/", env!("CARGO_PKG_VERSION"));

pub struct Client {
    http: reqwest::Client,
    token: String,
}

impl Client {
    pub fn new(token: String) -> Self {
        let http = reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .timeout(Duration::from_secs(15))
            .build()
            .expect("reqwest client must build");
        Self { http, token }
    }

    async fn request<T: DeserializeOwned>(
        &self,
        req: reqwest::RequestBuilder,
    ) -> Result<T, CommandError> {
        let res = req.bearer_auth(&self.token).send().await?;
        let status = res.status();
        let retry_after = res
            .headers()
            .get(reqwest::header::RETRY_AFTER)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok());

        // Baca sebagai bytes: server kadang mengirim 200 dengan body non-JSON
        // (koneksi terputus di tengah body / challenge page / kosong) — jangan
        // dianggap error fatal, biarkan poller retry sebagai transient.
        let bytes = res.bytes().await?;
        let body: serde_json::Value =
            serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null);

        if body.get("success").and_then(serde_json::Value::as_bool) == Some(true) {
            let data = body.get("data").cloned().unwrap_or(serde_json::Value::Null);
            return Ok(serde_json::from_value(data)?);
        }

        let err = body.get("error");
        let code = err
            .and_then(|e| e.get("code"))
            .and_then(serde_json::Value::as_str)
            .map(str::to_owned)
            .unwrap_or_else(|| format!("HTTP_{}", status.as_u16()));
        let message = err
            .and_then(|e| e.get("message"))
            .and_then(serde_json::Value::as_str)
            .map(str::to_owned)
            .unwrap_or_else(|| {
                // Cuplikan body mentah ke log file untuk diagnosis.
                let preview: String = bytes
                    .iter()
                    .take(300)
                    .map(|b| {
                        if b.is_ascii_graphic() || *b == b' ' {
                            *b as char
                        } else {
                            '.'
                        }
                    })
                    .collect();
                crate::log::append(
                    "http",
                    &format!("HTTP {} non-envelope body: {}", status.as_u16(), preview),
                );
                format!(
                    "Respons server tidak valid (HTTP {}). Akan dicoba lagi otomatis.",
                    status.as_u16()
                )
            });

        Err(CommandError::new(code, message).with_retry(retry_after))
    }

    fn get(&self, path: &str) -> reqwest::RequestBuilder {
        self.http.get(format!("{BASE_URL}{path}"))
    }

    fn post<B: Serialize>(&self, path: &str, body: &B) -> reqwest::RequestBuilder {
        self.http.post(format!("{BASE_URL}{path}")).json(body)
    }

    // ── Account ────────────────────────────────────────────────────────────

    pub async fn balance(&self) -> Result<Balance, CommandError> {
        self.request(self.get("/balance")).await
    }

    // ── Catalog ────────────────────────────────────────────────────────────

    pub async fn countries(&self) -> Result<Vec<Country>, CommandError> {
        self.request(self.get("/catalog/countries")).await
    }

    pub async fn services(&self, country_id: Option<i64>) -> Result<Vec<Service>, CommandError> {
        let mut req = self.get("/catalog/services");
        if let Some(id) = country_id {
            req = req.query(&[("country_id", id)]);
        }
        self.request(req).await
    }

    pub async fn operators(
        &self,
        country_id: i64,
        platform_id: i64,
    ) -> Result<Vec<Operator>, CommandError> {
        let req = self
            .get("/catalog/operators")
            .query(&[("country_id", country_id), ("platform_id", platform_id)]);
        self.request(req).await
    }

    /// Harga termurah dulu. `operator_id: None` = tier "Any".
    pub async fn products(
        &self,
        country_id: i64,
        platform_id: i64,
        operator_id: Option<i64>,
    ) -> Result<Vec<Product>, CommandError> {
        let mut req = self.get("/catalog/products").query(&[
            ("country_id", country_id.to_string()),
            ("platform_id", platform_id.to_string()),
            ("sort", "price_asc".to_string()),
            ("limit", "50".to_string()),
        ]);
        if let Some(op) = operator_id {
            req = req.query(&[("operator_id", op.to_string())]);
        }
        self.request(req).await
    }

    // ── Orders ─────────────────────────────────────────────────────────────

    pub async fn list_orders(
        &self,
        limit: i64,
        offset: i64,
        status: Option<&str>,
    ) -> Result<Vec<Order>, CommandError> {
        let mut req = self
            .get("/orders")
            .query(&[("limit", limit), ("offset", offset)]);
        if let Some(s) = status {
            req = req.query(&[("status", s)]);
        }
        self.request(req).await
    }

    pub async fn get_order(&self, id: i64) -> Result<Order, CommandError> {
        self.request(self.get(&format!("/orders/{id}"))).await
    }

    pub async fn create_order(
        &self,
        body: &CreateOrderRequest,
        idempotency_key: &str,
    ) -> Result<CreateOrderResult, CommandError> {
        let req = self
            .post("/orders/create", body)
            .header("Idempotency-Key", idempotency_key);
        self.request(req).await
    }

    pub async fn cancel_order(&self, id: i64) -> Result<CancelResult, CommandError> {
        self.request(self.post("/orders/cancel", &serde_json::json!({ "id": id })))
            .await
    }

    pub async fn finish_order(&self, id: i64) -> Result<FinishResult, CommandError> {
        self.request(self.post("/orders/finish", &serde_json::json!({ "id": id })))
            .await
    }

    pub async fn resend_order(&self, id: i64) -> Result<ResendResult, CommandError> {
        self.request(self.post("/orders/resend", &serde_json::json!({ "id": id })))
            .await
    }

    pub async fn reactivate_options(&self, id: i64) -> Result<ReactivateOptions, CommandError> {
        self.request(self.get(&format!("/orders/{id}/reactivate-options")))
            .await
    }

    pub async fn reactivate_order(
        &self,
        id: i64,
        max_price: Option<i64>,
        idempotency_key: &str,
    ) -> Result<CreateOrderResult, CommandError> {
        let mut body = serde_json::json!({ "id": id });
        if let Some(mp) = max_price {
            body["max_price"] = serde_json::json!(mp);
        }
        let req = self
            .post("/orders/reactivate", &body)
            .header("Idempotency-Key", idempotency_key);
        self.request(req).await
    }
}
