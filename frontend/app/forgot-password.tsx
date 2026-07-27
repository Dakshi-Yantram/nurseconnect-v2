import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { InputField } from '../components/InputField';
import { GradientButton } from '../components/GradientButton';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { authService, isPasswordValid, PASSWORD_HINT } from '../services/auth.service';

/**
 * Password reset. The backend SMSes a 6-digit code to the phone registered on
 * the account and always responds identically whether or not the email exists,
 * so this screen must not imply the account was found.
 */
export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const request = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) return setError('Enter the email on your account');
    setBusy(true);
    try {
      const res = await authService.forgotPassword(email);
      setNotice(res.message);
      setStep('reset');
    } catch (e: any) {
      const detail = e?.detail?.detail ?? e?.detail;
      if (detail?.code === 'RATE_LIMITED') {
        const mins = Math.ceil((detail.retry_after_seconds ?? 60) / 60);
        setError(`Too many reset requests. Try again in about ${mins} minute${mins === 1 ? '' : 's'}.`);
      } else {
        setError(e?.message || 'Could not send a reset code');
      }
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError('');
    setNotice('');
    if (!code.trim()) return setError('Enter the code you received');
    if (!isPasswordValid(newPassword)) return setError(PASSWORD_HINT);
    setBusy(true);
    try {
      await authService.resetPassword(email, code, newPassword);
      router.replace({ pathname: '/login', params: { role: 'family' } });
    } catch (e: any) {
      setError(e?.message || 'Could not reset your password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="forgot-password-screen">
      <Header title="Reset password" fallbackHref="/role-select" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.lead}>
            {step === 'request'
              ? 'Enter your account email. We’ll text a reset code to the mobile number on file.'
              : 'Enter the code we texted you, then choose a new password.'}
          </Text>

          {!!error && (
            <View style={[styles.banner, { backgroundColor: Colors.errorBg }]}>
              <Ionicons name="alert-circle" size={16} color={Colors.danger} />
              <Text style={[styles.bannerTxt, { color: Colors.danger }]}>{error}</Text>
            </View>
          )}
          {!!notice && !error && (
            <View style={[styles.banner, { backgroundColor: Colors.infoBg }]}>
              <Ionicons name="information-circle" size={16} color={Colors.primary} />
              <Text style={[styles.bannerTxt, { color: Colors.primary }]}>{notice}</Text>
            </View>
          )}

          <View style={{ marginTop: Spacing.lg }}>
            <InputField
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              editable={step === 'request'}
              iconLeft="mail-outline"
              testID="forgot-email"
            />

            {step === 'reset' && (
              <>
                <InputField
                  label="Reset code"
                  placeholder="6-digit code"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                  iconLeft="key-outline"
                  testID="forgot-code"
                />
                <InputField
                  label="New password"
                  placeholder="Choose a new password"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  iconLeft="lock-closed-outline"
                  iconRight={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  onIconRightPress={() => setShowPassword((v) => !v)}
                  testID="forgot-new-password"
                />
                <Text style={styles.hint}>{PASSWORD_HINT}</Text>
              </>
            )}

            <GradientButton
              title={step === 'request' ? 'Send reset code' : 'Update password'}
              onPress={step === 'request' ? request : reset}
              loading={busy}
              testID="forgot-submit"
            />

            {step === 'reset' && (
              <TouchableOpacity
                onPress={() => {
                  setStep('request');
                  setCode('');
                  setError('');
                  setNotice('');
                }}
                style={{ alignSelf: 'center', marginTop: Spacing.md }}
              >
                <Text style={styles.link}>Use a different email</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  lead: { ...Typography.body, color: Colors.textSecondary, lineHeight: 21 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  bannerTxt: { ...Typography.small, flex: 1, lineHeight: 18 },
  hint: { ...Typography.small, color: Colors.textTertiary, marginBottom: Spacing.md },
  link: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
});
