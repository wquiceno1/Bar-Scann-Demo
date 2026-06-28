import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, font, radius, spacing } from '../../theme/tokens';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
};

export default function Input({
  label,
  hint,
  style,
  secureTextEntry,
  ...rest
}: Props) {
  const [visible, setVisible] = useState(false);
  const esPassword = !!secureTextEntry;

  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <View style={styles.field}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          secureTextEntry={esPassword && !visible}
          style={[styles.input, esPassword && styles.inputConIcono, style]}
          {...rest}
        />
        {esPassword && (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={8}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={
              visible ? 'Ocultar contraseña' : 'Mostrar contraseña'
            }
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  hint: { fontSize: font.xs, color: colors.textMuted },
  field: { position: 'relative', justifyContent: 'center' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.md,
    color: colors.text,
  },
  inputConIcono: { paddingRight: 44 },
  eye: {
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
});
