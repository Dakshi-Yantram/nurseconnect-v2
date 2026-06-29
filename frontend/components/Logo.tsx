import React from 'react';
import { Image, View, StyleSheet, Text } from 'react-native';
import { Colors, Typography } from '../constants/theme';

interface LogoProps {
  size?: number;
  showText?: boolean;
  textColor?: string;
  variant?: 'default' | 'stacked';
}

export const Logo: React.FC<LogoProps> = ({
  size = 56,
  showText = false,
  textColor = Colors.textPrimary,
  variant = 'default',
}) => {
  const stacked = variant === 'stacked';
  return (
    <View
      style={[styles.row, stacked && styles.column]}
      testID="brand-logo"
    >
      <Image
        source={require('../assets/images/logo.jpg')}
        style={{ width: size, height: size, borderRadius: size * 0.18 }}
        resizeMode="contain"
      />
      {showText && (
        <View style={[styles.textWrap, stacked && styles.textWrapStacked]}>
          <Text style={[styles.brand, { color: textColor }]}>NurseConnect</Text>
          <Text style={[styles.tagline, { color: textColor, opacity: 0.7 }]}>
            Care, delivered home
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  column: { flexDirection: 'column', alignItems: 'center' },
  textWrap: { marginLeft: 12 },
  textWrapStacked: { marginLeft: 0, marginTop: 12, alignItems: 'center' },
  brand: { ...Typography.h3, fontWeight: '800' as const },
  tagline: { ...Typography.small },
});
