import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useStore } from '../store';
import { registerAuthFailureHandler } from '../lib/api';

export default function RootLayout() {
  const router = useRouter();
  const bootstrapSession = useStore((s) => s.bootstrapSession);

  useEffect(() => {
    // Restore session from secure storage on app launch
    bootstrapSession();
    // Wire global 401-after-refresh-fail handler to redirect to login
    registerAuthFailureHandler(() => {
      router.replace('/role-select');
    });
  }, [bootstrapSession, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="role-select" />
          <Stack.Screen name="login" />
          <Stack.Screen name="otp" />
          <Stack.Screen name="register" />
          <Stack.Screen name="(family)" />
          <Stack.Screen name="(nurse)" />
          <Stack.Screen name="payment-success" options={{ animation: 'fade' }} />
        <Stack.Screen name="abha" />
        <Stack.Screen name="abha/[id]" />
        <Stack.Screen name="abha/link" />
        <Stack.Screen name="support" />
        <Stack.Screen name="support/raise" />
        <Stack.Screen name="support/ticket/[id]" />
        <Stack.Screen name="training" />
        <Stack.Screen name="training/[id]" />
        <Stack.Screen name="certificates" />
        <Stack.Screen name="certificates/[id]" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="availability" />
        <Stack.Screen name="documents" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="escalation/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="visit-success/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
