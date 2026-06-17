import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { DB_NAME, migrateDbIfNeeded } from '../db';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={migrateDbIfNeeded}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="transaccion/[tipo]"
          options={{ presentation: 'modal', title: 'Operación' }}
        />
        <Stack.Screen name="producto/nuevo" options={{ title: 'Nuevo producto' }} />
        <Stack.Screen name="producto/[barcode]" options={{ title: 'Producto' }} />
        <Stack.Screen name="carga-inicial" options={{ title: 'Carga inicial' }} />
        <Stack.Screen name="detalle/[id]" options={{ title: 'Detalle' }} />
      </Stack>
      <StatusBar style="auto" />
    </SQLiteProvider>
  );
}
