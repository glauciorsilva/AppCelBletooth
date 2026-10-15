import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Device, Subscription } from 'react-native-ble-plx';
import { ble, monitorHeartRate } from './ble';
import { insertHr, kvGet } from './db';
import { ACTIVE_WORKOUT_KEY } from './locationTask';

// Estado compartilhado entre as telas: relógio conectado e FC ao vivo.
// Cada batimento recebido durante um treino é gravado no SQLite (no máximo 1 por segundo).

type Ctx = {
  device: Device | null;
  bpm: number | null;
  bleError: string | null;
  attach: (d: Device) => void;
  detach: () => Promise<void>;
  activeWorkoutId: string | null;
  setActiveWorkoutId: (id: string | null) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [device, setDevice] = useState<Device | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [bleError, setBleError] = useState<string | null>(null);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);
  const sub = useRef<Subscription | null>(null);
  const lastSaved = useRef(0);
  const workoutRef = useRef<string | null>(null);
  workoutRef.current = activeWorkoutId;

  useEffect(() => {
    kvGet(ACTIVE_WORKOUT_KEY).then(setActiveWorkoutId);
  }, []);

  const attach = useCallback((d: Device) => {
    sub.current?.remove();
    setDevice(d);
    setBleError(null);
    sub.current = monitorHeartRate(
      d,
      (value) => {
        setBpm(value);
        const now = Date.now();
        if (workoutRef.current && now - lastSaved.current >= 1000) {
          lastSaved.current = now;
          insertHr({ workout_id: workoutRef.current, ts: now, bpm: value }).catch(() => {});
        }
      },
      (e) => setBleError(e.message),
    );
    d.onDisconnected(() => {
      setBpm(null);
      setDevice(null);
      setBleError('Relógio desconectado');
    });
  }, []);

  const detach = useCallback(async () => {
    sub.current?.remove();
    sub.current = null;
    if (device) await ble.cancelDeviceConnection(device.id).catch(() => {});
    setDevice(null);
    setBpm(null);
  }, [device]);

  return (
    <AppCtx.Provider value={{ device, bpm, bleError, attach, detach, activeWorkoutId, setActiveWorkoutId }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useAppState fora do AppStateProvider');
  return ctx;
}
