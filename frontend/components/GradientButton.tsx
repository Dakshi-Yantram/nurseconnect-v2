import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Radius, Shadows, Typography } from '../constants/theme';

interface Props {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent';
  fullWidth?: boolean;
  style?: ViewStyle;
  testID?: string;
  icon?: React.ReactNode;
}

export const GradientButton: React.FC<Props> = ({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  fullWidth = true,
  style,
  testID,
  icon,
}) => {
  const isDisabled = disabled || loading;

  if (variant === 'outline' || variant === 'ghost' || variant === 'secondary') {
    const isOutline = variant === 'outline';
    const isGhost = variant === 'ghost';
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        testID={testID}
        style={[
          styles.btn,
          fullWidth && { width: '100%' },
          isOutline && styles.outline,
          isGhost && styles.ghost,
          variant === 'secondary' && styles.secondary,
          isDisabled && { opacity: 0.5 },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <>
            {icon}
            <Text
              style={[
                styles.text,
                {
                  color: isOutline || isGhost ? Colors.primary : Colors.textPrimary,
                  marginLeft: icon ? 8 : 0,
                },
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  const colors = variant === 'accent' ? Gradients.accent : Gradients.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      testID={testID}
      style={[fullWidth && { width: '100%' }, isDisabled && { opacity: 0.6 }, style]}
    >
      <LinearGradient
        colors={colors as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.btn, styles.gradient]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon}
            <Text style={[styles.text, { color: '#fff', marginLeft: icon ? 8 : 0 }]}>
              {title}
            </Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    minHeight: 54,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  gradient: { ...Shadows.floating },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ghost: { backgroundColor: 'transparent' },
  secondary: { backgroundColor: Colors.surfaceAlt },
  text: { ...Typography.h4, fontWeight: '700' as const },
});
