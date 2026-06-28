import { Alert, Platform, ToastAndroid } from 'react-native';

/** Confirmación breve no bloqueante. En Android usa Toast; fallback a Alert. */
export function toast(mensaje: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(mensaje, ToastAndroid.SHORT);
  } else {
    Alert.alert(mensaje);
  }
}
