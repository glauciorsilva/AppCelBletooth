import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Configuração do app Web do projeto Firebase "appcel-52588".
// Esses valores não são senhas: vão embutidos em qualquer app cliente, e quem
// protege os dados são as regras do Firestore (firestore.rules) e o login.
// Para apontar para outro projeto, defina as variáveis EXPO_PUBLIC_FIREBASE_* no .env.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyB6_gPhiHmISyP7kfXboWEo1d5G-ZfMa9M',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'appcel-52588.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'appcel-52588',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'appcel-52588.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '907394424810',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:907394424810:web:c52ed60ceff18ebcf45c93',
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebase() {
  if (!firebaseConfigured) return null;
  if (!auth || !db) {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    db = getFirestore(app);
  }
  return { auth, db };
}
