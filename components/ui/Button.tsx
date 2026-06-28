import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, font, radius, spacing } from '../../theme/tokens';

type Variant =
  | 'primary'
  | 'venta'
  | 'compra'
  | 'ajuste'
  | 'danger'
  | 'secondary'
  | 'ghost';
type Size = 'md' | 'lg' | 'hero';

const BG: Record<Variant, string> = {
  primary: colors.primary,
  venta: colors.venta,
  compra: colors.compra,
  ajuste: colors.ajuste,
  danger: colors.danger,
  secondary: colors.surface,
  ghost: 'transparent',
};

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  style,
}: Props) {
  const filled = variant !== 'secondary' && variant !== 'ghost';
  const fg = filled ? colors.textInverse : colors.primary;
  const pad =
    size === 'hero'
      ? { paddingVertical: spacing.xl }
      : size === 'lg'
        ? { paddingVertical: spacing.lg }
        : { paddingVertical: spacing.md };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        pad,
        { backgroundColor: BG[variant] },
        variant === 'secondary' && styles.secondary,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={size === 'hero' ? 24 : 18}
              color={fg}
            />
          )}
          <Text
            style={[
              styles.label,
              { color: fg },
              size === 'hero' && styles.labelHero,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  secondary: { borderWidth: 1, borderColor: colors.border },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  label: { fontSize: font.md, fontWeight: '700' },
  labelHero: { fontSize: font.xl },
});
