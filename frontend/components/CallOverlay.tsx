/**
 * Full-screen call UI, rendered above every route.
 *
 * On a build with CallKeep, the OS already shows its own incoming-call sheet;
 * this overlay is what the user sees once the call is connected, and it is
 * the *only* UI on builds without CallKeep (or in Expo Go, where calling is
 * disabled entirely and the overlay never appears).
 *
 * Calls start audio-only. Either side can turn their camera on mid-call via
 * the video toggle below — call-manager.ts owns that logic; this file just
 * renders whatever track state it publishes.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../constants/theme';
import { callManager, type CallState } from '../lib/call-manager';
import { getWebRTC } from '../lib/native-modules';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Renders one WebRTC video track. Guarded behind getWebRTC() the same way
 * every other native call module is — absent in Expo Go, present in a dev/
 * store build. Returns null rather than throwing if it's unavailable so a
 * missing native module degrades to "no video preview" instead of crashing
 * the whole call.
 */
const VideoTrackView: React.FC<{ track: any; style: any; mirror?: boolean }> = ({
  track,
  style,
  mirror,
}) => {
  const webrtc = getWebRTC();
  if (!webrtc || !track) return null;
  const { RTCView, MediaStream } = webrtc;
  try {
    const stream = new MediaStream(undefined);
    stream.addTrack(track);
    return (
      <RTCView
        streamURL={stream.toURL()}
        style={style}
        objectFit="cover"
        mirror={!!mirror}
        zOrder={mirror ? 1 : 0}
      />
    );
  } catch {
    return null;
  }
};

export const CallOverlay: React.FC = () => {
  const [state, setState] = useState<CallState>(callManager.getState());

  useEffect(() => callManager.subscribe(setState), []);

  const visible =
    state.phase === 'ringing' || state.phase === 'connecting' || state.phase === 'in_call';

  if (!visible) return null;

  const incoming = state.phase === 'ringing' && !state.isOutgoing;
  const showingVideo = state.phase === 'in_call' && (state.isVideoOn || state.isPeerVideoOn);

  const statusLine = (() => {
    if (state.phase === 'ringing') return incoming ? 'Incoming call' : 'Ringing…';
    if (state.phase === 'connecting') return 'Connecting…';
    return formatDuration(state.durationSeconds);
  })();

  return (
    <Modal visible transparent={false} animationType="slide" statusBarTranslucent>
      <View style={styles.container} testID="call-overlay">
        {/* Peer's video fills the screen behind everything when they've turned
            their camera on; falls back to the plain avatar header otherwise. */}
        {showingVideo && state.isPeerVideoOn && state.peerVideoTrack && (
          <VideoTrackView track={state.peerVideoTrack} style={StyleSheet.absoluteFill} />
        )}

        <View style={styles.header}>
          {!(showingVideo && state.isPeerVideoOn) && (
            <View style={styles.avatar}>
              <Ionicons name="person" size={44} color="#fff" />
            </View>
          )}
          <Text style={[styles.name, showingVideo && state.isPeerVideoOn && styles.nameOnVideo]}>
            {state.peerName || 'NurseConnect'}
          </Text>
          <Text style={[styles.status, showingVideo && state.isPeerVideoOn && styles.statusOnVideo]}>
            {statusLine}
          </Text>
          {state.phase === 'connecting' && (
            <ActivityIndicator color="rgba(255,255,255,0.8)" style={{ marginTop: 12 }} />
          )}
          {!!state.error && <Text style={styles.error}>{state.error}</Text>}
        </View>

        {/* Your own camera preview — small, corner-pinned, only while it's on. */}
        {state.isVideoOn && state.localVideoTrack && (
          <View style={styles.selfPreview}>
            <VideoTrackView track={state.localVideoTrack} style={StyleSheet.absoluteFill} mirror />
          </View>
        )}

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
                icon={state.isVideoOn ? 'videocam' : 'videocam-off'}
                label="Video"
                active={state.isVideoOn}
                onPress={() => callManager.toggleVideo()}
                testID="call-video"
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
            {incoming
              ? 'Swipe up on the lock screen to answer'
              : showingVideo
                ? 'Video call · end-to-end via NurseConnect'
                : 'Audio call · end-to-end via NurseConnect · tap the camera icon to add video'}
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
  nameOnVideo: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  status: { ...Typography.body, color: 'rgba(255,255,255,0.75)', marginTop: 8 },
  statusOnVideo: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  error: {
    ...Typography.small,
    color: '#FECACA',
    marginTop: Spacing.md,
    textAlign: 'center',
    lineHeight: 18,
  },
  controls: { paddingHorizontal: Spacing.lg },
  selfPreview: {
    position: 'absolute',
    top: 56,
    right: Spacing.lg,
    width: 96,
    height: 128,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
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
