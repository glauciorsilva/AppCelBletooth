import type { RoutePoint } from './db';

// Pontos com precisão pior que isso (em metros) são descartados no cálculo de distância.
export const MAX_ACCURACY_M = 30;

export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function goodPoints(points: RoutePoint[]) {
  return points.filter((p) => p.accuracy == null || p.accuracy <= MAX_ACCURACY_M);
}

export function totalDistance(points: RoutePoint[]) {
  const pts = goodPoints(points);
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1], pts[i]);
  return d;
}

export function formatDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatKm(m: number) {
  return (m / 1000).toFixed(2);
}

// Ritmo em min/km
export function formatPace(distanceM: number, durationS: number) {
  if (distanceM < 10) return '--:--';
  const secPerKm = durationS / (distanceM / 1000);
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Gera um arquivo GPX (formato aceito por Strava, Google Earth etc.)
export function toGpx(name: string, points: RoutePoint[]) {
  const trkpts = points
    .map(
      (p) =>
        `<trkpt lat="${p.lat}" lon="${p.lon}">${p.alt != null ? `<ele>${p.alt.toFixed(1)}</ele>` : ''}<time>${new Date(p.ts).toISOString()}</time></trkpt>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="AppCel" xmlns="http://www.topografix.com/GPX/1/1">
<trk><name>${name}</name><trkseg>
${trkpts}
</trkseg></trk>
</gpx>`;
}
