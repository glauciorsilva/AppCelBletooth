import * as SQLite from 'expo-sqlite';

// Banco local do celular. Tudo é gravado aqui primeiro; a sincronização com
// o Firebase lê daqui e marca o que já foi enviado.

export type Workout = {
  id: string;
  started_at: number; // epoch ms
  ended_at: number | null;
  distance_m: number;
  duration_s: number;
  avg_hr: number | null;
  max_hr: number | null;
  device_name: string | null;
  synced: number; // 0 | 1
};

export type RoutePoint = {
  workout_id: string;
  ts: number;
  lat: number;
  lon: number;
  alt: number | null;
  speed: number | null;
  accuracy: number | null;
};

export type HrSample = { workout_id: string | null; ts: number; bpm: number };

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('appcel.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS workouts (
          id TEXT PRIMARY KEY NOT NULL,
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          distance_m REAL NOT NULL DEFAULT 0,
          duration_s REAL NOT NULL DEFAULT 0,
          avg_hr REAL,
          max_hr REAL,
          device_name TEXT,
          synced INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS points (
          workout_id TEXT NOT NULL,
          ts INTEGER NOT NULL,
          lat REAL NOT NULL,
          lon REAL NOT NULL,
          alt REAL,
          speed REAL,
          accuracy REAL,
          PRIMARY KEY (workout_id, ts)
        );
        CREATE TABLE IF NOT EXISTS hr_samples (
          workout_id TEXT,
          ts INTEGER NOT NULL,
          bpm INTEGER NOT NULL,
          PRIMARY KEY (ts)
        );
        CREATE TABLE IF NOT EXISTS kv (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function kvGet(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM kv WHERE key = ?', key);
  return row?.value ?? null;
}

export async function kvSet(key: string, value: string | null) {
  const db = await getDb();
  if (value === null) await db.runAsync('DELETE FROM kv WHERE key = ?', key);
  else await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, value);
}

export async function createWorkout(id: string, startedAt: number, deviceName: string | null) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO workouts (id, started_at, device_name) VALUES (?, ?, ?)',
    id,
    startedAt,
    deviceName,
  );
}

export async function insertPoints(points: RoutePoint[]) {
  if (!points.length) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const p of points) {
      await db.runAsync(
        'INSERT OR IGNORE INTO points (workout_id, ts, lat, lon, alt, speed, accuracy) VALUES (?, ?, ?, ?, ?, ?, ?)',
        p.workout_id,
        p.ts,
        p.lat,
        p.lon,
        p.alt,
        p.speed,
        p.accuracy,
      );
    }
  });
}

export async function insertHr(sample: HrSample) {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO hr_samples (workout_id, ts, bpm) VALUES (?, ?, ?)',
    sample.workout_id,
    sample.ts,
    sample.bpm,
  );
}

export async function getPoints(workoutId: string) {
  const db = await getDb();
  return db.getAllAsync<RoutePoint>('SELECT * FROM points WHERE workout_id = ? ORDER BY ts', workoutId);
}

export async function getHr(workoutId: string) {
  const db = await getDb();
  return db.getAllAsync<HrSample>('SELECT * FROM hr_samples WHERE workout_id = ? ORDER BY ts', workoutId);
}

export async function finishWorkout(w: Workout) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE workouts SET ended_at = ?, distance_m = ?, duration_s = ?, avg_hr = ?, max_hr = ?, synced = 0 WHERE id = ?',
    w.ended_at,
    w.distance_m,
    w.duration_s,
    w.avg_hr,
    w.max_hr,
    w.id,
  );
}

export async function listWorkouts() {
  const db = await getDb();
  return db.getAllAsync<Workout>('SELECT * FROM workouts WHERE ended_at IS NOT NULL ORDER BY started_at DESC');
}

export async function listUnsynced() {
  const db = await getDb();
  return db.getAllAsync<Workout>('SELECT * FROM workouts WHERE ended_at IS NOT NULL AND synced = 0');
}

export async function markSynced(id: string) {
  const db = await getDb();
  await db.runAsync('UPDATE workouts SET synced = 1 WHERE id = ?', id);
}

export async function deleteWorkout(id: string) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM points WHERE workout_id = ?', id);
    await db.runAsync('DELETE FROM hr_samples WHERE workout_id = ?', id);
    await db.runAsync('DELETE FROM workouts WHERE id = ?', id);
  });
}
