use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashMap;
use std::path::Path;

use crate::models::{Collection, CostSummary, Generation, Job, JobSource, JobStatus, ListFilter, Reference, TagCount};

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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    trashed_at TEXT
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

-- Generation jobs for tracking in-flight generations
CREATE TABLE IF NOT EXISTS generation_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL DEFAULT 'pending',
    model TEXT NOT NULL,
    prompt TEXT NOT NULL,
    tags TEXT,
    source TEXT NOT NULL,
    ref_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    started_at TEXT,
    completed_at TEXT,
    generation_id INTEGER REFERENCES generations(id),
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON generation_jobs(status);

-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_gen_trashed ON generations(trashed_at);
CREATE INDEX IF NOT EXISTS idx_gen_tags_genid ON generation_tags(generation_id);
CREATE INDEX IF NOT EXISTS idx_gen_model_ts ON generations(model, timestamp DESC);

-- Collections (project folders)
CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS generation_collections (
    generation_id INTEGER REFERENCES generations(id) ON DELETE CASCADE,
    collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
    PRIMARY KEY (generation_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_gc_collection ON generation_collections(collection_id);
"#;

fn parse_job_row(row: &rusqlite::Row) -> rusqlite::Result<Job> {
    let status_str: String = row.get(1)?;
    let source_str: String = row.get(5)?;
    let tags_json: Option<String> = row.get(4)?;

    Ok(Job {
        id: row.get(0)?,
        status: status_str.parse().unwrap_or(JobStatus::Pending),
        model: row.get(2)?,
        prompt: row.get(3)?,
        tags: tags_json.and_then(|s| serde_json::from_str(&s).ok()),
        source: source_str.parse().unwrap_or(JobSource::Cli),
        ref_count: row.get(6)?,
        created_at: row.get(7)?,
        started_at: row.get(8)?,
        completed_at: row.get(9)?,
        generation_id: row.get(10)?,
        error: row.get(11)?,
    })
}

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

        // Add trashed_at column if it doesn't exist (migration for existing DBs)
        let _ = self.conn.execute(
            "ALTER TABLE generations ADD COLUMN trashed_at TEXT",
            [],
        );

        // Add title column if it doesn't exist (migration for existing DBs)
        let _ = self.conn.execute(
            "ALTER TABLE generations ADD COLUMN title TEXT",
            [],
        );

        // Add negative_prompt column if it doesn't exist
        let _ = self.conn.execute(
            "ALTER TABLE generations ADD COLUMN negative_prompt TEXT",
            [],
        );

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
        negative_prompt: Option<&str>,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO generations (slug, prompt, model, provider, timestamp, date, image_path, thumb_path, generation_time_seconds, cost_estimate_usd, seed, width, height, file_size, parent_id, negative_prompt)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![slug, prompt, model, provider, timestamp, date, image_path, thumb_path, generation_time, cost, seed, width, height, file_size, parent_id, negative_prompt],
        ).context("Failed to insert generation")?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_generation(&self, id: i64) -> Result<Option<Generation>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, slug, prompt, model, provider, timestamp, date, image_path, thumb_path,
                    generation_time_seconds, cost_estimate_usd, seed, width, height, file_size,
                    parent_id, starred, created_at, trashed_at, title, negative_prompt
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
                    trashed_at: row.get(18)?,
                    title: row.get(19)?,
                    negative_prompt: row.get(20)?,
                    tags: vec![],
                    references: vec![],
                })
            })
            .optional()?;

        if let Some(mut g) = gen {
            g.tags = self.get_tags_for_generation(g.id)?;
            g.references = self.get_references_for_generation(g.id)?;
            Ok(Some(g))
        } else {
            Ok(None)
        }
    }

    pub fn list_generations(&self, filter: &ListFilter) -> Result<Vec<Generation>> {
        let mut sql = String::from(
            "SELECT DISTINCT g.id, g.slug, g.prompt, g.model, g.provider, g.timestamp, g.date,
                    g.image_path, g.thumb_path, g.generation_time_seconds, g.cost_estimate_usd,
                    g.seed, g.width, g.height, g.file_size, g.parent_id, g.starred, g.created_at, g.trashed_at, g.title, g.negative_prompt
             FROM generations g",
        );

        let mut conditions = vec![];
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![];

        // Trashed filter: show trashed OR exclude trashed (default)
        if filter.show_trashed {
            conditions.push("g.trashed_at IS NOT NULL".to_string());
        } else {
            conditions.push("g.trashed_at IS NULL".to_string());
        }

        // Collection filter
        if let Some(collection_id) = filter.collection_id {
            conditions.push("g.id IN (SELECT generation_id FROM generation_collections WHERE collection_id = ?)".to_string());
            params_vec.push(Box::new(collection_id));
        }

        // Uncategorized: not in any collection
        if filter.uncategorized {
            conditions.push("g.id NOT IN (SELECT generation_id FROM generation_collections)".to_string());
        }

        // Multi-tag filter with AND logic: images must have ALL specified tags
        if let Some(ref tags) = filter.tags {
            if !tags.is_empty() {
                let placeholders: Vec<&str> = tags.iter().map(|_| "?").collect();
                let in_clause = placeholders.join(", ");
                conditions.push(format!(
                    "g.id IN (
                        SELECT gt.generation_id FROM generation_tags gt
                        JOIN tags t ON gt.tag_id = t.id
                        WHERE t.name IN ({})
                        GROUP BY gt.generation_id
                        HAVING COUNT(DISTINCT t.name) = {}
                    )",
                    in_clause,
                    tags.len()
                ));
                for tag in tags {
                    params_vec.push(Box::new(tag.clone()));
                }
            }
        }

        // Exclude generations that have ANY of the excluded tags
        if let Some(ref exclude_tags) = filter.exclude_tags {
            if !exclude_tags.is_empty() {
                let placeholders: Vec<&str> = exclude_tags.iter().map(|_| "?").collect();
                let in_clause = placeholders.join(", ");
                conditions.push(format!(
                    "g.id NOT IN (
                        SELECT gt.generation_id FROM generation_tags gt
                        JOIN tags t ON gt.tag_id = t.id
                        WHERE t.name IN ({})
                    )",
                    in_clause
                ));
                for tag in exclude_tags {
                    params_vec.push(Box::new(tag.clone()));
                }
            }
        }

        if let Some(ref model) = filter.model {
            conditions.push("g.model = ?".to_string());
            params_vec.push(Box::new(model.clone()));
        }

        if filter.starred_only {
            conditions.push("g.starred = 1".to_string());
        }

        if let Some(ref search) = filter.search {
            conditions.push("g.prompt LIKE ?".to_string());
            params_vec.push(Box::new(format!("%{}%", search)));
        }

        if let Some(ref since) = filter.since {
            conditions.push("g.date >= ?".to_string());
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
                trashed_at: row.get(18)?,
                title: row.get(19)?,
                negative_prompt: row.get(20)?,
                tags: vec![],
                references: vec![],
            })
        })?;

        let mut generations: Vec<Generation> = rows.collect::<Result<_, _>>()?;

        if !generations.is_empty() {
            let ids: Vec<i64> = generations.iter().map(|g| g.id).collect();
            let tags_map = self.get_tags_for_generations(&ids)?;
            let refs_map = self.get_references_for_generations(&ids)?;

            for g in &mut generations {
                if let Some(tags) = tags_map.get(&g.id) {
                    g.tags = tags.clone();
                }
                if let Some(refs) = refs_map.get(&g.id) {
                    g.references = refs.clone();
                }
            }
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

    pub fn trash_generation(&self, id: i64) -> Result<bool> {
        let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        let rows = self.conn.execute(
            "UPDATE generations SET trashed_at = ?1 WHERE id = ?2 AND trashed_at IS NULL",
            params![now, id],
        )?;
        Ok(rows > 0)
    }

    pub fn trash_generations(&self, ids: &[i64]) -> Result<usize> {
        if ids.is_empty() {
            return Ok(0);
        }
        let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "UPDATE generations SET trashed_at = ?1 WHERE id IN ({}) AND trashed_at IS NULL",
            placeholders
        );
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now)];
        for id in ids {
            params_vec.push(Box::new(*id));
        }
        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let rows = self.conn.execute(&sql, params_refs.as_slice())?;
        Ok(rows)
    }

    pub fn restore_generation(&self, id: i64) -> Result<bool> {
        let rows = self.conn.execute(
            "UPDATE generations SET trashed_at = NULL WHERE id = ?1 AND trashed_at IS NOT NULL",
            params![id],
        )?;
        Ok(rows > 0)
    }

    pub fn permanently_delete_generation(&self, id: i64) -> Result<Option<String>> {
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

    pub fn update_title(&self, id: i64, title: Option<&str>) -> Result<()> {
        self.conn.execute(
            "UPDATE generations SET title = ?1 WHERE id = ?2",
            params![title, id],
        )?;
        Ok(())
    }

    pub fn update_model(&self, id: i64, model: &str, provider: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE generations SET model = ?1, provider = ?2 WHERE id = ?3",
            params![model, provider, id],
        )?;
        Ok(())
    }

    pub fn update_thumb_path(&self, id: i64, thumb_path: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE generations SET thumb_path = ?1 WHERE id = ?2",
            params![thumb_path, id],
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

    fn get_tags_for_generations(&self, ids: &[i64]) -> Result<HashMap<i64, Vec<String>>> {
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT gt.generation_id, t.name FROM generation_tags gt
             JOIN tags t ON gt.tag_id = t.id
             WHERE gt.generation_id IN ({})",
            placeholders
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let params: Vec<Box<dyn rusqlite::ToSql>> = ids.iter().map(|id| Box::new(*id) as Box<dyn rusqlite::ToSql>).collect();
        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let mut map: HashMap<i64, Vec<String>> = HashMap::new();
        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?;
        for row in rows {
            let (gen_id, tag) = row?;
            map.entry(gen_id).or_default().push(tag);
        }
        Ok(map)
    }

    fn get_references_for_generations(&self, ids: &[i64]) -> Result<HashMap<i64, Vec<Reference>>> {
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT gr.generation_id, r.id, r.hash, r.path, r.created_at
             FROM refs r
             JOIN generation_refs gr ON r.id = gr.ref_id
             WHERE gr.generation_id IN ({})",
            placeholders
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let params: Vec<Box<dyn rusqlite::ToSql>> = ids.iter().map(|id| Box::new(*id) as Box<dyn rusqlite::ToSql>).collect();
        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let mut map: HashMap<i64, Vec<Reference>> = HashMap::new();
        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            Ok((
                row.get::<_, i64>(0)?,
                Reference {
                    id: row.get(1)?,
                    hash: row.get(2)?,
                    path: row.get(3)?,
                    created_at: row.get(4)?,
                },
            ))
        })?;
        for row in rows {
            let (gen_id, reference) = row?;
            map.entry(gen_id).or_default().push(reference);
        }
        Ok(map)
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

    pub fn get_references_for_generation(&self, generation_id: i64) -> Result<Vec<Reference>> {
        let mut stmt = self.conn.prepare(
            "SELECT r.id, r.hash, r.path, r.created_at
             FROM refs r
             JOIN generation_refs gr ON r.id = gr.ref_id
             WHERE gr.generation_id = ?1",
        )?;

        let rows = stmt.query_map(params![generation_id], |row| {
            Ok(Reference {
                id: row.get(0)?,
                hash: row.get(1)?,
                path: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?;

        let mut refs = vec![];
        for row in rows {
            refs.push(row?);
        }
        Ok(refs)
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

    // Job operations

    pub fn create_job(
        &self,
        model: &str,
        prompt: &str,
        tags: Option<&[String]>,
        source: JobSource,
        ref_count: i32,
    ) -> Result<i64> {
        let tags_json = tags.map(|t| serde_json::to_string(t).unwrap_or_default());
        self.conn.execute(
            "INSERT INTO generation_jobs (model, prompt, tags, source, ref_count) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![model, prompt, tags_json, source.to_string(), ref_count],
        ).context("Failed to create job")?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn update_job_started(&self, id: i64) -> Result<()> {
        let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        self.conn.execute(
            "UPDATE generation_jobs SET status = 'running', started_at = ?1 WHERE id = ?2",
            params![now, id],
        ).context("Failed to update job to running")?;
        Ok(())
    }

    pub fn update_job_completed(&self, id: i64, generation_id: i64) -> Result<()> {
        let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        self.conn.execute(
            "UPDATE generation_jobs SET status = 'completed', completed_at = ?1, generation_id = ?2 WHERE id = ?3",
            params![now, generation_id, id],
        ).context("Failed to update job to completed")?;
        Ok(())
    }

    pub fn update_job_failed(&self, id: i64, error: &str) -> Result<()> {
        let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        self.conn.execute(
            "UPDATE generation_jobs SET status = 'failed', completed_at = ?1, error = ?2 WHERE id = ?3",
            params![now, error, id],
        ).context("Failed to update job to failed")?;
        Ok(())
    }

    pub fn list_active_jobs(&self) -> Result<Vec<Job>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, status, model, prompt, tags, source, ref_count, created_at, started_at, completed_at, generation_id, error
             FROM generation_jobs
             WHERE status IN ('pending', 'running')
             ORDER BY created_at DESC",
        )?;

        let rows = stmt.query_map([], parse_job_row)?;
        let mut jobs = vec![];
        for row in rows {
            jobs.push(row?);
        }
        Ok(jobs)
    }

    /// List recent failed jobs (last 2 hours)
    pub fn list_recent_failed_jobs(&self, limit: i64) -> Result<Vec<Job>> {
        let cutoff = chrono::Local::now() - chrono::Duration::hours(2);
        let cutoff_str = cutoff.format("%Y-%m-%dT%H:%M:%S").to_string();

        let mut stmt = self.conn.prepare(
            "SELECT id, status, model, prompt, tags, source, ref_count, created_at, started_at, completed_at, generation_id, error
             FROM generation_jobs
             WHERE status = 'failed' AND completed_at >= ?1
             ORDER BY completed_at DESC
             LIMIT ?2",
        )?;

        let rows = stmt.query_map(params![cutoff_str, limit], parse_job_row)?;
        let mut jobs = vec![];
        for row in rows {
            jobs.push(row?);
        }
        Ok(jobs)
    }

    pub fn cleanup_old_jobs(&self, hours: i64) -> Result<usize> {
        let cutoff = chrono::Local::now() - chrono::Duration::hours(hours);
        let cutoff_str = cutoff.format("%Y-%m-%dT%H:%M:%S").to_string();

        let count = self.conn.execute(
            "DELETE FROM generation_jobs WHERE status IN ('completed', 'failed') AND completed_at < ?1",
            params![cutoff_str],
        ).context("Failed to cleanup old jobs")?;

        Ok(count)
    }

    // Collection operations

    pub fn create_collection(&self, name: &str, description: Option<&str>) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO collections (name, description) VALUES (?1, ?2)",
            params![name, description],
        ).context("Failed to create collection")?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn list_collections(&self) -> Result<Vec<Collection>> {
        let mut stmt = self.conn.prepare(
            "SELECT c.id, c.name, c.description, c.created_at,
                    COUNT(gc.generation_id) as count
             FROM collections c
             LEFT JOIN generation_collections gc ON c.id = gc.collection_id
             LEFT JOIN generations g ON gc.generation_id = g.id AND g.trashed_at IS NULL
             GROUP BY c.id
             ORDER BY c.name ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Collection {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_at: row.get(3)?,
                count: row.get(4)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn add_to_collection(&self, generation_id: i64, collection_name: &str) -> Result<()> {
        let collection_id: i64 = self.conn.query_row(
            "SELECT id FROM collections WHERE name = ?1",
            params![collection_name],
            |row| row.get(0),
        ).context("Collection not found")?;
        self.conn.execute(
            "INSERT OR IGNORE INTO generation_collections (generation_id, collection_id) VALUES (?1, ?2)",
            params![generation_id, collection_id],
        )?;
        Ok(())
    }

    pub fn remove_from_collection(&self, generation_id: i64, collection_name: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM generation_collections WHERE generation_id = ?1 AND collection_id = (SELECT id FROM collections WHERE name = ?2)",
            params![generation_id, collection_name],
        )?;
        Ok(())
    }

    pub fn delete_collection(&self, name: &str) -> Result<bool> {
        let rows = self.conn.execute(
            "DELETE FROM collections WHERE name = ?1",
            params![name],
        )?;
        Ok(rows > 0)
    }

    // Prompt history

    pub fn prompt_history(&self, limit: i64) -> Result<Vec<(i64, String, String)>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, prompt, timestamp FROM generations
             WHERE trashed_at IS NULL
             ORDER BY timestamp DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    /// Mark stalled jobs (pending/running for > 30 minutes) as failed
    pub fn cleanup_stalled_jobs(&self) -> Result<usize> {
        let cutoff = chrono::Local::now() - chrono::Duration::minutes(30);
        let cutoff_str = cutoff.format("%Y-%m-%dT%H:%M:%S").to_string();
        let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();

        let count = self.conn.execute(
            "UPDATE generation_jobs
             SET status = 'failed',
                 error = 'Job timed out after 30 minutes',
                 completed_at = ?1
             WHERE status IN ('pending', 'running') AND created_at < ?2",
            params![now, cutoff_str],
        ).context("Failed to cleanup stalled jobs")?;

        Ok(count)
    }
}
