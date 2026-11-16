use crate::domain::{AppSettings, error::AppError};
use rusqlite::{Connection, params};

pub struct SettingsRepository;

impl SettingsRepository {
    pub fn get(conn: &Connection) -> AppSettings {
        let val: Option<String> = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'app_settings'",
                [],
                |row| row.get(0),
            )
            .ok();

        if let Some(json_str) = val {
            serde_json::from_str(&json_str).unwrap_or_default()
        } else {
            AppSettings::default()
        }
    }

    pub fn set(conn: &Connection, settings: &AppSettings) -> Result<(), AppError> {
        let json_str =
            serde_json::to_string(settings).map_err(|e| AppError::StorageError(e.to_string()))?;

        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('app_settings', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![json_str],
        )?;

        Ok(())
    }
}
