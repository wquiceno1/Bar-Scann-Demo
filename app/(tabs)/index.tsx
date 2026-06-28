import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/ui';
import { colors, font, radius, shadow, spacing } from '../../theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

function Accion({
  onPress,
  label,
  desc,
  icon,
  color,
}: {
  onPress: () => void;
  label: string;
  desc: string;
  icon: IconName;
  color: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: color }]}>
        <Ionicons name={icon} size={26} color={colors.textInverse} />
      </View>
      <View style={styles.actionBody}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionDesc}>{desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
    </Pressable>
  );
}

export default function OperarScreen() {
  const router = useRouter();

  return (
    <Screen padded>
      <Text style={styles.title}>¿Qué quieres registrar?</Text>
      <Text style={styles.subtitle}>Elige una operación para empezar.</Text>

      <View style={styles.list}>
        <Accion
          onPress={() => router.push('/transaccion/venta')}
          label="Nueva venta"
          desc="Registrar productos vendidos"
          icon="cart"
          color={colors.venta}
        />
        <Accion
          onPress={() => router.push('/transaccion/compra')}
          label="Nueva compra"
          desc="Ingreso de mercadería de proveedor"
          icon="cube"
          color={colors.compra}
        />
        <Accion
          onPress={() => router.push('/transaccion/ajuste')}
          label="Ajuste de inventario"
          desc="Merma, caducidad o conteo físico"
          icon="construct"
          color={colors.ajuste}
        />
      </View>

      <Pressable
        onPress={() => router.push('/carga-inicial')}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
      >
        <Ionicons name="scan" size={20} color={colors.primary} />
        <View style={styles.actionBody}>
          <Text style={styles.secondaryLabel}>Carga inicial del catálogo</Text>
          <Text style={styles.actionDesc}>
            Escanea toda la tienda para empezar
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.primary} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.xxl, fontWeight: '800', color: colors.text },
  subtitle: {
    fontSize: font.md,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  list: { gap: spacing.md },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBody: { flex: 1, flexShrink: 1 },
  actionLabel: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  actionDesc: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  secondaryLabel: { fontSize: font.md, fontWeight: '700', color: colors.primary },
});
