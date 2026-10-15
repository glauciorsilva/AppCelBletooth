import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';

// Perfil padrão Bluetooth de frequência cardíaca (Heart Rate Service).
export const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
export const HR_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';
export const BATTERY_SERVICE = '0000180f-0000-1000-8000-00805f9b34fb';
export const BATTERY_LEVEL = '00002a19-0000-1000-8000-00805f9b34fb';

export const ble = new BleManager();

export async function requestBlePermissions() {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);
  return Object.values(result).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
}

function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Decodifica o valor da característica 0x2A37.
export function parseHeartRate(b64: string): number | null {
  const bytes = base64ToBytes(b64);
  if (bytes.length < 2) return null;
  const is16bit = (bytes[0] & 0x01) === 1;
  return is16bit ? bytes[1] | (bytes[2] << 8) : bytes[1];
}

export type DeviceInfo = {
  device: Device;
  services: string[];
  hasHeartRate: boolean;
  battery: number | null;
};

export async function connectAndInspect(device: Device): Promise<DeviceInfo> {
  ble.stopDeviceScan();
  const connected = await device.connect({ timeout: 15000 });
  await connected.discoverAllServicesAndCharacteristics();
  const services = (await connected.services()).map((s) => s.uuid.toLowerCase());
  let battery: number | null = null;
  if (services.includes(BATTERY_SERVICE)) {
    try {
      const c = await connected.readCharacteristicForService(BATTERY_SERVICE, BATTERY_LEVEL);
      if (c.value) battery = base64ToBytes(c.value)[0];
    } catch {
      // alguns relógios bloqueiam leitura da bateria
    }
  }
  return { device: connected, services, hasHeartRate: services.includes(HR_SERVICE), battery };
}

export function monitorHeartRate(device: Device, onBpm: (bpm: number) => void, onError: (e: Error) => void): Subscription {
  return device.monitorCharacteristicForService(HR_SERVICE, HR_MEASUREMENT, (error, characteristic) => {
    if (error) {
      onError(error);
      return;
    }
    if (!characteristic?.value) return;
    const bpm = parseHeartRate(characteristic.value);
    if (bpm && bpm > 0) onBpm(bpm);
  });
}
