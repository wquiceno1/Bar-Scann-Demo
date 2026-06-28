import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { User } from 'firebase/auth';
import { Button, Card, Input, Screen } from '../../components/ui';
import { getMargenGeneral, setConfig } from '../../db/configuracion';
import {
  cerrarSesion,
  huellaConfigurada,
  huellaDisponible,
  iniciarSesion,
  iniciarSesionConHuella,
  olvidarHuella,
  onCambioSesion,
  recordarHuella,
  usuarioActual,
} from '../../lib/auth';
import { estadoRespaldo, respaldar } from '../../lib/backup';
import { toast } from '../../lib/feedback';
import { colors, font, spacing } from '../../theme/tokens';

function fechaLegible(iso: string | null): string {
  if (!iso) return 'Nunca';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Nunca' : d.toLocaleString('es-CO');
}

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

export default function AjustesScreen() {
  const db = useSQLiteContext();
  const [margen, setMargen] = useState('');

  // --- Respaldo ---
  const [usuario, setUsuario] = useState<User | null>(usuarioActual());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [respaldando, setRespaldando] = useState(false);
  const [huellaDisp, setHuellaDisp] = useState(false);
  const [huellaConf, setHuellaConf] = useState(false);
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState(0);
  // Guarda la contraseña de la sesión actual para poder activar la huella
  // sin volver a pedirla. Se limpia al cerrar sesión.
  const pwRef = useRef<string | null>(null);

  const refrescar = useCallback(async () => {
    const u = usuarioActual();
    setUsuario(u);
    setHuellaDisp(await huellaDisponible());
    setHuellaConf(await huellaConfigurada());
    if (u) {
      const e = await estadoRespaldo(db);
      setUltimo(e.ultimoRespaldo);
      setPendientes(e.pendientes);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      getMargenGeneral(db).then((m) => setMargen(String(m)));
      refrescar();
      return onCambioSesion(() => refrescar());
    }, [db, refrescar])
  );

  const guardarMargen = async () => {
    const n = Number(margen);
    if (!Number.isFinite(n) || n < 0) {
      Alert.alert('Margen inválido', 'Ingresa un porcentaje válido.');
      return;
    }
    await setConfig(db, 'margen_general_pct', String(n));
    toast(`Margen general guardado: ${n}%`);
  };

  const login = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Datos incompletos', 'Ingresa correo y contraseña.');
      return;
    }
    setCargando(true);
    try {
      await iniciarSesion(email, password);
      pwRef.current = password;
      setPassword('');
      await refrescar();
      toast('Sesión iniciada');
      if ((await huellaDisponible()) && !(await huellaConfigurada())) {
        Alert.alert(
          'Ingreso con huella',
          '¿Activar el ingreso con huella en este equipo para la próxima vez?',
          [
            { text: 'Ahora no', style: 'cancel' },
            { text: 'Activar', onPress: activarHuella },
          ]
        );
      }
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
      if (!ok) {
        toast('Usa tu contraseña');
      } else {
        await refrescar();
        toast('Sesión iniciada');
      }
    } catch (e) {
      Alert.alert('No se pudo iniciar sesión', mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  const respaldarAhora = async () => {
    setRespaldando(true);
    try {
      const n = await respaldar(db);
      await refrescar();
      toast(
        n > 0 ? `Respaldo completo (${n} cambios)` : 'Todo ya estaba respaldado'
      );
    } catch (e) {
      Alert.alert('No se pudo respaldar', mensajeError(e));
    } finally {
      setRespaldando(false);
    }
  };

  const activarHuella = async () => {
    if (!pwRef.current) {
      Alert.alert(
        'Vuelve a iniciar sesión',
        'Cierra sesión e ingresa de nuevo para activar la huella.'
      );
      return;
    }
    await recordarHuella(usuario?.email ?? email, pwRef.current);
    await refrescar();
    toast('Huella activada');
  };

  const desactivarHuella = async () => {
    await olvidarHuella();
    await refrescar();
    toast('Huella desactivada');
  };

  const logout = async () => {
    await cerrarSesion();
    pwRef.current = null;
    await refrescar();
    toast('Sesión cerrada');
  };

  return (
    <Screen padded scroll>
      <Card style={{ gap: spacing.md }}>
        <Input
          label="Margen general (%)"
          hint="Se usa para sugerir precios en modo “calcular con margen”, salvo que el producto tenga su propio margen."
          keyboardType="numeric"
          value={margen}
          onChangeText={setMargen}
        />
        <Button label="Guardar" icon="save" onPress={guardarMargen} />
      </Card>

      <Card style={[styles.respaldo, { gap: spacing.sm }]}>
        <View style={styles.head}>
          <Ionicons
            name={usuario ? 'cloud-done-outline' : 'cloud-offline-outline'}
            size={20}
            color={usuario ? colors.venta : colors.textMuted}
          />
          <Text style={styles.title}>Respaldo</Text>
        </View>

        {usuario ? (
          <>
            <Text style={styles.help}>Cuenta: {usuario.email}</Text>
            <Text style={styles.help}>
              Último respaldo: {fechaLegible(ultimo)}
            </Text>
            <Text style={styles.help}>Cambios pendientes: {pendientes}</Text>
            <Button
              label="Respaldar ahora"
              icon="cloud-upload"
              loading={respaldando}
              onPress={respaldarAhora}
            />
            {huellaDisp &&
              (huellaConf ? (
                <Button
                  label="Desactivar huella"
                  icon="finger-print"
                  variant="secondary"
                  onPress={desactivarHuella}
                />
              ) : (
                <Button
                  label="Activar ingreso con huella"
                  icon="finger-print"
                  variant="secondary"
                  onPress={activarHuella}
                />
              ))}
            <Button
              label="Cerrar sesión"
              icon="log-out"
              variant="ghost"
              onPress={logout}
            />
          </>
        ) : (
          <>
            <Text style={styles.help}>
              Inicia sesión para activar el respaldo en la nube y poder
              recuperar tus datos si pierdes el teléfono.
            </Text>
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
              label="Iniciar sesión"
              icon="log-in"
              loading={cargando}
              onPress={login}
            />
            {huellaDisp && huellaConf && (
              <Button
                label="Entrar con huella"
                icon="finger-print"
                variant="secondary"
                onPress={loginHuella}
              />
            )}
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  help: { fontSize: font.sm, color: colors.textMuted },
  respaldo: { marginTop: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: font.md, fontWeight: '700', color: colors.text },
});
