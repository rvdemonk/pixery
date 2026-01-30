use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;

use crate::models::{CostSummary, Generation, ListFilter, Reference, TagCount};

const SCHEMA: &str = r#"
-- Core generations table
CREATE TABLE IF NOT EXISTS generations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    prompt TEXT NOT NULL,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    date TEXT NOT NULL,
    image_path TEXT NOT NULL,
    thumb_path TEXT,
    generation_time_seconds REAL,
    cost_estimate_usd REAL,
    seed TEXT,
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    parent_id INTEGER REFERENCES generations(id),
    starred INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tags system
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS generation_tags (
    generation_id INTEGER REFERENCES generations(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (generation_id, tag_id)
);

-- Reference images (deduped by hash)
CREATE TABLE IF NOT EXISTS refs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL UNIQUE,
    path TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS generation_refs (
    generation_id INTEGER REFERENCES generations(id) ON DELETE CASCADE,
    ref_id INTEGER REFERENCES refs(id),
    PRIMARY KEY (generation_id, ref_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gen_timestamp ON generations(timestamp);
CREATE INDEX IF NOT EXISTS idx_gen_model ON generations(model);
CREATE INDEX IF NOT EXISTS idx_gen_starred ON generations(starred);
CREATE INDEX IF NOT EXISTS idx_gen_parent ON generations(parent_id);
CREATE INDEX IF NOT EXISTS idx_gen_date ON generations(date);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
"#;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path).context("Failed to open database")?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .context("Failed to enable foreign keys")?;
        let db = Database { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<()> {
        self.conn
            .execute_batch(SCHEMA)
            .context("Failed to run migrations")?;
        Ok(())
    }

    pub fn insert_generation(
        &self,
        slug: &str,
        prompt: &str,
        model: &str,
        provider: &str,
        timestamp: &str,
        date: &str,
        image_path: &str,
        thumb_path: Option<&str>,
        generation_time: Option<f64>,
        cost: Option<f64>,
        seed: Option<&str>,
        width: Option<i32>,
        height: Option<i32>,
        file_size: Option<i64>,
        parent_id: Option<i64>,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO generations (slug, prompt, model, provider, timestamp, date, image_path, thumb_path, generation_time_seconds, cost_estimate_usd, seed, width, height, file_size, parent_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![slug, prompt, model, provider, timestamp, date, image_path, thumb_path, generation_time, cost, seed, width, height, file_size, parent_id],
        ).context("Failed to insert generation")?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_generation(&self, id: i64) -> Result<Option<Generation>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, slug, prompt, model, provider, timestamp, date, image_path, thumb_path,
                    generation_time_seconds, cost_estimate_usd, seed, width, height, file_size,
                    parent_id, starred, created_at
             FROM generations WHERE id = ?1",
        )?;

        let gen = stmt
            .query_row(params![id], |row| {
                Ok(Generation {
                    id: row.get(0)?,
                    slug: row.get(1)?,
                    prompt: row.get(2)?,
                    model: row.get(3)?,
                    provider: row.get(4)?,
                    timestamp: row.get(5)?,
                    date: row.get(6)?,
                    image_path: row.get(7)?,
                    thumb_path: row.get(8)?,
                    generation_time_seconds: row.get(9)?,
                    cost_estimate_usd: row.get(10)?,
                    seed: row.get(11)?,
                    width: row.get(12)?,
                    height: row.get(13)?,
                    file_size: row.get(14)?,
                    parent_id: row.get(15)?,
                    starred: row.get::<_, i32>(16)? != 0,
                    created_at: row.get(17)?,
                    tags: vec![],
                })
            })
            .optional()?;

        if let Some(mut g) = gen {
            g.tags = self.get_tags_for_generation(g.id)?;
            Ok(Some(g))
        } else {
            Ok(None)
        }
    }

    pub fn list_generations(&self, filter: &ListFilter) -> Result<Vec<Generation>> {
        let mut sql = String::from(
            "SELECT DISTINCT g.id, g.slug, g.prompt, g.model, g.provider, g.timestamp, g.date,
                    g.image_path, g.thumb_path, g.generation_time_seconds, g.cost_estimate_usd,
                    g.seed, g.width, g.height, g.file_size, g.parent_id, g.starred, g.created_at
             FROM generations g",
        );

        let mut conditions = vec![];
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![];

        if filter.tag.is_some() {
            sql.push_str(" JOIN generation_tags gt ON g.id = gt.generation_id JOIN tags t ON gt.tag_id = t.id");
        }

        if let Some(ref tag) = filter.tag {
            conditions.push("t.name = ?");
            params_vec.push(Box::new(tag.clone()));
        }

        if let Some(ref model) = filter.model {
            conditions.push("g.model = ?");
            params_vec.push(Box::new(model.clone()));
        }

        if filter.starred_only {
            conditions.push("g.starred = 1");
        }

        if let Some(ref search) = filter.search {
            conditions.push("g.prompt LIKE ?");
            params_vec.push(Box::new(format!("%{}%", search)));
        }

        if let Some(ref since) = filter.since {
            conditions.push("g.date >= ?");
            params_vec.push(Box::new(since.clone()));
        }

        if !conditions.is_empty() {
            sql.push_str(" WHERE ");
            sql.push_str(&conditions.join(" AND "));
        }

        sql.push_str(" ORDER BY g.timestamp DESC");

        if let Some(limit) = filter.limit {
            sql.push_str(&format!(" LIMIT {}", limit));
        }

        if let Some(offset) = filter.offset {
            sql.push_str(&format!(" OFFSET {}", offset));
        }

        let mut stmt = self.conn.prepare(&sql)?;
        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(Generation {
                id: row.get(0)?,
                slug: row.get(1)?,
                prompt: row.get(2)?,
                model: row.get(3)?,
                provider: row.get(4)?,
                timestamp: row.get(5)?,
                date: row.get(6)?,
                image_path: row.get(7)?,
                thumb_path: row.get(8)?,
                generation_time_seconds: row.get(9)?,
                cost_estimate_usd: row.get(10)?,
                seed: row.get(11)?,
                width: row.get(12)?,
                height: row.get(13)?,
                file_size: row.get(14)?,
                parent_id: row.get(15)?,
                starred: row.get::<_, i32>(16)? != 0,
                created_at: row.get(17)?,
                tags: vec![],
            })
        })?;

        let mut generations = vec![];
        for row in rows {
            let mut g = row?;
            g.tags = self.get_tags_for_generation(g.id)?;
            generations.push(g);
        }

        Ok(generations)
    }

    pub fn search_generations(&self, query: &str, limit: i64) -> Result<Vec<Generation>> {
        self.list_generations(&ListFilter {
            limit: Some(limit),
            search: Some(query.to_string()),
            ..Default::default()
        })
    }

    pub fn toggle_starred(&self, id: i64) -> Result<bool> {
        self.conn.execute(
            "UPDATE generations SET starred = NOT starred WHERE id = ?1",
            params![id],
        )?;

        let starred: i32 = self
            .conn
            .query_row("SELECT starred FROM generations WHERE id = ?1", params![id], |row| {
                row.get(0)
            })?;

        Ok(starred != 0)
    }

    pub fn delete_generation(&self, id: i64) -> Result<Option<String>> {
        let path: Option<String> = self
            .conn
            .query_row(
                "SELECT image_path FROM generations WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .optional()?;

        self.conn
            .execute("DELETE FROM generations WHERE id = ?1", params![id])?;

        Ok(path)
    }

    pub fn update_prompt(&self, id: i64, prompt: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE generations SET prompt = ?1 WHERE id = ?2",
            params![prompt, id],
        )?;
        Ok(())
    }

    // Tag operations

    fn get_or_create_tag(&self, name: &str) -> Result<i64> {
        let existing: Option<i64> = self
            .conn
            .query_row("SELECT id FROM tags WHERE name = ?1", params![name], |row| {
                row.get(0)
            })
            .optional()?;

        if let Some(id) = existing {
            return Ok(id);
        }

        self.conn
            .execute("INSERT INTO tags (name) VALUES (?1)", params![name])?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn add_tags(&self, generation_id: i64, tags: &[String]) -> Result<()> {
        for tag in tags {
            let tag_id = self.get_or_create_tag(tag)?;
            self.conn.execute(
                "INSERT OR IGNORE INTO generation_tags (generation_id, tag_id) VALUES (?1, ?2)",
                params![generation_id, tag_id],
            )?;
        }
        Ok(())
    }

    pub fn remove_tag(&self, generation_id: i64, tag: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM generation_tags WHERE generation_id = ?1 AND tag_id = (SELECT id FROM tags WHERE name = ?2)",
            params![generation_id, tag],
        )?;
        Ok(())
    }

    pub fn get_tags_for_generation(&self, generation_id: i64) -> Result<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT t.name FROM tags t JOIN generation_tags gt ON t.id = gt.tag_id WHERE gt.generation_id = ?1",
        )?;

        let rows = stmt.query_map(params![generation_id], |row| row.get(0))?;
        let mut tags = vec![];
        for row in rows {
            tags.push(row?);
        }
        Ok(tags)
    }

    pub fn list_tags(&self) -> Result<Vec<TagCount>> {
        let mut stmt = self.conn.prepare(
            "SELECT t.name, COUNT(gt.generation_id) as count
             FROM tags t
             LEFT JOIN generation_tags gt ON t.id = gt.tag_id
             GROUP BY t.id
             ORDER BY count DESC, t.name ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(TagCount {
                name: row.get(0)?,
                count: row.get(1)?,
            })
        })?;

        let mut tags = vec![];
        for row in rows {
            tags.push(row?);
        }
        Ok(tags)
    }

    // Reference operations

    pub fn get_or_create_reference(&self, hash: &str, path: &str) -> Result<i64> {
        let existing: Option<i64> = self
            .conn
            .query_row("SELECT id FROM refs WHERE hash = ?1", params![hash], |row| {
                row.get(0)
            })
            .optional()?;

        if let Some(id) = existing {
            return Ok(id);
        }

        self.conn.execute(
            "INSERT INTO refs (hash, path) VALUES (?1, ?2)",
            params![hash, path],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn link_reference(&self, generation_id: i64, ref_id: i64) -> Result<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO generation_refs (generation_id, ref_id) VALUES (?1, ?2)",
            params![generation_id, ref_id],
        )?;
        Ok(())
    }

    pub fn get_reference_by_hash(&self, hash: &str) -> Result<Option<Reference>> {
        self.conn
            .query_row(
                "SELECT id, hash, path, created_at FROM refs WHERE hash = ?1",
                params![hash],
                |row| {
                    Ok(Reference {
                        id: row.get(0)?,
                        hash: row.get(1)?,
                        path: row.get(2)?,
                        created_at: row.get(3)?,
                    })
                },
            )
            .optional()
            .context("Failed to query reference")
    }

    // Cost tracking

    pub fn get_cost_summary(&self, since: Option<&str>) -> Result<CostSummary> {
        let where_clause = if since.is_some() {
            "WHERE date >= ?1"
        } else {
            ""
        };

        let total: f64 = if let Some(s) = since {
            self.conn.query_row(
                &format!(
                    "SELECT COALESCE(SUM(cost_estimate_usd), 0) FROM generations {}",
                    where_clause
                ),
                params![s],
                |row| row.get(0),
            )?
        } else {
            self.conn.query_row(
                "SELECT COALESCE(SUM(cost_estimate_usd), 0) FROM generations",
                [],
                |row| row.get(0),
            )?
        };

        let count: i64 = if let Some(s) = since {
            self.conn.query_row(
                &format!("SELECT COUNT(*) FROM generations {}", where_clause),
                params![s],
                |row| row.get(0),
            )?
        } else {
            self.conn.query_row("SELECT COUNT(*) FROM generations", [], |row| row.get(0))?
        };

        let mut by_model: Vec<(String, f64)> = vec![];
        {
            let sql = format!(
                "SELECT model, COALESCE(SUM(cost_estimate_usd), 0) FROM generations {} GROUP BY model ORDER BY SUM(cost_estimate_usd) DESC",
                where_clause
            );
            let mut stmt = self.conn.prepare(&sql)?;
            let mut query_rows = if let Some(s) = since {
                stmt.query(params![s])?
            } else {
                stmt.query([])?
            };
            while let Some(row) = query_rows.next()? {
                by_model.push((row.get(0)?, row.get(1)?));
            }
        }

        let mut by_day: Vec<(String, f64)> = vec![];
        {
            let sql = format!(
                "SELECT date, COALESCE(SUM(cost_estimate_usd), 0) FROM generations {} GROUP BY date ORDER BY date DESC LIMIT 30",
                where_clause
            );
            let mut stmt = self.conn.prepare(&sql)?;
            let mut query_rows = if let Some(s) = since {
                stmt.query(params![s])?
            } else {
                stmt.query([])?
            };
            while let Some(row) = query_rows.next()? {
                by_day.push((row.get(0)?, row.get(1)?));
            }
        }

        Ok(CostSummary {
            total_usd: total,
            by_model,
            by_day,
            count,
        })
    }
}
