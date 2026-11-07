import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { ended, today } from './model.mjs'

export class Store {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS candidates(id TEXT PRIMARY KEY,source_id TEXT NOT NULL,fingerprint TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL,first_seen TEXT NOT NULL,last_seen TEXT NOT NULL,last_run TEXT);
      CREATE INDEX IF NOT EXISTS candidate_fingerprint ON candidates(fingerprint);
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,started_at TEXT NOT NULL,finished_at TEXT,status TEXT NOT NULL,result TEXT);
      CREATE TABLE IF NOT EXISTS source_runs(source_id TEXT PRIMARY KEY,last_attempt TEXT,last_success TEXT,status TEXT,error TEXT);
      CREATE TABLE IF NOT EXISTS imports(candidate_id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,actor_id TEXT NOT NULL,status TEXT NOT NULL,opportunity_id TEXT,created_at TEXT NOT NULL,error TEXT);
      CREATE TABLE IF NOT EXISTS preferences(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      INSERT OR IGNORE INTO preferences VALUES('scheduler','false');
      INSERT OR IGNORE INTO preferences VALUES('lease','0');`)
  }
  close() {
    this.db.close()
  }
  preference(key, value) {
    if (value !== undefined)
      this.db
        .prepare(
          'INSERT INTO preferences VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        )
        .run(key, String(value))
    return this.db.prepare('SELECT value FROM preferences WHERE key=?').get(key)?.value
  }
  acquire(now = Date.now()) {
    return !!this.db
      .prepare(
        "UPDATE preferences SET value=? WHERE key='lease' AND CAST(value AS INTEGER)<? RETURNING value",
      )
      .get(String(now + 15 * 60_000), now)
  }
  release() {
    this.preference('lease', '0')
  }
  source(sourceId) {
    return this.db.prepare('SELECT * FROM source_runs WHERE source_id=?').get(sourceId)
  }
  sourceStatus(id, status, error = '') {
    const now = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO source_runs VALUES(?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET last_attempt=excluded.last_attempt,last_success=CASE WHEN excluded.status='success' THEN excluded.last_success ELSE source_runs.last_success END,status=excluded.status,error=excluded.error`,
      )
      .run(id, now, status === 'success' ? now : null, status, error.slice(0, 300))
  }
  upsert(record, runId) {
    const existing = this.db
      .prepare('SELECT payload,status FROM candidates WHERE id=?')
      .get(record.id)
    const old = existing ? JSON.parse(existing.payload) : null
    const duplicate = this.db
      .prepare(
        "SELECT id FROM candidates WHERE fingerprint=? AND id<>? AND status NOT IN ('excluded','withdrawn') LIMIT 1",
      )
      .get(record.fingerprint, record.id)
    let status = record.status
    if (existing?.status === 'imported') status = 'imported'
    else if (existing?.status === 'rejected' && old?.contentHash === record.contentHash)
      status = 'rejected'
    else if (duplicate && status === 'pending') status = 'duplicate'
    const payload = {
      ...record,
      sourceChanged:
        existing?.status === 'imported' &&
        (old?.sourceChanged || old?.contentHash !== record.contentHash),
      duplicateOf: duplicate?.id || null,
    }
    this.db
      .prepare(
        `INSERT INTO candidates VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET fingerprint=excluded.fingerprint,payload=excluded.payload,status=excluded.status,last_seen=excluded.last_seen,last_run=excluded.last_run`,
      )
      .run(
        record.id,
        record.sourceId,
        record.fingerprint,
        JSON.stringify(payload),
        status,
        record.observedAt,
        record.observedAt,
        runId,
      )
  }
  withdrawMissing(sourceId, runId, states, from, through) {
    if (!states.length) return // Nationwide page caps must never withdraw unscoped records.
    this.db
      .prepare(
        `UPDATE candidates SET payload=json_set(payload,'$.sourceMissing',json('true')) WHERE source_id=? AND status='imported' AND last_run<>? AND json_extract(payload,'$.date') BETWEEN ? AND ? AND json_extract(payload,'$.state') IN (${states.map(() => '?').join(',')})`,
      )
      .run(sourceId, runId, from, through, ...states)
    this.db
      .prepare(
        `UPDATE candidates SET status='withdrawn' WHERE source_id=? AND status IN ('pending','duplicate') AND last_run<>? AND json_extract(payload,'$.date') BETWEEN ? AND ? AND json_extract(payload,'$.state') IN (${states.map(() => '?').join(',')})`,
      )
      .run(sourceId, runId, from, through, ...states)
  }
  list({ status = '', q = '', state = '' } = {}) {
    let rows = this.db
      .prepare(
        "SELECT * FROM candidates ORDER BY json_extract(payload,'$.date'),first_seen DESC LIMIT 5000",
      )
      .all()
      .map((row) => this.unpack(row))
    if (status) rows = rows.filter((r) => r.status === status)
    if (state) rows = rows.filter((r) => r.state === state)
    if (q)
      rows = rows.filter((r) =>
        `${r.title} ${r.organizer} ${r.location} ${r.city}`.toLowerCase().includes(q.toLowerCase()),
      )
    return rows
  }
  unpack(row) {
    const value = JSON.parse(row.payload)
    const expired =
      row.status === 'pending' &&
      ((value.date && value.date < today(new Date(), value.timezone || undefined)) ||
        ended(value.date, value.endTime, value.timezone))
    return {
      ...value,
      status: expired ? 'expired' : row.status,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      import: this.import(row.id) || null,
    }
  }
  get(id) {
    const row = this.db.prepare('SELECT * FROM candidates WHERE id=?').get(id)
    return row ? this.unpack(row) : null
  }
  reject(id) {
    this.db
      .prepare(
        "UPDATE candidates SET status='rejected' WHERE id=? AND status IN ('pending','duplicate','withdrawn')",
      )
      .run(id)
  }
  import(id) {
    return this.db.prepare('SELECT * FROM imports WHERE candidate_id=?').get(id)
  }
  reserve(id, org, actor) {
    this.db
      .prepare(
        "INSERT INTO imports(candidate_id,organization_id,actor_id,status,created_at) VALUES(?,?,?,'pending',?)",
      )
      .run(id, org, actor, new Date().toISOString())
  }
  imported(id, opportunityId) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.db
        .prepare(
          "UPDATE imports SET status='imported',opportunity_id=?,error=NULL WHERE candidate_id=?",
        )
        .run(opportunityId, id)
      this.db.prepare("UPDATE candidates SET status='imported' WHERE id=?").run(id)
      this.db.exec('COMMIT')
    } catch (e) {
      this.db.exec('ROLLBACK')
      throw e
    }
  }
  uncertain(id) {
    this.db
      .prepare(
        "UPDATE imports SET status='uncertain',error='Remote outcome needs reconciliation; no automatic retry.' WHERE candidate_id=?",
      )
      .run(id)
  }
  failed(id) {
    this.db.prepare("DELETE FROM imports WHERE candidate_id=? AND status='pending'").run(id)
  }
  startRun(id) {
    this.db
      .prepare("INSERT INTO runs(id,started_at,status) VALUES(?,?,'running')")
      .run(id, new Date().toISOString())
  }
  finishRun(id, result) {
    this.db
      .prepare('UPDATE runs SET finished_at=?,status=?,result=? WHERE id=?')
      .run(
        new Date().toISOString(),
        result.errors.length ? 'partial' : 'success',
        JSON.stringify(result),
        id,
      )
    this.db.exec(
      'DELETE FROM runs WHERE id NOT IN (SELECT id FROM runs ORDER BY started_at DESC LIMIT 100)',
    )
    this.db
      .prepare(
        "DELETE FROM candidates WHERE status<>'imported' AND id NOT IN (SELECT candidate_id FROM imports) AND last_seen<?",
      )
      .run(new Date(Date.now() - 90 * 86400_000).toISOString())
  }
  runs() {
    return this.db
      .prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT 10')
      .all()
      .map((r) => ({ ...r, result: r.result ? JSON.parse(r.result) : null }))
  }
}
