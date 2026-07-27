/**
 * Family members — people who can receive updates about a booking, and
 * optionally book on the account holder's behalf.
 *
 * Distinct from Patients: a patient is who care is *for*, a family member is
 * who gets *told about it*. Conflating the two is why the old screen listed
 * fake relatives with medical conditions attached.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { InputField } from '../components/InputField';
import { GradientButton } from '../components/GradientButton';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { usersService } from '../services/users.service';
import { normalizePhone } from '../services/auth.service';

const RELATIONSHIPS = ['Spouse', 'Son', 'Daughter', 'Parent', 'Sibling', 'Carer', 'Other'];

export default function FamilyMembers() {
  const members = useStore((s) => s.familyMembers);
  const state = useStore((s) => s.loadState.familyMembers);
  const loadFamilyMembers = useStore((s) => s.loadFamilyMembers);

  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState('Spouse');
  const [phone, setPhone] = useState('');
  const [canReceiveUpdates, setCanReceiveUpdates] = useState(true);
  const [canBook, setCanBook] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadFamilyMembers().catch(() => {});
    }, [loadFamilyMembers]),
  );

  const reset = () => {
    setFullName('');
    setRelationship('Spouse');
    setPhone('');
    setCanReceiveUpdates(true);
    setCanBook(false);
  };

  const save = async () => {
    if (!fullName.trim()) return Alert.alert('Name needed', 'Enter their full name.');
    if (!/^\+?[0-9]{10,15}$/.test(phone.replace(/[\s-]/g, ''))) {
      return Alert.alert('Check the number', 'Enter a valid mobile number.');
    }
    setSaving(true);
    try {
      await usersService.createFamilyMember({
        full_name: fullName.trim(),
        relationship,
        phone_e164: normalizePhone(phone),
        can_receive_updates: canReceiveUpdates,
        can_book: canBook,
      });
      await loadFamilyMembers();
      reset();
      setOpen(false);
    } catch (e: any) {
      Alert.alert('Could not add', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (id: string, name: string) => {
    Alert.alert('Remove this person?', `${name} will stop receiving updates about your care.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await usersService.deleteFamilyMember(id);
            await loadFamilyMembers();
          } catch (e: any) {
            Alert.alert('Could not remove', e?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} testID="family-members-screen" edges={['top']}>
      <OfflineBanner />
      <Header
        title="Family members"
        fallbackHref="/(family)/profile"
        rightIcon="add"
        onRightPress={() => setOpen(true)}
      />

      <AsyncBoundary
        state={state}
        isEmpty={members.length === 0}
        emptyTitle="No family members added"
        emptyDescription="Add a relative or carer so they get visit updates — and, if you choose, can book care on your behalf."
        emptyIcon="people-outline"
        emptyCtaTitle="Add someone"
        onEmptyCtaPress={() => setOpen(true)}
        onRetry={() => loadFamilyMembers()}
      >
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}>
          <Text style={styles.intro}>
            Family members receive updates about visits. Anyone you allow to book can create
            bookings on your account.
          </Text>

          {members.map((m) => (
            <View key={m.id} style={styles.row} testID={`member-${m.id}`}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={22} color={Colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.name}>{m.full_name}</Text>
                <Text style={styles.sub}>
                  {m.relationship}
                  {m.phone_e164 ? ` · ${m.phone_e164}` : ''}
                </Text>
                <View style={styles.tags}>
                  {m.can_receive_updates && (
                    <View style={styles.tag}>
                      <Ionicons name="notifications-outline" size={11} color={Colors.primary} />
                      <Text style={styles.tagTxt}>Gets updates</Text>
                    </View>
                  )}
                  {m.can_book && (
                    <View style={[styles.tag, { backgroundColor: Colors.successBg }]}>
                      <Ionicons name="calendar-outline" size={11} color={Colors.success} />
                      <Text style={[styles.tagTxt, { color: Colors.success }]}>Can book</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => remove(m.id, m.full_name)}
                testID={`remove-${m.id}`}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </AsyncBoundary>

      {/* -------------------------------------------------------- add ---- */}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <Header
            title="Add family member"
            showBack={false}
            rightIcon="close"
            onRightPress={() => setOpen(false)}
          />
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              <InputField
                label="Full name"
                placeholder="Their name"
                value={fullName}
                onChangeText={setFullName}
                testID="member-name"
              />

              <Text style={styles.fieldLabel}>Relationship</Text>
              <View style={styles.chipRow}>
                {RELATIONSHIPS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.chip, relationship === r && styles.chipActive]}
                    onPress={() => setRelationship(r)}
                  >
                    <Text style={[styles.chipTxt, relationship === r && { color: '#fff' }]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <InputField
                label="Mobile number"
                prefix="+91"
                placeholder="98xxxxxxxx"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                testID="member-phone"
              />

              <Toggle
                label="Send them visit updates"
                description="They’ll be notified when a nurse is assigned, arrives and completes a visit."
                value={canReceiveUpdates}
                onToggle={() => setCanReceiveUpdates((v) => !v)}
                testID="member-updates"
              />
              <Toggle
                label="Allow them to book care"
                description="They can create bookings on your account. Only enable this for someone you trust."
                value={canBook}
                onToggle={() => setCanBook((v) => !v)}
                testID="member-book"
              />

              <GradientButton
                title="Add family member"
                onPress={save}
                loading={saving}
                style={{ marginTop: Spacing.md }}
                testID="member-save"
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const Toggle: React.FC<{
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
  testID?: string;
}> = ({ label, description, value, onToggle, testID }) => (
  <TouchableOpacity style={styles.toggleRow} onPress={onToggle} testID={testID}>
    <View style={[styles.checkbox, value && styles.checkboxOn]}>
      {value && <Ionicons name="checkmark" size={14} color="#fff" />}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Text style={styles.toggleDesc}>{description}</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  intro: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    ...Shadows.card,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...Typography.bodyBold, color: Colors.textPrimary },
  sub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.infoBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  tagTxt: { ...Typography.caption, color: Colors.primary, fontWeight: '600' as const },
  fieldLabel: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' as const },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleLabel: { ...Typography.bodyBold, color: Colors.textPrimary },
  toggleDesc: { ...Typography.small, color: Colors.textSecondary, marginTop: 3, lineHeight: 17 },
});
