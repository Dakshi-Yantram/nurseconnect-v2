import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Logo } from '../components/Logo';
import { InputField } from '../components/InputField';
import { GradientButton } from '../components/GradientButton';
import { Colors, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { authService } from '../services/auth.service';

export default function Login() {
  const router = useRouter();
  const role = useStore((s) => s.role);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [terms, setTerms] = useState(true);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Enter a valid 10-digit Indian mobile');
      return;
    }
    if (!terms) {
      Alert.alert('Please accept Terms & Privacy Policy');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // OTP step removed — go straight to session + dashboard.
      const res = await authService.loginDirect(phone, role);
      useStore.getState().setUserFromBackend(res.user);
      if (role === 'family') {
        useStore.getState().bootstrapFamily().catch(() => {});
      } else {
        useStore.getState().bootstrapNurse().catch(() => {});
      }
      router.replace(role === 'family' ? '/(family)/dashboard' : '/(nurse)/dashboard');
    } catch (e: any) {
      setError(e?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="login-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, padding: Spacing.lg }}
      >
        <View style={{ alignItems: 'center', marginTop: 24 }}>
          <Logo size={64} />
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.sub}>
          Continue as a {role === 'family' ? 'family member' : 'nurse partner'}
        </Text>

        <View style={{ marginTop: 32 }}>
          <InputField
            label="Mobile number"
            prefix="+91"
            placeholder="98xxxxxxxx"
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
            error={error}
            iconLeft="call-outline"
            testID="login-phone"
          />
          {role === 'family' && (
            <InputField
              label="ABHA ID (optional)"
              placeholder="14-1234-5678-9012"
              iconLeft="card-outline"
              testID="login-abha"
            />
          )}
        </View>

        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => setTerms(!terms)}
          testID="login-terms"
        >
          <View style={[styles.checkbox, terms && styles.checked]} />
          <Text style={styles.termsText}>
            I agree to the <Text style={{ color: Colors.primary }}>Terms</Text> and{' '}
            <Text style={{ color: Colors.primary }}>Privacy Policy</Text>
          </Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <GradientButton title="Continue" onPress={send} loading={loading} testID="login-send-otp" />
        <TouchableOpacity
          onPress={() => router.push('/register')}
          style={{ alignSelf: 'center', marginTop: 16 }}
          testID="login-register"
        >
          <Text style={styles.linkTxt}>
            New here?{' '}
            <Text style={{ color: Colors.primary, fontWeight: '700' }}>Create account</Text>
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  title: { ...Typography.h1, color: Colors.textPrimary, marginTop: 24, textAlign: 'center' },
  sub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  termsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: 10,
  },
  checked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  termsText: { ...Typography.small, color: Colors.textSecondary, flex: 1 },
  linkTxt: { ...Typography.body, color: Colors.textSecondary },
});
