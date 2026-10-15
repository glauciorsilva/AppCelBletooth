import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import type { Device } from 'react-native-ble-plx';
import { useAppState } from '../AppState';
import { ble, connectAndInspect, requestBlePermissions, type DeviceInfo } from '../ble';
import { Button, Card, Stat, colors, styles } from '../ui';

export function WatchScreen() {
  const { device, bpm, bleError, attach, detach } = useAppState();
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<Device[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    ble.stopDeviceScan();
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function scan() {
    if (!(await requestBlePermissions())) {
      Alert.alert('Permissão', 'Permita Bluetooth e "Dispositivos por perto" para encontrar o relógio.');
      return;
    }
    const state = await ble.state();
    if (state !== 'PoweredOn') {
      Alert.alert('Bluetooth desligado', 'Ligue o Bluetooth do celular.');
      return;
    }
    setFound([]);
    setScanning(true);
    ble.startDeviceScan(null, { allowDuplicates: false }, (error, d) => {
      if (error) {
        setScanning(false);
        Alert.alert('Erro na busca', error.message);
        return;
      }
      if (!d || !(d.name || d.localName)) return;
      setFound((prev) => (prev.some((p) => p.id === d.id) ? prev : [...prev, d].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))));
    });
    timer.current = setTimeout(() => {
      ble.stopDeviceScan();
      setScanning(false);
    }, 15000);
  }

  async function connect(d: Device) {
    setConnecting(d.id);
    try {
      const result = await connectAndInspect(d);
      setInfo(result);
      setScanning(false);
      if (result.hasHeartRate) attach(result.device);
      else
        Alert.alert(
          'Sem frequência cardíaca padrão',
          'Conectou, mas o relógio não está transmitindo FC no padrão Bluetooth. No relógio, ative "Transmitir frequência cardíaca" (Heart rate sharing) e tente de novo. A lista de serviços abaixo ajuda no diagnóstico.',
        );
    } catch (e) {
      Alert.alert('Falha ao conectar', (e as Error).message);
    } finally {
      setConnecting(null);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Relógio</Text>

      {device ? (
        <Card>
          <Text style={styles.h2}>{device.name ?? device.localName ?? device.id}</Text>
          <View style={styles.row}>
            <Stat label="Frequência cardíaca" value={bpm ? String(bpm) : '--'} unit="bpm" />
            <Stat label="Bateria" value={info?.battery != null ? String(info.battery) : '--'} unit="%" />
          </View>
          <Button title="Desconectar" variant="ghost" onPress={detach} />
        </Card>
      ) : (
        <Card>
          <Text style={styles.p}>
            Amazfit Stratos: no relógio, abra Configurações e ative a transmissão de frequência cardíaca (Heart rate
            sharing / "Compartilhar FC"). Mantenha o relógio perto do celular e toque em Buscar.
          </Text>
          {bleError ? <Text style={[styles.p, { color: colors.danger }]}>{bleError}</Text> : null}
          <Button title={scanning ? 'Buscando…' : 'Buscar relógio'} onPress={scan} disabled={scanning} />
        </Card>
      )}

      {!device &&
        found.map((d) => (
          <Pressable key={d.id} onPress={() => connect(d)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.h2}>{d.name ?? d.localName}</Text>
                <Text style={styles.p}>
                  {d.id} · sinal {d.rssi ?? '?'} dBm
                </Text>
              </View>
              {connecting === d.id ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: colors.primary }}>Conectar</Text>}
            </Card>
          </Pressable>
        ))}

      {info ? (
        <Card>
          <Text style={styles.h2}>Serviços Bluetooth encontrados</Text>
          {info.services.map((s) => (
            <Text key={s} style={[styles.p, { fontFamily: 'monospace', fontSize: 12 }]}>
              {s}
            </Text>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}
