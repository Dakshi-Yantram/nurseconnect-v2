import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../constants/theme';

interface Props {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  rightBadge?: number;
  centered?: boolean;
  fallbackHref?: string;
}

export const Header: React.FC<Props> = ({
  title,
  subtitle,
  showBack = true,
  rightIcon,
  onRightPress,
  rightBadge,
  centered = true,
  fallbackHref = '/(family)/dashboard',
}) => {
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackHref as any);
    }
  };
  return (
    <View style={styles.wrap}>
      {showBack ? (
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleBack}
          testID="header-back"
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconBtn} />
      )}
      <View style={[styles.center, !centered && { alignItems: 'flex-start' }]}>
        {title && <Text style={styles.title}>{title}</Text>}
        {subtitle && <Text style={styles.sub}>{subtitle}</Text>}
      </View>
      {rightIcon ? (
        <TouchableOpacity style={styles.iconBtn} onPress={onRightPress} testID="header-right">
          <Ionicons name={rightIcon} size={22} color={Colors.textPrimary} />
          {rightBadge && rightBadge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{rightBadge}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      ) : (
        <View style={styles.iconBtn} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.bgApp,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  title: { ...Typography.h4, color: Colors.textPrimary, fontWeight: '700' as const },
  sub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' as const },
});
