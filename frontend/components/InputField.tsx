import React from 'react';
import { TextInput, View, Text, StyleSheet, TextInputProps, TouchableOpacity } from 'react-native';
import { Colors, Radius, Typography, Spacing } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  iconLeft?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  onIconRightPress?: () => void;
  prefix?: string;
}

export const InputField: React.FC<Props> = ({
  label,
  error,
  iconLeft,
  iconRight,
  onIconRightPress,
  prefix,
  style,
  ...rest
}) => {
  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.box, error ? styles.boxError : null]}>
        {iconLeft && (
          <Ionicons name={iconLeft} size={20} color={Colors.textTertiary} style={{ marginRight: 8 }} />
        )}
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={Colors.textTertiary}
          {...rest}
        />
        {iconRight && (
          <TouchableOpacity onPress={onIconRightPress}>
            <Ionicons name={iconRight} size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md },
  label: { ...Typography.small, color: Colors.textSecondary, marginBottom: 6, fontWeight: '600' as const },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  boxError: { borderColor: Colors.error },
  prefix: { ...Typography.body, color: Colors.textPrimary, marginRight: 6, fontWeight: '600' as const },
  input: { flex: 1, ...Typography.body, color: Colors.textPrimary, paddingVertical: 14 },
  error: { ...Typography.small, color: Colors.error, marginTop: 4 },
});
