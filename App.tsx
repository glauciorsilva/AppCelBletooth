import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppStateProvider } from './src/AppState';
import { AccountScreen } from './src/screens/AccountScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { WatchScreen } from './src/screens/WatchScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { colors } from './src/ui';

const TABS = [
  { key: 'workout', label: 'Treino', icon: '🏃' },
  { key: 'watch', label: 'Relógio', icon: '⌚' },
  { key: 'history', label: 'Histórico', icon: '📈' },
  { key: 'account', label: 'Conta', icon: '☁' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default function App() {
  const [tab, setTab] = useState<TabKey>('workout');
  const [historyKey, setHistoryKey] = useState(0);

  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
          <StatusBar style="dark" />
          <View style={{ flex: 1 }}>
            {/* Treino e Relógio ficam montados para não perder estado ao trocar de aba */}
            <View style={[styles.page, tab !== 'workout' && styles.hidden]}>
              <WorkoutScreen />
            </View>
            <View style={[styles.page, tab !== 'watch' && styles.hidden]}>
              <WatchScreen />
            </View>
            {tab === 'history' ? <HistoryScreen focusKey={historyKey} /> : null}
            {tab === 'account' ? <AccountScreen /> : null}
          </View>
          <View style={styles.tabbar}>
            {TABS.map((t) => (
              <Pressable
                key={t.key}
                style={styles.tab}
                onPress={() => {
                  setTab(t.key);
                  if (t.key === 'history') setHistoryKey((k) => k + 1);
                }}
              >
                <Text style={{ fontSize: 20 }}>{t.icon}</Text>
                <Text style={[styles.tabLabel, tab === t.key && { color: colors.primary, fontWeight: '700' }]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
        </SafeAreaView>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  hidden: { display: 'none' },
  tabbar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
