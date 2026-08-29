/**
 * Pre-navigation alertness / fatigue check.
 *
 * A short reaction-tap game shown right before a nurse opens Google Maps
 * for an accepted booking: a green button appears at a random spot after a
 * random delay, she taps it as fast as she can, three rounds. The result is
 * logged to the backend (`workerSelfService.submitAlertnessCheck`) for ops
 * to spot patterns of fatigue — but it never blocks the nurse from reaching
 * her patient. Even on a poor score she can continue straight to Maps; the
 * screen only asks her to pause and notice how alert she feels.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { workerSelfService } from '../services/worker-self.service';

const ROUNDS = 3;
const BUTTON_SIZE = 76;
const MIN_DELAY_MS = 700;
const MAX_DELAY_MS = 2200;
const PASS_THRESHOLD_MS = 900;
const MAX_MISSED_TAPS = 1;

type Phase = 'intro' | 'waiting' | 'target' | 'round-done' | 'result';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called once the nurse taps "Continue to Maps" — fires whether she passed or not. */
  onContinue: () => void;
  bookingId?: string;
}

export const AlertnessCheckModal: React.FC<Props> = ({ visible, onClose, onContinue, bookingId }) => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [missed, setMissed] = useState(0);
  const [targetPos, setTargetPos] = useState({ top: 80, left: 80 });
  const [submitting, setSubmitting] = useState(false);

  const shownAt = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scale = useRef(new Animated.Value(0)).current;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetGame = useCallback(() => {
    clearTimer();
    setPhase('intro');
    setRound(0);
    setTimes([]);
    setMissed(0);
  }, []);

  useEffect(() => {
    if (visible) resetGame();
    return clearTimer;
  }, [visible, resetGame]);

  const placeTargetRandomly = () => {
    const { width } = Dimensions.get('window');
    const padding = 24;
    const usableWidth = Math.min(width, 480) - padding * 2 - BUTTON_SIZE;
    const usableHeight = 220;
    setTargetPos({
      left: padding + Math.round(Math.random() * Math.max(usableWidth, 0)),
      top: 20 + Math.round(Math.random() * usableHeight),
    });
  };

  const startRound = () => {
    setPhase('waiting');
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    timerRef.current = setTimeout(() => {
      placeTargetRandomly();
      shownAt.current = Date.now();
      scale.setValue(0);
      setPhase('target');
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
    }, delay);
  };

  const startGame = () => {
    setRound(1);
    setTimes([]);
    setMissed(0);
    startRound();
  };

  /** Tapped somewhere on the play area before the green button appeared. */
  const onEarlyTap = () => {
    if (phase !== 'waiting') return;
    setMissed((m) => m + 1);
  };

  const onTargetTap = () => {
    if (phase !== 'target') return;
    const reaction = Date.now() - shownAt.current;
    const nextTimes = [...times, reaction];
    setTimes(nextTimes);

    if (round >= ROUNDS) {
      finish(nextTimes, missed);
    } else {
      setRound((r) => r + 1);
      setPhase('round-done');
      setTimeout(() => startRound(), 500);
    }
  };

  const finish = async (finalTimes: number[], finalMissed: number) => {
    setPhase('result');
    setSubmitting(true);
    try {
      await workerSelfService.submitAlertnessCheck({
        booking_id: bookingId,
        round_reaction_times_ms: finalTimes,
        missed_taps: finalMissed,
      });
    } catch {
      // Non-blocking — a failed log shouldn't stop the nurse from continuing.
    } finally {
      setSubmitting(false);
    }
  };

  const average = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const passed = times.length === ROUNDS && average <= PASS_THRESHOLD_MS && missed <= MAX_MISSED_TAPS;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} testID="alertness-check-modal">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Quick alertness check</Text>
            <TouchableOpacity onPress={onClose} testID="alertness-close">
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {phase === 'intro' && (
            <View style={styles.centerBlock}>
              <Ionicons name="flash-outline" size={40} color={Colors.teal} />
              <Text style={styles.bodyTxt}>
                Before you head out, tap the green button as soon as it appears — {ROUNDS} rounds. This
                just helps us understand fatigue trends across visits; it never blocks your visit.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={startGame} testID="alertness-start">
                <Text style={styles.primaryBtnTxt}>Start</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onContinue} testID="alertness-skip">
                <Text style={styles.skipTxt}>Skip and open Maps</Text>
              </TouchableOpacity>
            </View>
          )}

          {(phase === 'waiting' || phase === 'target' || phase === 'round-done') && (
            <View style={styles.playArea} testID="alertness-play-area">
              <TouchableOpacity
                activeOpacity={1}
                style={StyleSheet.absoluteFill}
                onPress={onEarlyTap}
                testID="alertness-early-tap-zone"
              />
              <Text style={styles.roundLabel}>
                Round {Math.min(round, ROUNDS)} of {ROUNDS}
              </Text>
              {phase === 'waiting' && <Text style={styles.waitTxt}>Wait for it…</Text>}
              {phase === 'round-done' && <Text style={styles.waitTxt}>Nice tap!</Text>}
              {phase === 'target' && (
                <Animated.View
                  style={[
                    styles.targetBtn,
                    { top: targetPos.top, left: targetPos.left, transform: [{ scale }] },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.targetTouchable}
                    onPress={onTargetTap}
                    testID="alertness-target"
                  >
                    <Ionicons name="checkmark" size={30} color="#fff" />
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
          )}

          {phase === 'result' && (
            <View style={styles.centerBlock} testID="alertness-result">
              <Ionicons
                name={passed ? 'checkmark-circle' : 'alert-circle'}
                size={44}
                color={passed ? Colors.success : Colors.warning}
              />
              <Text style={styles.resultTitle}>{passed ? "You're looking sharp" : 'Reaction was a bit slow'}</Text>
              <Text style={styles.bodyTxt}>
                Average reaction time: {average}ms{missed > 0 ? ` · ${missed} early tap${missed > 1 ? 's' : ''}` : ''}
              </Text>
              {!passed && (
                <Text style={[styles.bodyTxt, { color: Colors.warning }]}>
                  If you're feeling drowsy, consider a short break before you drive. You can still
                  continue to your visit.
                </Text>
              )}
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={onContinue}
                disabled={submitting}
                testID="alertness-continue"
              >
                <Text style={styles.primaryBtnTxt}>{submitting ? 'Saving…' : 'Continue to Maps'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    minHeight: 420,
    ...Shadows.card,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...Typography.h4, color: Colors.textPrimary },
  centerBlock: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl, gap: 14 },
  bodyTxt: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  primaryBtn: {
    backgroundColor: Colors.teal,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: Radius.pill,
    marginTop: 6,
  },
  primaryBtnTxt: { ...Typography.body, color: '#fff', fontWeight: '700' as const },
  skipTxt: { ...Typography.small, color: Colors.textTertiary, marginTop: 4, textDecorationLine: 'underline' },
  playArea: {
    height: 300,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceAlt,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  roundLabel: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  waitTxt: { ...Typography.body, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.lg },
  targetBtn: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.success,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  targetTouchable: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: { ...Typography.h4, color: Colors.textPrimary, textAlign: 'center' },
});
