import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { insertPoints, kvGet } from './db';

// Precisa ser importado no ponto de entrada (index.ts) para que a tarefa
// esteja registrada mesmo quando o Android acorda o app em segundo plano.

export const LOCATION_TASK = 'appcel-route-tracking';
export const ACTIVE_WORKOUT_KEY = 'active_workout_id';

type Listener = (locs: Location.LocationObject[]) => void;
const listeners = new Set<Listener>();

export function onLocations(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const workoutId = await kvGet(ACTIVE_WORKOUT_KEY);
  if (!workoutId) return;
  const locs = data.locations ?? [];
  await insertPoints(
    locs.map((l) => ({
      workout_id: workoutId,
      ts: l.timestamp,
      lat: l.coords.latitude,
      lon: l.coords.longitude,
      alt: l.coords.altitude,
      speed: l.coords.speed,
      accuracy: l.coords.accuracy,
    })),
  );
  listeners.forEach((fn) => fn(locs));
});

export async function requestLocationPermissions() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  // Permissão "Permitir o tempo todo" para continuar gravando com a tela apagada.
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.status === 'granted';
}

export async function startTracking() {
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 2000,
    distanceInterval: 3,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'AppCel gravando percurso',
      notificationBody: 'Seu treino está sendo registrado pelo GPS.',
      notificationColor: '#0E7C66',
    },
  });
}

export async function stopTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}
