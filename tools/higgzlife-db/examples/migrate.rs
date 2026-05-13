//! Run migrations against the DB at the path given as the first arg.
//! Prints the user_version before and after.
//!
//! Usage: cargo run --example migrate -- ~/.higgzlife/data.db

use rusqlite::Connection;

fn main() -> anyhow::Result<()> {
    let path = std::env::args().nth(1).expect("usage: migrate <path>");

    {
        let conn = Connection::open(&path)?;
        let v: i32 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
        eprintln!("before: user_version = {}", v);
    }

    let conn = higgzlife_db::open_and_migrate(&path)?;
    let v: i32 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
    eprintln!("after:  user_version = {}", v);

    Ok(())
}
