/**
 * Call orchestration: Dyte (audio) + CallKeep (native call UI) + push wake-up.
 *
 * A singleton rather than a hook, because incoming calls arrive from places
 * React knows nothing about — a PushKit callback on a killed app, or an FCM
 * background handler. Those entry points need somewhere to hand a call off to
 * before any component has mounted.
 *
 * The one rule that governs the iOS design: when a PushKit push arrives, the
 * app MUST report an incoming call to CallKit in the same turn. iOS kills
 * apps that don't, and repeatedly offending gets VoIP push privileges pulled
 * for the whole app. So `reportIncomingCall` runs first and unconditionally;
 * fetching credentials and joining audio happens afterwards, only if the user
 * actually answers.
 */
import { Platform } from 'react-native';
import { callsService, type CallEndReason, type IncomingCallPayload } from '../services/calls.service';
import { getCallKeep, getRealtimeKit, callingSupported } from './native-modules';

export type CallPhase = 'idle' | 'ringing' | 'connecting' | 'in_call' | 'ended';

export interface CallState {
  phase: CallPhase;
  bookingId: string | null;
  callSessionId: string | null;
  /** Who the *other* party is, for display. */
  peerName: string;
  /** True when we placed the call, false when we're answering one. */
  isOutgoing: boolean;
  isMuted: boolean;
  isSpeakerOn: boolean;
  durationSeconds: number;
  error: string | null;
}

const INITIAL: CallState = {
  phase: 'idle',
  bookingId: null,
  callSessionId: null,
  peerName: '',
  isOutgoing: false,
  isMuted: false,
  isSpeakerOn: false,
  durationSeconds: 0,
  error: null,
};

type Listener = (state: CallState) => void;

class CallManager {
  private state: CallState = { ...INITIAL };
  private listeners = new Set<Listener>();
  private meeting: any = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** CallKeep identifies calls by UUID; we map it to our call session. */
  private callKeepUuid: string | null = null;
  private setupDone = false;

  // ----------------------------------------------------------- subscribe --
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  getState(): CallState {
    return this.state;
  }

  private set(patch: Partial<CallState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }

  // --------------------------------------------------------------- setup --
  /**
   * Configure CallKeep once. Safe to call repeatedly and safe to call in
   * Expo Go (it no-ops), so callers don't have to guard.
   */
  async setup(): Promise<void> {
    if (this.setupDone) return;
    const CallKeep = getCallKeep();
    if (!CallKeep) return;

    try {
      await CallKeep.setup({
        ios: {
          appName: 'NurseConnect',
          supportsVideo: false,
          maximumCallGroups: '1',
          maximumCallsPerCallGroup: '1',
        },
        android: {
          alertTitle: 'Phone account permission',
          alertDescription:
            'NurseConnect needs permission to show incoming calls from families and nurses.',
          cancelButton: 'Not now',
          okButton: 'Allow',
          // Required for the full-screen incoming call UI on Android.
          additionalPermissions: [],
          foregroundService: {
            channelId: 'com.yantrammedtech.nurseconnect.call',
            channelName: 'Ongoing call',
            notificationTitle: 'NurseConnect call in progress',
          },
        },
      });
      CallKeep.setAvailable(true);

      CallKeep.addEventListener('answerCall', ({ callUUID }: { callUUID: string }) => {
        this.onNativeAnswer(callUUID);
      });
      CallKeep.addEventListener('endCall', ({ callUUID }: { callUUID: string }) => {
        this.onNativeEnd(callUUID);
      });
      CallKeep.addEventListener(
        'didPerformSetMutedCallAction',
        ({ muted }: { muted: boolean }) => {
          this.applyMute(muted);
        },
      );
      this.setupDone = true;
    } catch (e) {
      console.warn('[calls] CallKeep setup failed:', (e as Error)?.message);
    }
  }

  // ------------------------------------------------------------- ringing --
  /**
   * Show the native incoming-call UI. Called straight from the PushKit /
   * FCM handler — do not await anything slow before this.
   */
  reportIncomingCall(payload: IncomingCallPayload, callKeepUuid?: string): void {
    const uuid = callKeepUuid || this.makeUuid();
    this.callKeepUuid = uuid;
    this.set({
      phase: 'ringing',
      bookingId: payload.booking_id,
      callSessionId: payload.call_session_id,
      peerName: payload.caller_name || 'NurseConnect',
      isOutgoing: false,
      error: null,
      durationSeconds: 0,
    });

    const CallKeep = getCallKeep();
    if (!CallKeep) return; // in-app UI still shows via subscribers
    try {
      CallKeep.displayIncomingCall(
        uuid,
        payload.caller_name || 'NurseConnect',
        payload.caller_name || 'NurseConnect',
        'generic',
        false, // audio only
      );
    } catch (e) {
      console.warn('[calls] displayIncomingCall failed:', (e as Error)?.message);
    }
  }

  // ------------------------------------------------------------ outgoing --
  async startCall(bookingId: string, peerName: string): Promise<void> {
    if (!callingSupported()) {
      this.set({ error: 'In-app calling needs a development build.', phase: 'idle' });
      return;
    }
    this.set({
      phase: 'connecting',
      bookingId,
      peerName,
      isOutgoing: true,
      error: null,
      durationSeconds: 0,
    });

    try {
      const creds = await callsService.start(bookingId);
      this.set({ callSessionId: creds.call_session_id });

      const uuid = this.makeUuid();
      this.callKeepUuid = uuid;
      getCallKeep()?.startCall(uuid, peerName, peerName, 'generic', false);

      await this.joinMeeting(creds.dyte_auth_token);
    } catch (e: any) {
      this.set({ error: this.describe(e, 'Could not start the call'), phase: 'idle' });
      this.teardownNative();
    }
  }

  // -------------------------------------------------------------- answer --
  /** Answer from our own in-app UI (as opposed to the native CallKit sheet). */
  async answer(): Promise<void> {
    const { bookingId, callSessionId } = this.state;
    if (!bookingId || !callSessionId) return;
    if (!callingSupported()) {
      this.set({ error: 'In-app calling needs a development build.' });
      return;
    }
    this.set({ phase: 'connecting', error: null });
    try {
      const creds = await callsService.join(bookingId, callSessionId);
      await this.joinMeeting(creds.dyte_auth_token);
      if (this.callKeepUuid) getCallKeep()?.answerIncomingCall(this.callKeepUuid);
    } catch (e: any) {
      this.set({ error: this.describe(e, 'Could not join the call'), phase: 'idle' });
      this.teardownNative();
    }
  }

  async decline(): Promise<void> {
    await this.hangUp('declined');
  }

  // ------------------------------------------------------------- hang up --
  async hangUp(reason: CallEndReason = 'completed'): Promise<void> {
    const { bookingId, callSessionId } = this.state;

    try {
      this.meeting?.leaveRoom?.();
    } catch {
      // Already left, or never joined.
    }
    this.meeting = null;
    this.stopTimer();
    this.teardownNative();

    if (bookingId && callSessionId) {
      try {
        await callsService.end(bookingId, callSessionId, reason);
      } catch {
        // Best effort — the server also ends calls on its own timeout, and
        // the user has already left, so surfacing this would only confuse.
      }
    }
    this.set({ ...INITIAL, phase: 'ended' });
    // Settle back to idle so a later call starts from a clean slate.
    setTimeout(() => {
      if (this.state.phase === 'ended') this.set({ ...INITIAL });
    }, 1200);
  }

  // --------------------------------------------------------------- audio --
  toggleMute(): void {
    this.applyMute(!this.state.isMuted);
    if (this.callKeepUuid) {
      getCallKeep()?.setMutedCall(this.callKeepUuid, !this.state.isMuted);
    }
  }

  private applyMute(muted: boolean): void {
    try {
      if (muted) this.meeting?.self?.disableAudio?.();
      else this.meeting?.self?.enableAudio?.();
    } catch {
      // Meeting not attached yet — the flag still reflects user intent and is
      // applied when the room is joined.
    }
    this.set({ isMuted: muted });
  }

  toggleSpeaker(): void {
    const next = !this.state.isSpeakerOn;
    try {
      // CallKeep owns the audio route on iOS; Dyte exposes it on Android.
      if (Platform.OS === 'android') {
        this.meeting?.self?.setSpeakerEnabled?.(next);
      } else {
        getCallKeep()?.toggleAudioRouteSpeaker(this.callKeepUuid, next);
      }
    } catch {
      // Route switching is best-effort; never fail the call over it.
    }
    this.set({ isSpeakerOn: next });
  }

  // ------------------------------------------------------------ internals --
  /** Attach to the Dyte meeting with a participant token. Audio only. */
  private async joinMeeting(authToken: string): Promise<void> {
    const rtk = getRealtimeKit();
    if (!rtk) throw new Error('Calling is unavailable in this build');

    const RealtimeKitClient = rtk.default ?? rtk.RealtimeKitClient ?? rtk;
    const meeting = await RealtimeKitClient.init({
      authToken,
      defaults: { audio: true, video: false },
    });
    this.meeting = meeting;

    // Never request the camera — this is a voice product, and asking for
    // video permission on a care call is both wrong and alarming.
    try {
      meeting.self?.disableVideo?.();
      meeting.self?.enableAudio?.();
    } catch {
      // Some SDK versions enable audio implicitly from `defaults`.
    }

    meeting.self?.on?.('roomJoined', () => {
      this.set({ phase: 'in_call' });
      this.startTimer();
    });
    meeting.self?.on?.('roomLeft', () => {
      this.stopTimer();
      if (this.state.phase !== 'idle') this.hangUp('completed');
    });

    await meeting.joinRoom();
    // Some SDK builds resolve joinRoom before emitting roomJoined; make sure
    // the UI still advances rather than sitting on "connecting" forever.
    if (this.state.phase === 'connecting') {
      this.set({ phase: 'in_call' });
      this.startTimer();
    }
    if (this.state.isMuted) this.applyMute(true);
  }

  private onNativeAnswer(callUUID: string): void {
    this.callKeepUuid = callUUID;
    if (this.state.phase === 'ringing') this.answer();
  }

  private onNativeEnd(callUUID: string): void {
    this.callKeepUuid = callUUID;
    // The user hit the red button on the native sheet. If they never joined,
    // record it as a decline so the caller sees the right outcome.
    this.hangUp(this.state.phase === 'in_call' ? 'completed' : 'declined');
  }

  private teardownNative(): void {
    const CallKeep = getCallKeep();
    if (CallKeep && this.callKeepUuid) {
      try {
        CallKeep.endCall(this.callKeepUuid);
      } catch {
        // Already ended by the OS.
      }
    }
    this.callKeepUuid = null;
  }

  private startTimer(): void {
    this.stopTimer();
    this.timer = setInterval(
      () => this.set({ durationSeconds: this.state.durationSeconds + 1 }),
      1000,
    );
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private makeUuid(): string {
    // CallKeep requires a v4-shaped UUID string.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private describe(e: any, fallback: string): string {
    const detail = e?.detail?.detail ?? e?.detail;
    if (typeof detail === 'string') return detail;
    if (typeof detail?.message === 'string') return detail.message;
    return e?.message || fallback;
  }
}

export const callManager = new CallManager();
