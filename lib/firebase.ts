// Inicialización de Firebase para React Native (Expo).
//
// - La sesión de Auth se persiste con AsyncStorage para que el login
//   email/clave sobreviva a reinicios y el respaldo automático corra sin
//   volver a pedir credenciales.
// - Firestore se inicializa con long-polling forzado: el transporte por
//   streaming de WebChannel es poco fiable en React Native.
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
// getReactNativePersistence solo está tipado en la entrada RN de firebase/auth;
// Metro resuelve la implementación correcta en runtime.
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Las credenciales vienen de variables EXPO_PUBLIC_* (ver .env.example).
// No son secretas (quedan en el bundle), pero las mantenemos fuera del repo.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    'Faltan las variables EXPO_PUBLIC_FIREBASE_* (revisa tu archivo .env).'
  );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// initializeAuth / initializeFirestore solo pueden llamarse una vez por app;
// en hot-reload reutilizamos la instancia ya creada.
let _auth: Auth;
try {
  _auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  _auth = getAuth(app);
}

let _db: Firestore;
try {
  _db = initializeFirestore(app, { experimentalForceLongPolling: true });
} catch {
  _db = getFirestore(app);
}

export const auth = _auth;
export const db = _db;
