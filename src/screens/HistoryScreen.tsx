import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { deleteWorkout, getHr, getPoints, listWorkouts, type HrSample, type RoutePoint, type Workout } from '../db';
import { formatDuration, formatKm, formatPace, goodPoints, toGpx } from '../geo';
import { RouteMap } from '../RouteMap';
import { Button, Card, Stat, colors, styles } from '../ui';

function dateLabel(ts: number) {
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function HistoryScreen({ focusKey }: { focusKey: number }) {
  const [items, setItems] = useState<Workout[]>([]);
  const [selected, setSelected] = useState<Workout | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setItems(await listWorkouts());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, focusKey]);

  if (selected)
    return (
      <WorkoutDetail
        workout={selected}
        onBack={() => setSelected(null)}
        onDeleted={() => {
          setSelected(null);
          load();
        }}
      />
    );

  const totalKm = items.reduce((a, w) => a + w.distance_m, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
      <Text style={styles.h1}>Histórico</Text>
      <Card>
        <View style={styles.row}>
          <Stat label="Treinos" value={String(items.length)} />
          <Stat label="Distância total" value={formatKm(totalKm)} unit="km" />
        </View>
      </Card>
      {items.length === 0 ? <Text style={styles.p}>Nenhum treino gravado ainda.</Text> : null}
      {items.map((w) => (
        <Pressable key={w.id} onPress={() => setSelected(w)}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.h2}>{dateLabel(w.started_at)}</Text>
              <Text style={{ color: w.synced ? colors.primary : colors.muted, fontSize: 12 }}>{w.synced ? '☁ sincronizado' : 'só no celular'}</Text>
            </View>
            <Text style={styles.p}>
              {formatKm(w.distance_m)} km · {formatDuration(w.duration_s)} · {formatPace(w.distance_m, w.duration_s)} /km
              {w.avg_hr ? ` · FC média ${Math.round(w.avg_hr)} bpm` : ''}
            </Text>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function WorkoutDetail({ workout: w, onBack, onDeleted }: { workout: Workout; onBack: () => void; onDeleted: () => void }) {
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [hr, setHr] = useState<HrSample[]>([]);

  useEffect(() => {
    getPoints(w.id).then(setPoints);
    getHr(w.id).then(setHr);
  }, [w.id]);

  const latLngs = useMemo(() => goodPoints(points).map((p) => [p.lat, p.lon] as [number, number]), [points]);
  const elevGain = useMemo(() => {
    let g = 0;
    const pts = goodPoints(points).filter((p) => p.alt != null);
    for (let i = 1; i < pts.length; i++) {
      const d = (pts[i].alt as number) - (pts[i - 1].alt as number);
      if (d > 0) g += d;
    }
    return g;
  }, [points]);

  // Zonas de FC simples, com FC máx estimada em 190 bpm (ajustável no futuro).
  const zones = useMemo(() => {
    const max = 190;
    const bounds = [0.6, 0.7, 0.8, 0.9];
    const counts = [0, 0, 0, 0, 0];
    hr.forEach((s) => {
      const r = s.bpm / max;
      const z = bounds.findIndex((b) => r < b);
      counts[z === -1 ? 4 : z]++;
    });
    return counts.map((c) => (hr.length ? Math.round((c / hr.length) * 100) : 0));
  }, [hr]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Button title="‹ Voltar" variant="ghost" onPress={onBack} />
      <Text style={styles.h1}>{dateLabel(w.started_at)}</Text>
      <RouteMap points={latLngs} height={280} />
      <Card>
        <View style={styles.row}>
          <Stat label="Distância" value={formatKm(w.distance_m)} unit="km" />
          <Stat label="Tempo" value={formatDuration(w.duration_s)} />
          <Stat label="Ritmo" value={formatPace(w.distance_m, w.duration_s)} unit="/km" />
        </View>
        <View style={styles.row}>
          <Stat label="FC média" value={w.avg_hr ? String(Math.round(w.avg_hr)) : '--'} unit="bpm" />
          <Stat label="FC máx" value={w.max_hr ? String(w.max_hr) : '--'} unit="bpm" />
          <Stat label="Subida" value={String(Math.round(elevGain))} unit="m" />
        </View>
      </Card>
      {hr.length > 0 ? (
        <Card>
          <Text style={styles.h2}>Zonas de frequência cardíaca</Text>
          {zones.map((pct, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.p, { width: 28 }]}>Z{i + 1}</Text>
              <View style={{ flex: 1, height: 10, backgroundColor: colors.border, borderRadius: 5 }}>
                <View style={{ width: `${pct}%`, height: 10, backgroundColor: colors.primary, borderRadius: 5 }} />
              </View>
              <Text style={[styles.p, { width: 40, textAlign: 'right' }]}>{pct}%</Text>
            </View>
          ))}
        </Card>
      ) : null}
      <Button
        title="Exportar GPX"
        variant="ghost"
        onPress={() => Share.share({ title: 'percurso.gpx', message: toGpx(`Treino ${dateLabel(w.started_at)}`, points) })}
      />
      <Button
        title="Excluir treino"
        variant="danger"
        onPress={() =>
          Alert.alert('Excluir?', 'Remove o treino deste celular (a cópia no Firebase continua).', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Excluir', style: 'destructive', onPress: async () => { await deleteWorkout(w.id); onDeleted(); } },
          ])
        }
      />
    </ScrollView>
  );
}
