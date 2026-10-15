import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useAppState } from '../AppState';
import { createWorkout, finishWorkout, getHr, getPoints, kvGet, kvSet, type RoutePoint } from '../db';
import { formatDuration, formatKm, formatPace, goodPoints, totalDistance, uuid } from '../geo';
import { ACTIVE_WORKOUT_KEY, onLocations, requestLocationPermissions, startTracking, stopTracking } from '../locationTask';
import { RouteMap } from '../RouteMap';
import { syncAll } from '../sync';
import { Button, Card, Stat, colors, styles } from '../ui';

export function WorkoutScreen() {
  const { activeWorkoutId, setActiveWorkoutId, bpm, device } = useAppState();
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Retoma um treino em andamento (ex.: o app foi fechado durante a gravação).
  useEffect(() => {
    if (!activeWorkoutId) return;
    (async () => {
      setPoints(await getPoints(activeWorkoutId));
      const s = await kvGet('active_workout_started');
      setStartedAt(s ? Number(s) : Date.now());
    })();
    const off = onLocations(async () => setPoints(await getPoints(activeWorkoutId)));
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      off();
      clearInterval(t);
    };
  }, [activeWorkoutId]);

  const distance = useMemo(() => totalDistance(points), [points]);
  const elapsed = startedAt ? (now - startedAt) / 1000 : 0;
  const latLngs = useMemo(() => goodPoints(points).map((p) => [p.lat, p.lon] as [number, number]), [points]);

  async function start() {
    const ok = await requestLocationPermissions();
    if (!ok) {
      Alert.alert(
        'Permissão de localização',
        'Para gravar o percurso com a tela apagada, permita a localização "o tempo todo" nas configurações do app.',
      );
      return;
    }
    const id = uuid();
    const ts = Date.now();
    await createWorkout(id, ts, device?.name ?? null);
    await kvSet(ACTIVE_WORKOUT_KEY, id);
    await kvSet('active_workout_started', String(ts));
    setPoints([]);
    setStartedAt(ts);
    setNow(ts);
    setActiveWorkoutId(id);
    await startTracking();
  }

  async function stop() {
    if (!activeWorkoutId || !startedAt) return;
    await stopTracking();
    const id = activeWorkoutId;
    const pts = await getPoints(id);
    const hr = await getHr(id);
    const end = Date.now();
    const bpms = hr.map((h) => h.bpm);
    await finishWorkout({
      id,
      started_at: startedAt,
      ended_at: end,
      distance_m: totalDistance(pts),
      duration_s: (end - startedAt) / 1000,
      avg_hr: bpms.length ? bpms.reduce((a, b) => a + b, 0) / bpms.length : null,
      max_hr: bpms.length ? Math.max(...bpms) : null,
      device_name: device?.name ?? null,
      synced: 0,
    });
    await kvSet(ACTIVE_WORKOUT_KEY, null);
    await kvSet('active_workout_started', null);
    setActiveWorkoutId(null);
    setStartedAt(null);
    syncAll().catch(() => {}); // envia para o Firebase se estiver logado
    Alert.alert('Treino salvo', `${formatKm(totalDistance(pts))} km em ${formatDuration((end - startedAt) / 1000)}`);
  }

  const recording = Boolean(activeWorkoutId);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Treino</Text>
      <RouteMap points={latLngs} follow={recording} height={300} />
      <Card>
        <View style={styles.row}>
          <Stat label="Tempo" value={formatDuration(elapsed)} />
          <Stat label="Distância" value={formatKm(distance)} unit="km" />
        </View>
        <View style={styles.row}>
          <Stat label="Ritmo" value={formatPace(distance, elapsed)} unit="/km" />
          <Stat label={device ? 'FC (relógio)' : 'FC — conecte o relógio'} value={bpm ? String(bpm) : '--'} unit="bpm" />
        </View>
      </Card>
      {recording ? (
        <Button title="Finalizar treino" variant="danger" onPress={() => Alert.alert('Finalizar?', 'Salvar este treino?', [
          { text: 'Continuar', style: 'cancel' },
          { text: 'Finalizar', style: 'destructive', onPress: stop },
        ])} />
      ) : (
        <Button title="Iniciar treino" onPress={start} />
      )}
      <Text style={[styles.p, { color: recording ? colors.primary : colors.muted }]}>
        {recording
          ? `Gravando · ${points.length} pontos GPS. Pode bloquear a tela, a gravação continua.`
          : 'Toque em Iniciar para gravar o percurso pelo GPS. Conecte o relógio na aba Relógio para registrar a frequência cardíaca.'}
      </Text>
    </ScrollView>
  );
}
