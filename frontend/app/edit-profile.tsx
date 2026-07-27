/**
 * Edit profile.
 *
 * The previous version only mutated local Zustand state and then told the
 * user "your changes have been saved" — nothing was ever sent to the server,
 * and the edits vanished on the next launch.
 *
 * What's editable depends on the role: consumers own their emergency contact;
 * care professionals own their bio, experience and — the part that gates
 * verification — their nursing registration details.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { InputField } from '../components/InputField';
import { GradientButton } from '../components/GradientButton';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { usersService } from '../services/users.service';
import { workerSelfService } from '../services/worker-self.service';

export default function EditProfile() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const role = useStore((s) => s.role);
  const workerProfile = useStore((s) => s.workerProfile);
  const loadWorkerProfileAPI = useStore((s) => s.loadWorkerProfileAPI);
  const loadOnboardingAPI = useStore((s) => s.loadOnboardingAPI);

  const isNurse = role === 'nurse';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Consumer fields
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Nurse fields
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [registrationAuthority, setRegistrationAuthority] = useState('');
  const [registrationValidUntil, setRegistrationValidUntil] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [baseCity, setBaseCity] = useState('');

  const load = useCallback(async () => {
    try {
      if (isNurse) {
        await loadWorkerProfileAPI();
      } else {
        const me = await usersService.me();
        setEmergencyName(me.emergency_contact_name ?? '');
        setEmergencyPhone(me.emergency_contact_phone ?? '');
      }
    } catch {
      // The form still renders; saving surfaces any real failure.
    } finally {
      setLoading(false);
    }
  }, [isNurse, loadWorkerProfileAPI]);

  useEffect(() => {
    load();
  }, [load]);

  // Seed from the profile once it arrives, without clobbering in-progress edits.
  useEffect(() => {
    if (!workerProfile) return;
    setBio((v) => v || workerProfile.bio || '');
    setExperience((v) => v || String(workerProfile.years_of_experience ?? ''));
    setRegistrationNo((v) => v || workerProfile.registration_no || '');
    setRegistrationAuthority((v) => v || workerProfile.registration_authority || '');
    setRegistrationValidUntil((v) => v || workerProfile.registration_valid_until || '');
    setDateOfBirth((v) => v || workerProfile.date_of_birth || '');
    setBaseCity((v) => v || workerProfile.base_city || '');
  }, [workerProfile]);

  const validDate = (v: string) => !v.trim() || /^\d{4}-\d{2}-\d{2}$/.test(v.trim());

  const save = async () => {
    if (isNurse && (!validDate(dateOfBirth) || !validDate(registrationValidUntil))) {
      return Alert.alert('Check the dates', 'Use the format YYYY-MM-DD.');
    }
    setSaving(true);
    try {
      if (isNurse) {
        await workerSelfService.updateMe({
          bio: bio.trim() || null,
          years_of_experience: Number(experience) || 0,
          registration_no: registrationNo.trim() || null,
          registration_authority: registrationAuthority.trim() || null,
          registration_valid_until: registrationValidUntil.trim() || null,
          date_of_birth: dateOfBirth.trim() || null,
          base_city: baseCity.trim() || null,
        });
        await Promise.allSettled([loadWorkerProfileAPI(), loadOnboardingAPI()]);
      } else {
        await usersService.updateMe({
          emergency_contact_name: emergencyName.trim() || null,
          emergency_contact_phone: emergencyPhone.trim() || null,
        });
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Edit profile" />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="edit-profile-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Edit profile" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.readOnlyCard}>
            <Ionicons name="lock-closed-outline" size={16} color={Colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.readOnlyLabel}>{user?.name || 'Your account'}</Text>
              <Text style={styles.readOnlyTxt}>
                {[user?.phone, user?.email].filter(Boolean).join(' · ')}
              </Text>
              <Text style={styles.readOnlyHint}>
                Your name, phone and email are tied to your sign-in. Contact support to change
                them.
              </Text>
            </View>
          </View>

          {isNurse ? (
            <>
              <Text style={styles.sectionTitle}>About you</Text>
              <InputField
                label="Short bio"
                placeholder="How you introduce yourself to families"
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                style={{ minHeight: 100, textAlignVertical: 'top' }}
                testID="edit-bio"
              />
              <InputField
                label="Years of experience"
                keyboardType="number-pad"
                value={experience}
                onChangeText={setExperience}
                iconLeft="briefcase-outline"
                testID="edit-experience"
              />
              <InputField
                label="Base city"
                placeholder="Hyderabad"
                value={baseCity}
                onChangeText={setBaseCity}
                iconLeft="business-outline"
              />
              <InputField
                label="Date of birth"
                placeholder="YYYY-MM-DD"
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                iconLeft="calendar-outline"
                testID="edit-dob"
              />

              <Text style={styles.sectionTitle}>Registration</Text>
              <Text style={styles.sectionNote}>
                These are checked during verification. Changing them after approval sends your
                profile back for re-review.
              </Text>
              <InputField
                label="Registration number"
                placeholder="Council registration number"
                autoCapitalize="characters"
                value={registrationNo}
                onChangeText={setRegistrationNo}
                iconLeft="card-outline"
                testID="edit-registration"
              />
              <InputField
                label="Issuing council"
                placeholder="e.g. Telangana Nursing Council"
                value={registrationAuthority}
                onChangeText={setRegistrationAuthority}
                iconLeft="business-outline"
              />
              <InputField
                label="Valid until"
                placeholder="YYYY-MM-DD"
                value={registrationValidUntil}
                onChangeText={setRegistrationValidUntil}
                iconLeft="calendar-outline"
              />
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Emergency contact</Text>
              <Text style={styles.sectionNote}>
                Who we call if something goes wrong during a visit and we can’t reach you.
              </Text>
              <InputField
                label="Contact name"
                placeholder="Their name"
                value={emergencyName}
                onChangeText={setEmergencyName}
                iconLeft="person-outline"
                testID="edit-emergency-name"
              />
              <InputField
                label="Contact number"
                placeholder="+91 98xxxxxxxx"
                keyboardType="phone-pad"
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                iconLeft="call-outline"
                testID="edit-emergency-phone"
              />
            </>
          )}

          <GradientButton
            title="Save changes"
            onPress={save}
            loading={saving}
            style={{ marginTop: Spacing.md }}
            testID="edit-save"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  readOnlyCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: Spacing.md,
  },
  readOnlyLabel: { ...Typography.bodyBold, color: Colors.textPrimary },
  readOnlyTxt: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  readOnlyHint: { ...Typography.caption, color: Colors.textTertiary, marginTop: 6, lineHeight: 16 },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionNote: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
});
