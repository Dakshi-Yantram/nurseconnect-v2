import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Header } from '../components/Header';
import { OTPInput } from '../components/OTPInput';
import { GradientButton } from '../components/GradientButton';
import { Colors, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { authService } from '../services/auth.service';

export default function OtpScreen() {
  const router = useRouter();
  const { phone, devOtp } = useLocalSearchParams<{ phone: string; devOtp?: string }>();
  const [otp, setOtp] = useState('');
  const [seconds, setSeconds] = useState(30);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setUserFromBackend = useStore((s) => s.setUserFromBackend);
  const role = useStore((s) => s.role);

  useEffect(() => {
    if (seconds === 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const verify = async () => {
    if (otp.length < 4) {
      setError('Please enter the OTP');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await authService.verifyOtp(phone || '9999999999', otp, role);
      setUserFromBackend(res.user);
      // Kick off family/nurse data hydration in parallel (non-blocking)
      if (role === 'family') {
        useStore.getState().bootstrapFamily().catch(() => {});
      } else {
        useStore.getState().bootstrapNurse().catch(() => {});
      }
      router.replace(role === 'family' ? '/(family)/dashboard' : '/(nurse)/dashboard');
    } catch (e: any) {
      setError(e?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError('');
    try {
      await authService.sendOtp(phone || '9999999999', role);
      setSeconds(30);
    } catch (e: any) {
      setError(e?.message || 'Could not resend OTP');
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="otp-screen">
      <Header title="Verify mobile" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, padding: Spacing.lg }}
      >
        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.sub}>
          We have sent a 4-digit code to{' '}
          <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>+91 {phone}</Text>
        </Text>

        <View style={{ marginTop: 40 }}>
          <OTPInput value={otp} onChange={setOtp} length={6} />
          {error ? <Text style={styles.err}>{error}</Text> : null}
          {devOtp ? (
            <Text style={styles.hint}>Dev OTP: {devOtp}</Text>
          ) : (
            <Text style={styles.hint}>Use 123456 for demo</Text>
          )}
        </View>

        <View style={styles.resendRow}>
          <Text style={styles.resendTxt}>Didn’t receive the OTP? </Text>
          {seconds > 0 ? (
            <Text style={styles.timer}>Resend in {seconds}s</Text>
          ) : (
            <TouchableOpacity onPress={resend} testID="otp-resend">
              <Text style={[styles.timer, { color: Colors.primary }]}>Resend</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flex: 1 }} />
        <GradientButton title="Verify & Continue" onPress={verify} loading={loading} testID="otp-verify" />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  title: { ...Typography.h2, color: Colors.textPrimary, marginTop: 8 },
  sub: { ...Typography.body, color: Colors.textSecondary, marginTop: 8 },
  err: { ...Typography.small, color: Colors.error, marginTop: 12 },
  hint: { ...Typography.small, color: Colors.textTertiary, marginTop: 8, fontStyle: 'italic' },
  resendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  resendTxt: { ...Typography.small, color: Colors.textSecondary },
  timer: { ...Typography.small, color: Colors.textTertiary, fontWeight: '700' as const },
});
