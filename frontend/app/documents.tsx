import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';

const DOCS = [
  { id: 'd1', name: 'Nursing License', issuer: 'Maharashtra Nursing Council', expiry: '2027-06-15', status: 'verified', icon: 'shield-check-outline' },
  { id: 'd2', name: 'Aadhaar Card', issuer: 'UIDAI', expiry: null, status: 'verified', icon: 'card-outline' },
  { id: 'd3', name: 'PAN Card', issuer: 'Income Tax Dept.', expiry: null, status: 'verified', icon: 'card-outline' },
  { id: 'd4', name: 'Police Verification', issuer: 'Mumbai Police', expiry: '2026-08-22', status: 'expiring', icon: 'shield-account-outline' },
  { id: 'd5', name: 'Bank Passbook', issuer: 'HDFC Bank', expiry: null, status: 'verified', icon: 'bank-outline' },
];

export default function Documents() {
  return (
    <SafeAreaView style={styles.safe} testID="documents-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="My Documents" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
        {DOCS.map((d) => (
          <TouchableOpacity
            key={d.id}
            style={styles.row}
            onPress={() => Alert.alert(d.name, `Issued by ${d.issuer}\nStatus: ${d.status}`)}
            testID={`doc-${d.id}`}
          >
            <View style={[styles.icon, { backgroundColor: d.status === 'verified' ? Colors.successBg : Colors.warningBg }]}>
              <MaterialCommunityIcons name={d.icon as any} size={20} color={d.status === 'verified' ? Colors.success : Colors.warning} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{d.name}</Text>
              <Text style={styles.sub}>{d.issuer}</Text>
              {d.expiry && (
                <Text style={styles.expiry}>
                  Expires {new Date(d.expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              )}
            </View>
            <View style={[styles.badge, { backgroundColor: d.status === 'verified' ? Colors.successBg : Colors.warningBg }]}>
              <Ionicons name={d.status === 'verified' ? 'checkmark-circle' : 'alert-circle'} size={14} color={d.status === 'verified' ? Colors.success : Colors.warning} />
            </View>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => Alert.alert('Upload', 'Document upload requires camera permission')}
          testID="upload-doc-btn"
        >
          <Ionicons name="add" size={18} color={Colors.primary} />
          <Text style={styles.addTxt}>Upload new document</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, marginBottom: 8, ...Shadows.card },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { ...Typography.bodyBold, color: Colors.textPrimary },
  sub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  expiry: { ...Typography.caption, color: Colors.textTertiary, marginTop: 4 },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed', gap: 8, marginTop: 8 },
  addTxt: { ...Typography.bodyBold, color: Colors.primary },
});
