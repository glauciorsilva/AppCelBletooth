import { doc, writeBatch } from 'firebase/firestore';
import { getHr, getPoints, listUnsynced, markSynced } from './db';
import { getFirebase } from './firebase';

// Estrutura no Firestore:
//   users/{uid}/workouts/{workoutId}                -> resumo do treino
//   users/{uid}/workouts/{workoutId}/route/{n}      -> pontos GPS em blocos de 400
//   users/{uid}/workouts/{workoutId}/heart_rate/{n} -> amostras de FC em blocos de 1000
const ROUTE_CHUNK = 400;
const HR_CHUNK = 1000;

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function syncAll(): Promise<{ sent: number; error?: string }> {
  const fb = getFirebase();
  if (!fb) return { sent: 0, error: 'Firebase não configurado' };
  const user = fb.auth.currentUser;
  if (!user) return { sent: 0, error: 'Faça login na aba Conta' };

  const pending = await listUnsynced();
  let sent = 0;
  for (const w of pending) {
    const points = await getPoints(w.id);
    const hr = await getHr(w.id);
    const base = doc(fb.db, 'users', user.uid, 'workouts', w.id);
    const batch = writeBatch(fb.db);
    batch.set(base, {
      started_at: new Date(w.started_at),
      ended_at: w.ended_at ? new Date(w.ended_at) : null,
      distance_m: w.distance_m,
      duration_s: w.duration_s,
      avg_hr: w.avg_hr,
      max_hr: w.max_hr,
      device_name: w.device_name,
      point_count: points.length,
      hr_count: hr.length,
    });
    chunk(points, ROUTE_CHUNK).forEach((c, i) => {
      batch.set(doc(base, 'route', String(i).padStart(4, '0')), {
        points: c.map((p) => ({ ts: p.ts, lat: p.lat, lon: p.lon, alt: p.alt, speed: p.speed, acc: p.accuracy })),
      });
    });
    chunk(hr, HR_CHUNK).forEach((c, i) => {
      batch.set(doc(base, 'heart_rate', String(i).padStart(4, '0')), {
        samples: c.map((s) => ({ ts: s.ts, bpm: s.bpm })),
      });
    });
    await batch.commit();
    await markSynced(w.id);
    sent++;
  }
  return { sent };
}
