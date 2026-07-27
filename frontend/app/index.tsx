import React, { useEffect } from 'react';
import { View, StyleSheet, Text, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Logo } from '../components/Logo';
import { Gradients, Typography } from '../constants/theme';
import { useStore } from '../store';
import { portalHome } from '../lib/roles';

const SPLASH_MS = 1600;

export default function SplashScreen() {
  const router = useRouter();
  const authBootstrapping = useStore((s) => s.authBootstrapping);
  const role = useStore((s) => s.role);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(0.8)).current;
  const [minTimeElapsed, setMinTimeElapsed] = React.useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => setMinTimeElapsed(true), SPLASH_MS);
    return () => clearTimeout(t);
  }, [opacity, scale]);

  useEffect(() => {
    // Hold the splash until BOTH the animation has played and the session
    // restore has settled — routing early would bounce an already-signed-in
    // user through the onboarding carousel on every cold start.
    if (!minTimeElapsed || authBootstrapping) return;
    router.replace((role ? portalHome(role) : '/onboarding') as any);
  }, [minTimeElapsed, authBootstrapping, role, router]);

  return (
    <LinearGradient colors={Gradients.splash as any} style={styles.container} testID="splash-screen">
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center' }}>
        <View style={styles.logoCircle}>
          <Logo size={88} />
        </View>
        <Text style={styles.brand}>NurseConnect</Text>
        <Text style={styles.tag}>Trusted home nursing, on-demand</Text>
      </Animated.View>
      <Animated.View style={{ opacity, marginTop: 60 }}>
        <Text style={styles.poweredBy}>POWERED BY YANTRAM</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logoCircle: {
    backgroundColor: '#fff',
    width: 132,
    height: 132,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  brand: { ...Typography.h1, color: '#fff', marginTop: 24, fontWeight: '800' as const },
  tag: { ...Typography.body, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  poweredBy: { ...Typography.caption, color: 'rgba(255,255,255,0.65)' },
});
