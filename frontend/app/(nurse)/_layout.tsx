import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { useRequireRole } from '../../lib/use-require-role';

export default function NurseLayout() {
  useRequireRole('nurse');
  // See the same fix in app/(family)/_layout.tsx — a fixed tab bar height
  // leaves the bottom row under the OS gesture strip on notched/gesture-nav
  // phones, where the system intercepts the touch before the tab bar does.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.teal,
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
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="assignments"
        options={{
          title: 'Visits',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="kit"
        options={{
          title: 'Kit',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="medical-bag" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />

      {/*
        The screens below live inside app/(nurse)/ so expo-router's
        file-based routing picks them up automatically — but they are NOT
        meant to be bottom-tab destinations. They're pushed to from
        Profile (contract, kit) or from the teleconsult flow
        (teleconsult-queue -> write-eprescription -> eprescription-signature),
        and the last three are doctor-only.

        Without `href: null` here, expo-router still renders a tab for
        each of them with no icon/title (since none is set), which is
        exactly the row of unlabeled icon-less tabs after "Profile" in
        the screenshots, and pushes "Profile" out of its intended last
        position. `href: null` removes the tab entirely while leaving
        router.push('/(nurse)/...') working normally.
      */}
      <Tabs.Screen name="contract" options={{ href: null }} />
      <Tabs.Screen name="teleconsult-queue" options={{ href: null }} />
      <Tabs.Screen name="write-eprescription" options={{ href: null }} />
      <Tabs.Screen name="eprescription-signature" options={{ href: null }} />
    </Tabs>
  );
}
