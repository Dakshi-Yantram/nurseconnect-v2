import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '../components/Header';
import { InputField } from '../components/InputField';
import { GradientButton } from '../components/GradientButton';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Spacing } from '../constants/theme';
import { useStore } from '../store';

export default function EditProfile() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const updateUser = useStore((s) => s.updateUser);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [abha, setAbha] = useState(user?.abhaId || '');

  const save = () => {
    if (!name.trim()) {
      Alert.alert('Name is required');
      return;
    }
    updateUser({ name, email, phone, abhaId: abha });
    Alert.alert('Profile updated', 'Your changes have been saved', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} testID="edit-profile-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Edit Profile" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
          <InputField label="Full name" value={name} onChangeText={setName} iconLeft="person-outline" testID="edit-name" />
          <InputField label="Mobile" value={phone} onChangeText={setPhone} prefix="+91" keyboardType="phone-pad" iconLeft="call-outline" testID="edit-phone" />
          <InputField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" iconLeft="mail-outline" testID="edit-email" />
          <InputField label="ABHA ID" value={abha} onChangeText={setAbha} iconLeft="card-outline" testID="edit-abha" />
          <GradientButton title="Save changes" onPress={save} testID="edit-save" style={{ marginTop: 16 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
});
