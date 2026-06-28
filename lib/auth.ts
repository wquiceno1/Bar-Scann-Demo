// Sesión de respaldo: login con email/clave y atajo biométrico (huella).
//
// La huella NO es un método de recuperación: en un teléfono nuevo no hay
// credenciales guardadas, así que el primer ingreso es siempre con email/clave.
// Tras ese login se pueden guardar las credenciales (cifradas en SecureStore)
// para que, en ese mismo equipo, la huella desbloquee el ingreso.
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { auth } from './firebase';

const CRED_KEY = 'respaldo_credenciales';

export function usuarioActual(): User | null {
  return auth.currentUser;
}

/** Suscribe a cambios de sesión. Devuelve la función para desuscribir. */
export function onCambioSesion(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export async function iniciarSesion(
  email: string,
  password: string
): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function cerrarSesion(): Promise<void> {
  await signOut(auth);
  // Por seguridad, cerrar sesión también olvida la huella de este equipo.
  await olvidarHuella();
}

// --- Biometría (huella) ---

/** El equipo tiene hardware biométrico y al menos una huella registrada. */
export async function huellaDisponible(): Promise<boolean> {
  const [hardware, registrada] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hardware && registrada;
}

/** Hay credenciales guardadas para ingresar con huella en este equipo. */
export async function huellaConfigurada(): Promise<boolean> {
  return (await SecureStore.getItemAsync(CRED_KEY)) != null;
}

/** Guarda las credenciales (cifradas) para futuros ingresos con huella. */
export async function recordarHuella(
  email: string,
  password: string
): Promise<void> {
  await SecureStore.setItemAsync(
    CRED_KEY,
    JSON.stringify({ email: email.trim(), password })
  );
}

export async function olvidarHuella(): Promise<void> {
  await SecureStore.deleteItemAsync(CRED_KEY);
}

/**
 * Pide la huella y, si pasa, inicia sesión con las credenciales guardadas.
 * Devuelve false si no hay credenciales o el usuario cancela el prompt.
 */
export async function iniciarSesionConHuella(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(CRED_KEY);
  if (!raw) return false;

  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Ingresa con tu huella',
    cancelLabel: 'Usar contraseña',
  });
  if (!res.success) return false;

  const { email, password } = JSON.parse(raw) as {
    email: string;
    password: string;
  };
  await signInWithEmailAndPassword(auth, email, password);
  return true;
}
