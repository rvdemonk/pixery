# Code Cleanup & Hygiene

> Audit 2026-02-06 | Part 1 of 4

Concrete refactors to reduce duplication, fix bugs, and improve maintainability. Estimated ~1,700 LOC net reduction.

---

## Priority 1: Extract Shared Generation Workflow

**Files:** `cli.rs:637-730`, `commands.rs:15-115`

Both CLI and GUI implement identical post-generation logic:

```
get model info -> create job -> mark running -> call provider -> save to archive
-> insert generation -> add tags -> store references -> mark completed
```

**Action:** Create `workflow.rs` with a shared `perform_generation()` function. Both `cli.rs` and `commands.rs` call into it. CLI wraps in `tokio::runtime::Runtime`, GUI calls directly via Tauri async.

```rust
// workflow.rs
pub async fn perform_generation(
    db: &Database,
    prompt: &str,
    model: &str,
    tags: &[String],
    reference_paths: &[String],
    source: JobSource,
) -> Result<(i64, Generation)> {
    // All shared logic here
}
```

**Saves:** ~95 lines, eliminates maintenance divergence risk.

---

## Priority 2: Fix N+1 Query in `list_generations`

**File:** `db.rs:309-315`

```rust
for row in rows {
    let mut g = row?;
    g.tags = self.get_tags_for_generation(g.id)?;         // query per row
    g.references = self.get_references_for_generation(g.id)?; // query per row
    generations.push(g);
}
```

Listing 50 generations fires 101 queries. Replace with batch queries:

```sql
SELECT gt.generation_id, t.name
FROM generation_tags gt
JOIN tags t ON gt.tag_id = t.id
WHERE gt.generation_id IN (?, ?, ...)
```

Then distribute results into generations in Rust via a `HashMap<i64, Vec<String>>`. Same pattern for references.

**Impact:** 101 queries -> 3 queries for a 50-item list.

---

## Priority 3: Add Missing Database Indexes

**File:** `db.rs` SCHEMA constant

Add to schema:

```sql
CREATE INDEX IF NOT EXISTS idx_gen_trashed ON generations(trashed_at);
CREATE INDEX IF NOT EXISTS idx_gen_tags_genid ON generation_tags(generation_id);
CREATE INDEX IF NOT EXISTS idx_gen_model_ts ON generations(model, timestamp DESC);
```

- `idx_gen_trashed` -- every `list_generations` filters `WHERE trashed_at IS NULL`
- `idx_gen_tags_genid` -- tag subquery joins on `generation_id` frequently
- `idx_gen_model_ts` -- model-filtered listings sort by timestamp

**Effort:** 5 minutes. Immediate benefit to all filtered queries.

---

## Priority 4: Fix Timestamp Slicing Bug

**File:** `cli.rs:767-772`

```rust
let timestamp = format!(
    "{}T{}:{}:{}",
    date,
    &time_str[0..2.min(time_str.len())],
    &time_str[2..4.min(time_str.len())],  // panics if time_str < 3 chars
    &time_str[4..6.min(time_str.len())]
);
```

If `time_str` is shorter than 6 characters, slicing panics. Fix by padding:

```rust
let time_str = format!("{:0<6}", time_str); // pad to 6 chars with zeros
```

Or validate length before slicing and bail with a clear error.

---

## Priority 5: Delete Dead Code

**Frontend:**

| File | Lines | Reason |
|------|-------|--------|
| `src/components/GenerateForm.tsx` | 168 | Entirely unused, replaced by GenerateModal |
| `src/components/Compare.tsx` | 118 | Not wired to any UI trigger |
| `App.tsx:449` | 1 | Dead TODO for compare |

**Action:** Delete `GenerateForm.tsx`. Either delete `Compare.tsx` or wire it up (see Part 3). Remove the dead TODO.

**Saves:** 287 lines of dead code.

---

## Priority 6: Deduplicate Utilities

### `parse_since()` -- exists in both `cli.rs:882-907` and `commands.rs:223-261`

Extract to shared module (e.g., `utils.rs` or add to `models.rs`). Commands version adds "today" support -- merge that into the shared version.

### `mime_type()` -- defined in both `archive.rs:215-222` and `providers/mod.rs:46-53`

Delete one, import from the other. `archive.rs` is the natural home since it's used for file operations.

### `load_as_base64()` vs `image_to_base64()` -- `archive.rs:209-212` and `providers/mod.rs:37-43`

Same function, different names. Keep one, alias or delete the other.

**Saves:** ~60 lines.

---

## Priority 7: Extract Job Row Parser

**File:** `db.rs:703-728` and `db.rs:744-769`

`list_active_jobs()` and `list_recent_failed_jobs()` contain identical row-to-Job parsing. Extract:

```rust
fn parse_job_row(row: &rusqlite::Row) -> rusqlite::Result<Job> {
    let status_str: String = row.get(1)?;
    let source_str: String = row.get(5)?;
    let tags_json: Option<String> = row.get(4)?;
    Ok(Job {
        id: row.get(0)?,
        status: status_str.parse().unwrap_or(JobStatus::Pending),
        // ... rest of fields
    })
}
```

**Saves:** ~50 lines.

---

## Priority 8: Compile Regex Once

**File:** `cli.rs:832`

```rust
let re = regex::Regex::new(r"(\d{4})(\d{2})(\d{2})-(\d{6})").ok();
```

Compiled on every `import` call. Use `std::sync::OnceLock`:

```rust
static DATE_RE: OnceLock<Regex> = OnceLock::new();
let re = DATE_RE.get_or_init(|| Regex::new(r"(\d{4})(\d{2})(\d{2})-(\d{6})").unwrap());
```

---

## Priority 9: Share `reqwest::Client`

**Files:** All providers (`gemini.rs`, `fal.rs`, `openai.rs`, `selfhosted.rs`)

Each provider creates `reqwest::Client::new()` per generation, discarding connection pools. Create a shared client:

```rust
// providers/mod.rs
use std::sync::OnceLock;
static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

pub fn client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| reqwest::Client::new())
}
```

Pass to each provider's `generate()` function or let them call `super::client()`.

---

## Priority 10: Add `negative_prompt` Support

Currently the database, CLI, and GUI have no concept of negative prompts despite the self-hosted models and prompting guides relying on them heavily. The server.py defaults fill in, but users can't override.

**Changes needed:**

- Add `negative_prompt TEXT` column to `generations` table (migration)
- Add `negative_prompt: Option<String>` to `GenerationResult`, `GenerateParams`, `Generation` structs
- Add `--negative` flag to CLI generate command
- Pass through to each provider's `generate()` function
- Add textarea to GUI generate modal
- Self-hosted provider: pass to `negative_prompt` field in request body
- Cloud providers: append to prompt where applicable (Gemini doesn't use negatives; fal/OpenAI ignore)

**Effort:** ~40 lines backend, ~30 lines frontend.

---

## Summary

| Item | LOC Saved | Effort | Impact |
|------|-----------|--------|--------|
| Shared generation workflow | ~95 | Medium | High -- prevents divergence bugs |
| N+1 query fix | ~0 (rewrite) | Medium | High -- 30x fewer queries |
| Missing indexes | +3 | Trivial | Medium -- faster filtered queries |
| Timestamp bug fix | ~2 | Trivial | High -- prevents panic |
| Delete dead code | ~287 | Trivial | Low -- reduces noise |
| Deduplicate utilities | ~60 | Easy | Medium -- single source of truth |
| Job row parser | ~50 | Easy | Low -- cleaner db.rs |
| Compile regex once | ~2 | Trivial | Low -- negligible perf |
| Share reqwest client | ~5 | Easy | Low -- connection pooling |
| Negative prompt support | +70 | Medium | High -- unblocks prompt workflows |
