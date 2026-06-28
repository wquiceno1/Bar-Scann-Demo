import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Button, Card, Input, Screen } from './ui';
import {
  huellaConfigurada,
  huellaDisponible,
  iniciarSesion,
  iniciarSesionConHuella,
  recordarHuella,
  usuarioActual,
} from '../lib/auth';
import { baseVacia, restaurar } from '../lib/backup';
import { hayRed } from '../lib/red';
import { toast } from '../lib/feedback';
import { colors, font, spacing } from '../theme/tokens';

function mensajeError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (
    code.includes('invalid-credential') ||
    code.includes('wrong-password') ||
    code.includes('user-not-found')
  ) {
    return 'Correo o contraseña incorrectos.';
  }
  if (code.includes('network')) return 'Sin conexión. Revisa tu internet.';
  return (e as Error)?.message ?? 'Error desconocido.';
}

/**
 * Puerta de recuperación que aparece al abrir la app en un equipo "nuevo":
 * base local vacía y sin sesión. Ofrece iniciar sesión para bajar el respaldo,
 * o empezar sin respaldo (negocio nuevo). Una vez que hay datos o sesión, ya
 * no se muestra; la sincronización normal la maneja SyncManager.
 */
export default function RecuperarGate() {
  const db = useSQLiteContext();
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [huella, setHuella] = useState(false);

  const evaluar = useCallback(async () => {
    if (usuarioActual()) {
      setVisible(false);
      return;
    }
    const vacia = await baseVacia(db);
    setVisible(vacia);
    if (vacia) {
      setHuella((await huellaDisponible()) && (await huellaConfigurada()));
    }
  }, [db]);

  useEffect(() => {
    evaluar();
  }, [evaluar]);

  const recuperar = async (emailUsado: string, passwordUsado: string) => {
    if (!(await hayRed())) {
      Alert.alert(
        'Sin conexión',
        'Necesitas internet para recuperar tu respaldo.'
      );
      return;
    }
    const n = await restaurar(db);
    if (
      passwordUsado &&
      (await huellaDisponible()) &&
      !(await huellaConfigurada())
    ) {
      await recordarHuella(emailUsado, passwordUsado);
    }
    setVisible(false);
    Alert.alert(
      'Recuperación completa',
      n > 0
        ? `Se recuperaron ${n} registros desde tu respaldo.`
        : 'No había datos en el respaldo todavía.'
    );
  };

  const login = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Datos incompletos', 'Ingresa correo y contraseña.');
      return;
    }
    setCargando(true);
    try {
      await iniciarSesion(email, password);
      await recuperar(email, password);
    } catch (e) {
      Alert.alert('No se pudo iniciar sesión', mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  const loginHuella = async () => {
    setCargando(true);
    try {
      const ok = await iniciarSesionConHuella();
      if (!ok) toast('Usa tu contraseña');
      else await recuperar('', '');
    } catch (e) {
      Alert.alert('No se pudo iniciar sesión', mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <Screen padded scroll style={styles.fill}>
        <View style={styles.head}>
          <Text style={styles.titulo}>Recuperar respaldo</Text>
          <Text style={styles.sub}>
            Si ya usabas la app en otro teléfono, inicia sesión para recuperar
            tus productos y movimientos. Si es un negocio nuevo, puedes empezar
            sin respaldo.
          </Text>
        </View>

        <Card style={{ gap: spacing.md }}>
          <Input
            label="Correo"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Contraseña"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button
            label="Iniciar sesión y recuperar"
            icon="cloud-download"
            loading={cargando}
            onPress={login}
          />
          {huella && (
            <Button
              label="Entrar con huella"
              icon="finger-print"
              variant="secondary"
              onPress={loginHuella}
            />
          )}
        </Card>

        <Button
          label="Empezar sin respaldo"
          variant="ghost"
          onPress={() => setVisible(false)}
        />
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { justifyContent: 'center', gap: spacing.xl },
  head: { gap: spacing.sm },
  titulo: { fontSize: font.xxl, fontWeight: '800', color: colors.text },
  sub: { fontSize: font.md, color: colors.textMuted },
});
