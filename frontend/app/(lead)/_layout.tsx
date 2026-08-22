import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { useRequireRole } from '../../lib/use-require-role';

/**
 * Clinical training lead portal.
 *
 * Leads review what trainers submit — approve/reject/publish modules and
 * assessments — and inspect the attempts nurses have taken. They can also
 * author content and record practical sign-offs, so those tabs are shared
 * with the trainer portal.
 */
export default function LeadLayout() {
  useRequireRole('clinical_lead');
  // See app/(family)/_layout.tsx — a fixed tab bar height doesn't account
  // for the home-indicator safe area on notched/gesture-nav phones.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.divider,
          height: 54 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(10, insets.bottom),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="review"
        options={{
          title: 'Review',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-text-clock" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="attempts"
        options={{
          title: 'Attempts',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-box" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="authoring"
        options={{
          title: 'Authoring',
          tabBarIcon: ({ color, size }) => <Ionicons name="create" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
