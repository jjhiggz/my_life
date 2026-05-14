use anyhow::Result;
use rusqlite::Connection;
use std::path::Path;
use std::sync::{Arc, Mutex};

pub mod queries;

/// Database wrapper with thread-safe connection.
///
/// Schema + migrations live in the shared `higgzlife-db` crate; both this
/// server and the Tauri app open the DB through it so they stay in lockstep.
#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    /// Open or create database at the given path
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let conn = higgzlife_db::open_and_migrate(path)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    /// Open in-memory database (for testing)
    pub fn open_in_memory() -> Result<Self> {
        let mut conn = Connection::open_in_memory()?;
        higgzlife_db::migrate(&mut conn)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    /// Execute a closure with the connection
    pub fn with_conn<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&Connection) -> Result<T>,
    {
        let conn = self.conn.lock().unwrap();
        f(&conn)
    }

    /// Execute a closure with a mutable connection (for transactions)
    pub fn with_conn_mut<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&mut Connection) -> Result<T>,
    {
        let mut conn = self.conn.lock().unwrap();
        f(&mut conn)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_open_in_memory() {
        let db = Database::open_in_memory().unwrap();
        assert!(db.with_conn(|_| Ok(())).is_ok());
    }

    #[test]
    fn test_schema_creates_tables() {
        let db = Database::open_in_memory().unwrap();
        db.with_conn(|conn| {
            let count: i32 = conn.query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table'",
                [],
                |row| row.get(0),
            )?;
            assert!(count > 0);
            Ok(())
        })
        .unwrap();
    }
}
