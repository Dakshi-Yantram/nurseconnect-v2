import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from '../components/Logo';
import { InputField } from '../components/InputField';
import { GradientButton } from '../components/GradientButton';
import { OTPInput } from '../components/OTPInput';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import {
  authService,
  isPasswordValid,
  PASSWORD_HINT,
  type BackendUser,
} from '../services/auth.service';
import { isWebOnlyRole, portalHome, WEB_ONLY_ROLE_LABEL, type AppRole } from '../lib/roles';

type Mode = 'signin' | 'register' | 'verify' | 'otp_phone' | 'otp_code';

/** Which entry point the user came in through. */
type Entry = 'family' | 'nurse' | 'staff';

const ENTRY_COPY: Record<Entry, { title: string; sub: string }> = {
  family: { title: 'Welcome back', sub: 'Sign in to book and track care' },
  nurse: { title: 'Care professional sign in', sub: 'Your visits, earnings and training' },
  staff: { title: 'Staff sign in', sub: 'For clinical trainers and training leads' },
};

export default function Login() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const entry: Entry =
    params.role === 'nurse' ? 'nurse' : params.role === 'staff' ? 'staff' : 'family';

  const setUserFromBackend = useStore((s) => s.setUserFromBackend);
  const hydrateForRole = useStore((s) => s.hydrateForRole);
  const connectRealtime = useStore((s) => s.connectRealtime);

  // Consumers get the passwordless OTP flow by default; everyone else needs a
  // password, because the backend's OTP endpoint only ever issues consumer
  // tokens and rejects worker numbers outright.
  const [mode, setMode] = useState<Mode>(entry === 'family' ? 'otp_phone' : 'signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // sign in
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // register
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [workerType, setWorkerType] = useState<'nurse' | 'caregiver'>('nurse');

  // verify email
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');

  // phone otp
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const clearMessages = () => {
    setError('');
    setNotice('');
  };

  /** Shared post-authentication handoff. */
  const enterApp = async (user: BackendUser) => {
    if (isWebOnlyRole(user.role)) {
      // These portals only exist on the web. Drop the session rather than
      // leaving a half-authenticated user staring at an empty shell.
      await authService.logout();
      setError(
        `${WEB_ONLY_ROLE_LABEL[user.role] ?? 'This'} accounts are managed on the NurseConnect web ` +
          `portal. Please sign in there instead.`,
      );
      return;
    }
    setUserFromBackend(user);
    const role = useStore.getState().role as AppRole | null;
    if (!role) {
      setError('This account type is not supported in the mobile app.');
      return;
    }
    hydrateForRole(role).catch(() => {});
    connectRealtime();
    // Register push tokens so this device can be rung for calls while
    // backgrounded. No-ops in Expo Go / builds without the native modules.
    import('../lib/call-push').then(({ registerForCallPush }) => {
      registerForCallPush().catch(() => {});
    });
    router.replace(portalHome(role) as any);
  };

  /** Turn an APIError into something a person can act on. */
  const describe = (e: any, fallback: string) => {
    const detail = e?.detail?.detail ?? e?.detail;
    if (detail && typeof detail === 'object') {
      if (detail.code === 'RATE_LIMITED' || detail.code === 'ACCOUNT_TEMPORARILY_LOCKED') {
        const mins = Math.ceil((detail.retry_after_seconds ?? 60) / 60);
        return `${detail.message} Try again in about ${mins} minute${mins === 1 ? '' : 's'}.`;
      }
      if (typeof detail.message === 'string') return detail.message;
    }
    return e?.message || fallback;
  };

  // ---------------------------------------------------------------- actions
  const doSignIn = async () => {
    clearMessages();
    if (!email.trim() || !password) {
      setError('Enter your email and password');
      return;
    }
    setBusy(true);
    try {
      const res = await authService.login(email, password);
      await enterApp(res.user);
    } catch (e: any) {
      if (e?.status === 403 && /verify your email/i.test(String(e?.message))) {
        setVerifyEmail(email);
        setMode('verify');
        setNotice('Confirm your email address to finish setting up your account.');
      } else {
        setError(describe(e, 'Could not sign in'));
      }
    } finally {
      setBusy(false);
    }
  };

  const doRegister = async () => {
    clearMessages();
    if (!fullName.trim()) return setError('Enter your full name');
    if (!regEmail.trim()) return setError('Enter your email address');
    if (!/^\+?[0-9]{10,15}$/.test(regPhone.replace(/[\s-]/g, '')))
      return setError('Enter a valid mobile number');
    if (!isPasswordValid(regPassword)) return setError(PASSWORD_HINT);

    setBusy(true);
    try {
      const res = await authService.register({
        full_name: fullName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        role: entry === 'nurse' ? 'nurse' : 'family',
        worker_type: workerType,
      });
      setVerifyEmail(regEmail);
      setVerifyCode(res.dev_verification_code ?? '');
      setMode('verify');
      setNotice(`We sent a verification code to ${res.email}.`);
    } catch (e: any) {
      setError(describe(e, 'Could not create your account'));
    } finally {
      setBusy(false);
    }
  };

  const doVerifyEmail = async () => {
    clearMessages();
    if (!verifyCode.trim()) return setError('Enter the code from your email');
    setBusy(true);
    try {
      await authService.verifyEmail(verifyEmail, verifyCode);
      setMode('signin');
      setEmail(verifyEmail);
      setPassword('');
      setNotice('Email confirmed. Sign in to continue.');
    } catch (e: any) {
      setError(describe(e, 'Could not verify that code'));
    } finally {
      setBusy(false);
    }
  };

  const doResendVerification = async () => {
    clearMessages();
    setBusy(true);
    try {
      const res = await authService.resendEmailVerification(verifyEmail);
      setVerifyCode(res.dev_verification_code ?? '');
      setNotice('A new code is on its way.');
    } catch (e: any) {
      setError(describe(e, 'Could not resend the code'));
    } finally {
      setBusy(false);
    }
  };

  const doSendOtp = async () => {
    clearMessages();
    if (!/^[6-9]\d{9}$/.test(phone.replace(/[\s-]/g, ''))) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    setBusy(true);
    try {
      const res = await authService.sendOtp(phone);
      setOtp(res.dev_otp ?? '');
      setResendIn(30);
      setMode('otp_code');
      setNotice(`Code sent to ${res.phone_e164}.`);
    } catch (e: any) {
      setError(describe(e, 'Could not send the code'));
    } finally {
      setBusy(false);
    }
  };

  const doVerifyOtp = async () => {
    clearMessages();
    if (otp.trim().length < 4) return setError('Enter the code we sent you');
    setBusy(true);
    try {
      const res = await authService.verifyOtp(phone, otp);
      await enterApp(res.user);
    } catch (e: any) {
      if (e?.status === 409) {
        setError(
          'This number is registered as a care professional. Use the care professional sign in.',
        );
      } else {
        setError(describe(e, 'That code did not work'));
      }
    } finally {
      setBusy(false);
    }
  };

  const copy = ENTRY_COPY[entry];
  const canRegister = entry !== 'staff';

  const banner = useMemo(() => {
    if (error) return { tone: 'error' as const, text: error };
    if (notice) return { tone: 'info' as const, text: notice };
    return null;
  }, [error, notice]);

  return (
    <SafeAreaView style={styles.safe} testID="login-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => router.replace('/role-select')}
            style={styles.backBtn}
            testID="login-back"
          >
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>

          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <Logo size={64} />
          </View>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.sub}>{copy.sub}</Text>

          {banner && (
            <View
              style={[
                styles.banner,
                banner.tone === 'error' ? styles.bannerError : styles.bannerInfo,
              ]}
              testID="login-banner"
            >
              <Ionicons
                name={banner.tone === 'error' ? 'alert-circle' : 'information-circle'}
                size={16}
                color={banner.tone === 'error' ? Colors.danger : Colors.primary}
              />
              <Text
                style={[
                  styles.bannerTxt,
                  { color: banner.tone === 'error' ? Colors.danger : Colors.primary },
                ]}
              >
                {banner.text}
              </Text>
            </View>
          )}

          <View style={{ marginTop: Spacing.lg }}>
            {/* ------------------------------------------------ phone OTP -- */}
            {mode === 'otp_phone' && (
              <>
                <InputField
                  label="Mobile number"
                  prefix="+91"
                  placeholder="98xxxxxxxx"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                  iconLeft="call-outline"
                  testID="login-phone"
                />
                <GradientButton
                  title="Send code"
                  onPress={doSendOtp}
                  loading={busy}
                  testID="login-send-otp"
                />
                <TouchableOpacity
                  onPress={() => {
                    clearMessages();
                    setMode('signin');
                  }}
                  style={styles.switchRow}
                >
                  <Text style={styles.switchTxt}>
                    Prefer a password? <Text style={styles.switchLink}>Sign in with email</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {mode === 'otp_code' && (
              <>
                <Text style={styles.otpLabel}>
                  Enter the 6-digit code sent to{' '}
                  <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>+91 {phone}</Text>
                </Text>
                <View style={{ marginTop: Spacing.md }}>
                  <OTPInput value={otp} onChange={setOtp} length={6} />
                </View>
                <View style={styles.resendRow}>
                  {resendIn > 0 ? (
                    <Text style={styles.resendTxt}>Resend in {resendIn}s</Text>
                  ) : (
                    <TouchableOpacity onPress={doSendOtp} testID="otp-resend">
                      <Text
                        style={[styles.resendTxt, { color: Colors.primary, fontWeight: '700' }]}
                      >
                        Resend code
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <GradientButton
                  title="Verify & continue"
                  onPress={doVerifyOtp}
                  loading={busy}
                  style={{ marginTop: Spacing.md }}
                  testID="otp-verify"
                />
                <TouchableOpacity
                  onPress={() => {
                    clearMessages();
                    setOtp('');
                    setMode('otp_phone');
                  }}
                  style={styles.switchRow}
                >
                  <Text style={styles.switchTxt}>
                    Wrong number? <Text style={styles.switchLink}>Change it</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ---------------------------------------- email + password --- */}
            {mode === 'signin' && (
              <>
                <InputField
                  label="Email"
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  iconLeft="mail-outline"
                  testID="login-email"
                />
                <InputField
                  label="Password"
                  placeholder="Your password"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                  iconLeft="lock-closed-outline"
                  iconRight={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  onIconRightPress={() => setShowPassword((v) => !v)}
                  testID="login-password"
                />
                <TouchableOpacity
                  onPress={() => router.push('/forgot-password')}
                  style={{ alignSelf: 'flex-end', marginBottom: Spacing.md }}
                  testID="login-forgot"
                >
                  <Text style={styles.switchLink}>Forgot password?</Text>
                </TouchableOpacity>
                <GradientButton
                  title="Sign in"
                  onPress={doSignIn}
                  loading={busy}
                  testID="login-submit"
                />
                {entry === 'family' && (
                  <TouchableOpacity
                    onPress={() => {
                      clearMessages();
                      setMode('otp_phone');
                    }}
                    style={styles.switchRow}
                  >
                    <Text style={styles.switchTxt}>
                      <Text style={styles.switchLink}>Sign in with a mobile code</Text> instead
                    </Text>
                  </TouchableOpacity>
                )}
                {canRegister && (
                  <TouchableOpacity
                    onPress={() => {
                      clearMessages();
                      setMode('register');
                    }}
                    style={styles.switchRow}
                    testID="login-register"
                  >
                    <Text style={styles.switchTxt}>
                      New here? <Text style={styles.switchLink}>Create an account</Text>
                    </Text>
                  </TouchableOpacity>
                )}
                {entry === 'staff' && (
                  <Text style={styles.staffHint}>
                    Trainer and training-lead accounts are created by your Operations team. Contact
                    them if you don’t have credentials yet.
                  </Text>
                )}
              </>
            )}

            {/* ---------------------------------------------- register ----- */}
            {mode === 'register' && (
              <>
                <InputField
                  label="Full name"
                  placeholder="Your name"
                  value={fullName}
                  onChangeText={setFullName}
                  iconLeft="person-outline"
                  testID="reg-name"
                />
                <InputField
                  label="Email"
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={regEmail}
                  onChangeText={setRegEmail}
                  iconLeft="mail-outline"
                  testID="reg-email"
                />
                <InputField
                  label="Mobile number"
                  prefix="+91"
                  placeholder="98xxxxxxxx"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={regPhone}
                  onChangeText={setRegPhone}
                  iconLeft="call-outline"
                  testID="reg-phone"
                />
                <InputField
                  label="Password"
                  placeholder="Choose a password"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  value={regPassword}
                  onChangeText={setRegPassword}
                  iconLeft="lock-closed-outline"
                  iconRight={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  onIconRightPress={() => setShowPassword((v) => !v)}
                  testID="reg-password"
                />
                <Text style={styles.hint}>{PASSWORD_HINT}</Text>

                {entry === 'nurse' && (
                  <>
                    <Text style={styles.fieldLabel}>I work as a</Text>
                    <View style={styles.segmented}>
                      {(['nurse', 'caregiver'] as const).map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.segment, workerType === t && styles.segmentActive]}
                          onPress={() => setWorkerType(t)}
                          testID={`reg-worker-${t}`}
                        >
                          <Text
                            style={[
                              styles.segmentTxt,
                              workerType === t && { color: '#fff', fontWeight: '700' },
                            ]}
                          >
                            {t === 'nurse' ? 'Nurse' : 'Caregiver'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.hint}>
                      This decides which documents you’ll be asked to upload for verification.
                    </Text>
                  </>
                )}

                <GradientButton
                  title="Create account"
                  onPress={doRegister}
                  loading={busy}
                  style={{ marginTop: Spacing.md }}
                  testID="reg-submit"
                />
                <TouchableOpacity
                  onPress={() => {
                    clearMessages();
                    setMode('signin');
                  }}
                  style={styles.switchRow}
                >
                  <Text style={styles.switchTxt}>
                    Already have an account? <Text style={styles.switchLink}>Sign in</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ------------------------------------------- verify email ---- */}
            {mode === 'verify' && (
              <>
                <InputField
                  label="Email"
                  value={verifyEmail}
                  onChangeText={setVerifyEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  iconLeft="mail-outline"
                  testID="verify-email"
                />
                <InputField
                  label="Verification code"
                  placeholder="6-digit code"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={verifyCode}
                  onChangeText={setVerifyCode}
                  iconLeft="key-outline"
                  testID="verify-code"
                />
                <GradientButton
                  title="Confirm email"
                  onPress={doVerifyEmail}
                  loading={busy}
                  testID="verify-submit"
                />
                <TouchableOpacity onPress={doResendVerification} style={styles.switchRow}>
                  <Text style={styles.switchTxt}>
                    Didn’t get it? <Text style={styles.switchLink}>Send another code</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...Typography.h1, color: Colors.textPrimary, marginTop: 20, textAlign: 'center' },
  sub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginTop: 6 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  bannerError: { backgroundColor: Colors.errorBg },
  bannerInfo: { backgroundColor: Colors.infoBg },
  bannerTxt: { ...Typography.small, flex: 1, lineHeight: 18 },
  otpLabel: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  resendRow: { alignItems: 'center', marginTop: Spacing.md },
  resendTxt: { ...Typography.small, color: Colors.textSecondary },
  switchRow: { alignSelf: 'center', marginTop: Spacing.md },
  switchTxt: { ...Typography.small, color: Colors.textSecondary },
  switchLink: { color: Colors.primary, fontWeight: '700' as const, fontSize: 12 },
  hint: { ...Typography.small, color: Colors.textTertiary, marginBottom: Spacing.md },
  fieldLabel: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    marginBottom: 6,
  },
  segmented: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  segment: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segmentTxt: { ...Typography.body, color: Colors.textPrimary },
  staffHint: {
    ...Typography.small,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 18,
  },
});
