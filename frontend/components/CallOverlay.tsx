/**
 * Full-screen call UI, rendered above every route.
 *
 * On a build with CallKeep, the OS already shows its own incoming-call sheet;
 * this overlay is what the user sees once the call is connected, and it is
 * the *only* UI on builds without CallKeep (or in Expo Go, where calling is
 * disabled entirely and the overlay never appears).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../constants/theme';
import { callManager, type CallState } from '../lib/call-manager';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const CallOverlay: React.FC = () => {
  const [state, setState] = useState<CallState>(callManager.getState());

  useEffect(() => callManager.subscribe(setState), []);

  const visible =
    state.phase === 'ringing' || state.phase === 'connecting' || state.phase === 'in_call';

  if (!visible) return null;

  const incoming = state.phase === 'ringing' && !state.isOutgoing;

  const statusLine = (() => {
    if (state.phase === 'ringing') return incoming ? 'Incoming call' : 'Ringing…';
    if (state.phase === 'connecting') return 'Connecting…';
    return formatDuration(state.durationSeconds);
  })();

  return (
    <Modal visible transparent={false} animationType="slide" statusBarTranslucent>
      <View style={styles.container} testID="call-overlay">
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={44} color="#fff" />
          </View>
          <Text style={styles.name}>{state.peerName || 'NurseConnect'}</Text>
          <Text style={styles.status}>{statusLine}</Text>
          {state.phase === 'connecting' && (
            <ActivityIndicator color="rgba(255,255,255,0.8)" style={{ marginTop: 12 }} />
          )}
          {!!state.error && <Text style={styles.error}>{state.error}</Text>}
        </View>

        <View style={styles.controls}>
          {state.phase === 'in_call' && (
            <View style={styles.secondaryRow}>
              <ControlButton
                icon={state.isMuted ? 'mic-off' : 'mic'}
                label={state.isMuted ? 'Unmute' : 'Mute'}
                active={state.isMuted}
                onPress={() => callManager.toggleMute()}
                testID="call-mute"
              />
              <ControlButton
                icon={state.isSpeakerOn ? 'volume-high' : 'volume-medium'}
                label="Speaker"
                active={state.isSpeakerOn}
                onPress={() => callManager.toggleSpeaker()}
                testID="call-speaker"
              />
            </View>
          )}

          <View style={styles.primaryRow}>
            {incoming && (
              <TouchableOpacity
                style={[styles.bigBtn, { backgroundColor: Colors.success }]}
                onPress={() => callManager.answer()}
                testID="call-answer"
              >
                <Ionicons name="call" size={30} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.bigBtn, { backgroundColor: Colors.danger }]}
              onPress={() => (incoming ? callManager.decline() : callManager.hangUp())}
              testID="call-hangup"
            >
              <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            {incoming ? 'Swipe up on the lock screen to answer' : 'Audio call · end-to-end via NurseConnect'}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const ControlButton: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}> = ({ icon, label, active, onPress, testID }) => (
  <TouchableOpacity style={styles.control} onPress={onPress} testID={testID}>
    <View style={[styles.controlIcon, active && styles.controlIconActive]}>
      <Ionicons name={icon} size={22} color={active ? Colors.primaryDark : '#fff'} />
    </View>
    <Text style={styles.controlLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    justifyContent: 'space-between',
    paddingTop: 96,
    paddingBottom: 56,
  },
  header: { alignItems: 'center', paddingHorizontal: Spacing.lg },
  avatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...Typography.h1, color: '#fff', marginTop: Spacing.lg, textAlign: 'center' },
  status: { ...Typography.body, color: 'rgba(255,255,255,0.75)', marginTop: 8 },
  error: {
    ...Typography.small,
    color: '#FECACA',
    marginTop: Spacing.md,
    textAlign: 'center',
    lineHeight: 18,
  },
  controls: { paddingHorizontal: Spacing.lg },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  control: { alignItems: 'center', gap: 8 },
  controlIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlIconActive: { backgroundColor: '#fff' },
  controlLabel: { ...Typography.small, color: 'rgba(255,255,255,0.8)' },
  primaryRow: { flexDirection: 'row', justifyContent: 'center', gap: 56 },
  bigBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
