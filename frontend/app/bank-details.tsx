/**
 * Bank account details for payouts (nurse app item 5).
 *
 * The backend endpoint (PUT /workers/me/bank-details) and the service wrapper
 * (workerSelfService.updateBankDetails) both already existed — nothing in the
 * app ever called them, so a nurse had no way to tell us where to send her
 * money. This is that missing screen.
 *
 * Deliberately NOT a payout-settings dashboard: it captures the three fields
 * RazorpayX needs to build a fund account (holder name, account number, IFSC)
 * and nothing else.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { InputField } from '../components/InputField';
import { GradientButton } from '../components/GradientButton';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { workerSelfService } from '../services/worker-self.service';

/** Indian IFSC: 4 letters, then 0, then 6 alphanumerics. */
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export default function BankDetails() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [holder, setHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmNumber, setConfirmNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  /** True when the account already has details saved (masked on load). */
  const [hasExisting, setHasExisting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const me = await workerSelfService.me();
      setHolder(me.bank_account_holder ?? '');
      setIfsc(me.bank_ifsc ?? '');
      // The API returns the stored account number; we don't prefill it, so a
      // mistyped digit can't be saved back unnoticed by someone who only
      // meant to update the IFSC. Re-entering it is the point.
      setHasExisting(!!me.bank_account_number);
    } catch (e: any) {
      setError(e?.message || 'Could not load your payout details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const holderTrim = holder.trim();
    const acct = accountNumber.replace(/\s/g, '');
    const ifscNorm = ifsc.trim().toUpperCase();

    if (holderTrim.length < 3) {
      return Alert.alert('Check the name', "Enter the account holder's full name as printed on the passbook.");
    }
    if (!/^\d{9,18}$/.test(acct)) {
      return Alert.alert('Check the account number', 'Indian account numbers are 9 to 18 digits.');
    }
    if (acct !== confirmNumber.replace(/\s/g, '')) {
      return Alert.alert('Numbers do not match', 'The two account numbers are different. Please re-enter them.');
    }
    if (!IFSC_RE.test(ifscNorm)) {
      return Alert.alert('Check the IFSC', 'An IFSC looks like HDFC0001234 — four letters, a zero, then six characters.');
    }

    setSaving(true);
    try {
      await workerSelfService.updateBankDetails({
        bank_account_holder: holderTrim,
        bank_account_number: acct,
        bank_ifsc: ifscNorm,
      });
      setAccountNumber('');
      setConfirmNumber('');
      setHasExisting(true);
      Alert.alert(
        'Payout details saved',
        'Your earnings will be sent to this account. Payouts are released after a completed visit is approved.',
      );
    } catch (e: any) {
      const detail = e?.detail?.detail ?? e?.detail;
      Alert.alert('Could not save', detail?.message || e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Payout details" showBack fallbackHref="/(nurse)/profile" />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="bank-details-screen">
      <OfflineBanner />
      <Header title="Payout details" showBack fallbackHref="/(nurse)/profile" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {!!error && <Text style={styles.errorTxt}>{error}</Text>}

          {hasExisting && (
            <View style={styles.infoCard}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={styles.infoTxt}>
                You already have payout details on file. Filling this in replaces them.
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <InputField
              label="Account holder name"
              placeholder="As printed on your passbook"
              value={holder}
              onChangeText={setHolder}
              iconLeft="person-outline"
              testID="bank-holder"
            />
            <InputField
              label="Account number"
              placeholder="Your bank account number"
              keyboardType="number-pad"
              secureTextEntry
              value={accountNumber}
              onChangeText={setAccountNumber}
              iconLeft="card-outline"
              testID="bank-account"
            />
            <InputField
              label="Re-enter account number"
              placeholder="Type it once more"
              keyboardType="number-pad"
              value={confirmNumber}
              onChangeText={setConfirmNumber}
              iconLeft="repeat-outline"
              testID="bank-account-confirm"
            />
            <InputField
              label="IFSC code"
              placeholder="e.g. HDFC0001234"
              autoCapitalize="characters"
              maxLength={11}
              value={ifsc}
              onChangeText={setIfsc}
              iconLeft="business-outline"
              testID="bank-ifsc"
            />
          </View>

          <View style={styles.noteBox}>
            <Ionicons name="lock-closed-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.noteTxt}>
              These details are used only to pay you. Make sure the name matches your bank
              records — a mismatch is the most common reason a payout fails.
            </Text>
          </View>

          <GradientButton
            title={hasExisting ? 'Update payout details' : 'Save payout details'}
            onPress={save}
            loading={saving}
            style={{ marginTop: Spacing.md }}
            testID="bank-save"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorTxt: { ...Typography.small, color: Colors.danger, marginBottom: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.card,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successBg,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: Spacing.md,
  },
  infoTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1 },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: Spacing.md,
  },
  noteTxt: { ...Typography.caption, color: Colors.textSecondary, flex: 1, lineHeight: 17 },
});
