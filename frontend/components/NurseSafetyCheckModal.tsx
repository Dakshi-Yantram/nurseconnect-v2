/**
 * Nurse Safety Check — reaction test + fitness declaration, combined on one
 * screen, shown when the nurse taps "En Route" for an accepted booking.
 *
 * Replaces the old AlertnessCheckModal (which logged results but never
 * blocked anything). This one is a real gate:
 *   - 5 rounds, tap the target as soon as it turns green.
 *   - PASS  (avg < 380ms, 0 lapses)   -> declaration + Confirm unlocks, then
 *                                        POST /bookings/{id}/en-route succeeds.
 *   - WARNING (avg 380-450ms)          -> short breather, one retry offered.
 *   - FAIL  (avg > 450ms or >1 lapse)  -> booking is reassigned server-side;
 *                                        nurse is told to rest, modal closes.
 *
 * The whole thing (5 taps + reading + ticking the declaration) is designed
 * to take under ~20 seconds, per spec.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { workerSelfService } from '../services/worker-self.service';
import { bookingsService } from '../services/bookings.service';

const ROUNDS = 5;
const BUTTON_SIZE = 76;
const MIN_DELAY_MS = 1000;
const MAX_DELAY_MS = 3000;
const LAPSE_THRESHOLD_MS = 500; // must mirror app/services/fatigue_engine.py

type Phase = 'intro' | 'waiting' | 'target' | 'round-done' | 'scoring' | 'warning' | 'fail' | 'declaration';

interface Props {
  visible: boolean;
  bookingId: string;
  onClose: () => void;
  /** Called once en-route is actually confirmed server-side (game passed, declaration ticked, en-route call succeeded). */
  onEnRouteConfirmed: () => void;
}

const DECLARATION_ITEMS = [
  'I am fully alert, well-rested, and physically fit to perform this visit safely.',
  'I am not under the influence of exhaustion, illness, or intoxicants.',
  "I have reviewed the patient's booking details and care requirements.",
];

export const NurseSafetyCheckModal: React.FC<Props> = ({ visible, bookingId, onClose, onEnRouteConfirmed }) => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [falseStarts, setFalseStarts] = useState(0);
  const [targetPos, setTargetPos] = useState({ top: 80, left: 80 });
  const [declared, setDeclared] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failMessage, setFailMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [passedCheck, setPassedCheck] = useState(false);

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
    setFalseStarts(0);
    setDeclared(false);
    setFailMessage(null);
    setWarningMessage(null);
    setPassedCheck(false);
  }, []);

  useEffect(() => {
    if (visible) resetGame();
    return clearTimer;
  }, [visible, resetGame]);

  const placeTargetRandomly = () => {
    const { width } = Dimensions.get('window');
    const padding = 24;
    const usableWidth = Math.min(width, 480) - padding * 2 - BUTTON_SIZE;
    const usableHeight = 160;
    setTargetPos({
      left: padding + Math.round(Math.random() * Math.max(usableWidth, 0)),
      top: 16 + Math.round(Math.random() * usableHeight),
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
    setFalseStarts(0);
    startRound();
  };

  /** Tapped the play area before the cue turned green — a false start. */
  const onEarlyTap = () => {
    if (phase !== 'waiting') return;
    setFalseStarts((m) => m + 1);
  };

  const onTargetTap = () => {
    if (phase !== 'target') return;
    const reaction = Date.now() - shownAt.current;
    const nextTimes = [...times, reaction];
    setTimes(nextTimes);

    if (round >= ROUNDS) {
      score(nextTimes, falseStarts);
    } else {
      setRound((r) => r + 1);
      setPhase('round-done');
      setTimeout(() => startRound(), 350);
    }
  };

  /** Client-side mirror of app/services/fatigue_engine.py — just for instant UI feedback. The server re-checks independently before en-route is allowed. */
  const localTier = (finalTimes: number[], finalFalseStarts: number): 'pass' | 'warning' | 'fail' => {
    const lapses = finalTimes.filter((t) => t > LAPSE_THRESHOLD_MS).length;
    const avg = Math.round(finalTimes.reduce((a, b) => a + b, 0) / finalTimes.length);
    if (finalFalseStarts >= 3) return 'fail';
    if (avg < 380 && lapses === 0) return 'pass';
    if (avg <= 450 && lapses <= 1) return 'warning';
    return 'fail';
  };

  const score = async (finalTimes: number[], finalFalseStarts: number) => {
    setPhase('scoring');
    setSubmitting(true);
    try {
      const result = await workerSelfService.submitAlertnessCheck({
        booking_id: bookingId,
        round_reaction_times_ms: finalTimes,
        false_starts: finalFalseStarts,
        declaration_confirmed: false, // declaration is ticked and sent on the confirm step below
      });
      if (result.tier === 'pass') {
        setPassedCheck(true);
        setPhase('declaration');
      } else if (result.tier === 'warning') {
        setWarningMessage(result.message || 'Your reaction time is a little slow. Take a breather and try once more.');
        setPhase('warning');
      } else {
        setFailMessage(
          result.message ||
            'You seem very fatigued right now — this booking will be reassigned so you can rest.',
        );
        setPhase('fail');
      }
    } catch {
      // Fall back to the local estimate if the network call itself failed —
      // still require a retry through the server before allowing "Confirm".
      const tier = localTier(finalTimes, finalFalseStarts);
      if (tier === 'pass') {
        setPassedCheck(true);
        setPhase('declaration');
      } else if (tier === 'warning') {
        setWarningMessage('Your reaction time is a little slow. Take a breather and try once more.');
        setPhase('warning');
      } else {
        setFailMessage('Could not confirm your alertness check. Please try again.');
        setPhase('fail');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmAndStart = async () => {
    if (!declared || !passedCheck) return;
    setSubmitting(true);
    try {
      // Record the declaration against the same attempt, then attempt the
      // actual status transition — the server independently re-verifies a
      // passing, declaration-confirmed attempt exists before allowing it.
      await workerSelfService.submitAlertnessCheck({
        booking_id: bookingId,
        round_reaction_times_ms: times,
        false_starts: falseStarts,
        declaration_confirmed: true,
      });
      await bookingsService.markEnRoute(bookingId);
      onEnRouteConfirmed();
    } catch (e: any) {
      const code = e?.detail?.code;
      if (code === 'SAFETY_CHECK_WARNING') {
        setWarningMessage('Your reaction time is a little slow. Take a breather and try once more.');
        setPhase('warning');
      } else if (code === 'SAFETY_CHECK_FAILED') {
        setFailMessage(
          e?.detail?.message ||
            'You seem very fatigued right now — this booking has been reassigned so you can rest.',
        );
        setPhase('fail');
      } else {
        setFailMessage(e?.message || 'Could not start the journey. Please try again.');
        setPhase('fail');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const average = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} testID="safety-check-modal">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Nurse Safety Check</Text>
            {phase !== 'fail' && (
              <TouchableOpacity onPress={onClose} testID="safety-check-close">
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {phase === 'intro' && (
            <View style={styles.centerBlock}>
              <View style={styles.terminal}>
                <Text style={styles.terminalTitle}>NURSE SAFETY CHECK</Text>
                <Text style={styles.terminalBody}>
                  Tap the green circle as fast as you can when it appears — {ROUNDS} rounds, about 15 seconds.
                </Text>
              </View>
              <Text style={styles.bodyTxt}>
                This is required before heading to the patient. It only takes a moment.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={startGame} testID="safety-check-start">
                <Text style={styles.primaryBtnTxt}>Start check</Text>
              </TouchableOpacity>
            </View>
          )}

          {(phase === 'waiting' || phase === 'target' || phase === 'round-done') && (
            <View style={styles.playArea} testID="safety-check-play-area">
              <TouchableOpacity
                activeOpacity={1}
                style={StyleSheet.absoluteFill}
                onPress={onEarlyTap}
                testID="safety-check-early-tap-zone"
              />
              <Text style={styles.roundLabel}>
                Trial {Math.min(round, ROUNDS)} of {ROUNDS}
              </Text>
              {phase === 'waiting' && <Text style={styles.waitTxt}>Wait for it…</Text>}
              {phase === 'round-done' && <Text style={styles.waitTxt}>Nice tap!</Text>}
              {phase === 'target' && (
                <Animated.View
                  style={[styles.targetBtn, { top: targetPos.top, left: targetPos.left, transform: [{ scale }] }]}
                >
                  <TouchableOpacity style={styles.targetTouchable} onPress={onTargetTap} testID="safety-check-target">
                    <Ionicons name="checkmark" size={30} color="#fff" />
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
          )}

          {phase === 'scoring' && (
            <View style={styles.centerBlock}>
              <Text style={styles.bodyTxt}>Checking your result…</Text>
            </View>
          )}

          {phase === 'warning' && (
            <View style={styles.centerBlock} testID="safety-check-warning">
              <Ionicons name="alert-circle" size={44} color={Colors.warning} />
              <Text style={styles.resultTitle}>A little slow</Text>
              <Text style={styles.bodyTxt}>{warningMessage}</Text>
              <Text style={[styles.bodyTxt, { color: Colors.textTertiary }]}>
                Average reaction time: {average}ms
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={startGame} testID="safety-check-retry">
                <Text style={styles.primaryBtnTxt}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'fail' && (
            <View style={styles.centerBlock} testID="safety-check-fail">
              <Ionicons name="bed-outline" size={44} color={Colors.danger} />
              <Text style={styles.resultTitle}>Time to rest</Text>
              <Text style={styles.bodyTxt}>{failMessage}</Text>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: Colors.textSecondary }]} onPress={onClose} testID="safety-check-dismiss">
                <Text style={styles.primaryBtnTxt}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'declaration' && (
            <View testID="safety-check-declaration">
              <View style={styles.resultRow}>
                <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
                <Text style={styles.resultRowTxt}>Safety check passed — avg {average}ms</Text>
              </View>

              <Text style={styles.declareHeader}>Fitness declaration</Text>
              <TouchableOpacity
                style={styles.declareRow}
                onPress={() => setDeclared((d) => !d)}
                testID="safety-check-declare-toggle"
              >
                <Ionicons
                  name={declared ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={declared ? Colors.teal : Colors.textTertiary}
                />
                <View style={{ flex: 1 }}>
                  {DECLARATION_ITEMS.map((line) => (
                    <Text key={line} style={styles.declareItem}>
                      • {line}
                    </Text>
                  ))}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, (!declared || submitting) && styles.primaryBtnDisabled]}
                onPress={confirmAndStart}
                disabled={!declared || submitting}
                testID="safety-check-confirm"
              >
                <Text style={styles.primaryBtnTxt}>{submitting ? 'Starting…' : 'Confirm & start journey'}</Text>
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
    minHeight: 460,
    ...Shadows.card,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...Typography.h4, color: Colors.textPrimary },
  centerBlock: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg, gap: 14 },
  bodyTxt: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  terminal: {
    width: '100%',
    backgroundColor: '#0B0F14',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
  },
  terminalTitle: { color: '#E2E8F0', fontFamily: 'monospace', fontSize: 13, letterSpacing: 1, marginBottom: 8 },
  terminalBody: { color: '#94A3B8', fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
  primaryBtn: {
    backgroundColor: Colors.teal,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: Radius.pill,
    marginTop: 6,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnTxt: { ...Typography.body, color: '#fff', fontWeight: '700' as const },
  playArea: {
    height: 220,
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
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.sm },
  resultRowTxt: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' as const },
  declareHeader: { ...Typography.small, color: Colors.textSecondary, fontWeight: '700' as const, marginTop: Spacing.lg, marginBottom: 6 },
  declareRow: { flexDirection: 'row', gap: 10, padding: Spacing.md, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.lg, marginBottom: Spacing.md },
  declareItem: { ...Typography.small, color: Colors.textSecondary, lineHeight: 18 },
});
