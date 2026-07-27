import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { EmptyState } from '../components/EmptyState';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';

export default function NotificationsScreen() {
  const notifications = useStore((s) => s.notifications);
  const markRead = useStore((s) => s.markNotificationRead);
  const markAllRead = useStore((s) => s.markAllRead);
  const refreshNotifications = useStore((s) => s.refreshNotifications);
  const unread = notifications.filter((n) => !n.read).length;
  const [refreshing, setRefreshing] = useState(false);

  // Pull fresh on focus — a dispatch or payment event may have landed while
  // the user was on another screen.
  useFocusEffect(
    useCallback(() => {
      refreshNotifications().catch(() => {});
    }, [refreshNotifications]),
  );

  const grouped = notifications.reduce<Record<string, typeof notifications>>((acc, n) => {
    if (!acc[n.group]) acc[n.group] = [];
    acc[n.group].push(n);
    return acc;
  }, {});
  const data = Object.entries(grouped).flatMap(([group, items]) => [
    { id: 'h-' + group, header: group } as any,
    ...items,
  ]);

  return (
    <SafeAreaView style={styles.safe} testID="notifications-screen" edges={['top']}>
      <OfflineBanner />
      <Header
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
        rightIcon="checkmark-done-outline"
        onRightPress={markAllRead}
      />
      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="We’ll notify you of bookings, payments and important alerts."
          icon="notifications-off-outline"
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i: any) => i.id}
          contentContainerStyle={{ padding: Spacing.lg }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await refreshNotifications().catch(() => {});
                setRefreshing(false);
              }}
            />
          }
          renderItem={({ item }: any) => {
            if (item.header) {
              return <Text style={styles.group}>{item.header}</Text>;
            }
            return (
              <TouchableOpacity
                style={[styles.row, !item.read && styles.unread]}
                onPress={() => markRead(item.id)}
                testID={`notif-${item.id}`}
              >
                <View style={[styles.icon, { backgroundColor: getIconBg(item.type) }]}>
                  <Ionicons name={getIcon(item.type) as any} size={18} color={getIconColor(item.type)} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.body}>{item.body}</Text>
                  <Text style={styles.time}>{item.time}</Text>
                </View>
                {!item.read && <View style={styles.dot} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const getIcon = (t: string) => (t === 'payment' ? 'card' : t === 'booking' ? 'medkit' : t === 'alert' ? 'alert-circle' : 'information-circle');
const getIconColor = (t: string) =>
  t === 'payment' ? Colors.success : t === 'booking' ? Colors.primary : t === 'alert' ? Colors.warning : Colors.info;
const getIconBg = (t: string) =>
  t === 'payment' ? Colors.successBg : t === 'booking' ? Colors.infoBg : t === 'alert' ? Colors.warningBg : Colors.surfaceAlt;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  group: { ...Typography.caption, color: Colors.textTertiary, marginVertical: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 8,
  },
  unread: { borderWidth: 1, borderColor: Colors.primary },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.bodyBold, color: Colors.textPrimary },
  body: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  time: { ...Typography.caption, color: Colors.textTertiary, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginLeft: 8 },
});
