import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '../components/Header';
import { InputField } from '../components/InputField';
import { GradientButton } from '../components/GradientButton';
import { Colors, Spacing } from '../constants/theme';
import { useStore } from '../store';
import { authService } from '../services/auth.service';

export default function Register() {
  const router = useRouter();
  const role = useStore((s) => s.role);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errs, setErrs] = useState<{ [k: string]: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const e: { [k: string]: string } = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!/^[6-9]\d{9}$/.test(phone)) e.phone = 'Enter a valid mobile number';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email';
    setErrs(e);
    if (Object.keys(e).length > 0) return;
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
    } catch (err: any) {
      setErrs({ phone: err?.message || 'Registration failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="register-screen">
      <Header title="Create account" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
          <InputField
            label="Full name"
            placeholder="Aarav Kumar"
            value={name}
            onChangeText={setName}
            error={errs.name}
            iconLeft="person-outline"
            testID="register-name"
          />
          <InputField
            label="Mobile number"
            prefix="+91"
            placeholder="98xxxxxxxx"
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
            error={errs.phone}
            iconLeft="call-outline"
            testID="register-phone"
          />
          <InputField
            label="Email (optional)"
            placeholder="you@example.com"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            error={errs.email}
            iconLeft="mail-outline"
            testID="register-email"
          />
          <InputField
            label="ABHA ID (optional)"
            placeholder="14-1234-5678-9012"
            iconLeft="card-outline"
          />
          <View style={{ height: 24 }} />
          <GradientButton title="Create account" onPress={submit} loading={loading} testID="register-submit" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
});
