import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput } from 'react-native';
import { firebaseConfigured, getFirebase } from '../firebase';
import { syncAll } from '../sync';
import { Button, Card, styles } from '../ui';

export function AccountScreen() {
  const fb = getFirebase();
  const [user, setUser] = useState<User | null>(fb?.auth.currentUser ?? null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => (fb ? onAuthStateChanged(fb.auth, setUser) : undefined), [fb]);

  if (!firebaseConfigured || !fb)
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.h1}>Conta</Text>
        <Card>
          <Text style={styles.p}>
            O Firebase ainda não foi configurado neste build. Os treinos ficam salvos só no celular até lá. Veja o README do
            projeto para preencher o arquivo .env.
          </Text>
        </Card>
      </ScrollView>
    );

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.h1}>Conta</Text>
      {user ? (
        <Card>
          <Text style={styles.h2}>{user.email}</Text>
          <Text style={styles.p}>Treinos finalizados são enviados automaticamente para o Firebase (Firestore).</Text>
          <Button
            title={busy ? 'Sincronizando…' : 'Sincronizar agora'}
            disabled={busy}
            onPress={() =>
              run(async () => {
                const r = await syncAll();
                Alert.alert('Sincronização', r.error ?? `${r.sent} treino(s) enviado(s).`);
              })
            }
          />
          <Button title="Sair" variant="ghost" onPress={() => signOut(fb.auth)} />
        </Card>
      ) : (
        <Card>
          <Text style={styles.p}>Entre para guardar seus treinos na nuvem e analisá-los depois.</Text>
          <TextInput style={styles.input} placeholder="E-mail" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={styles.input} placeholder="Senha (mín. 6 caracteres)" secureTextEntry value={password} onChangeText={setPassword} />
          <Button title="Entrar" disabled={busy} onPress={() => run(() => signInWithEmailAndPassword(fb.auth, email.trim(), password))} />
          <Button title="Criar conta" variant="ghost" disabled={busy} onPress={() => run(() => createUserWithEmailAndPassword(fb.auth, email.trim(), password))} />
        </Card>
      )}
    </ScrollView>
  );
}
