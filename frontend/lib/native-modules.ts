/**
 * Guarded access to the calling-related native modules.
 *
 * CallKit/PushKit/ConnectionService, Firebase Messaging and the RealtimeKit SDK are
 * all native — they exist only in a custom dev build or a store build, never
 * in Expo Go. Importing them statically makes the whole app crash on launch
 * inside Expo Go, which would take down every screen for the sake of a
 * feature most sessions never touch.
 *
 * So each one is resolved through a `require` in a try/catch, cached, and
 * exposed as "present or null". Callers branch on null and degrade to
 * foreground-only calling rather than throwing.
 */
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/** True when running inside the Expo Go sandbox, where no custom native code exists. */
export const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function safeRequire<T>(load: () => T, label: string): T | null {
  if (IS_EXPO_GO) return null;
  try {
    return load();
  } catch (e) {
    // A missing native module here is expected on some builds (e.g. a debug
    // build made before these deps were added), so this is a warning rather
    // than an error — but it must be visible, because silent absence looks
    // identical to "calls just never ring".
    console.warn(`[calls] native module "${label}" unavailable:`, (e as Error)?.message);
    return null;
  }
}

let _callKeep: any;
let _voipPush: any;
let _messaging: any;
let _dyte: any;
let _webrtc: any;

/** react-native-callkeep — CallKit on iOS, ConnectionService on Android. */
export function getCallKeep(): any | null {
  if (_callKeep === undefined) {
    _callKeep = safeRequire(() => require('react-native-callkeep').default, 'react-native-callkeep');
  }
  return _callKeep;
}

/** react-native-voip-push-notification — iOS PushKit only. */
export function getVoipPush(): any | null {
  if (_voipPush === undefined) {
    _voipPush =
      Platform.OS === 'ios'
        ? safeRequire(
            () => require('react-native-voip-push-notification').default,
            'react-native-voip-push-notification',
          )
        : null;
  }
  return _voipPush;
}

/** @react-native-firebase/messaging — FCM token + background data handler. */
export function getMessaging(): any | null {
  if (_messaging === undefined) {
    _messaging = safeRequire(
      () => require('@react-native-firebase/messaging').default,
      '@react-native-firebase/messaging',
    );
  }
  return _messaging;
}

/** @cloudflare/realtimekit-react-native — the audio engine itself. */
export function getRealtimeKit(): any | null {
  if (_dyte === undefined) {
    _dyte = safeRequire(
      () => require('@cloudflare/realtimekit-react-native'),
      '@cloudflare/realtimekit-react-native',
    );
  }
  return _dyte;
}

/**
 * @cloudflare/react-native-webrtc — RTCView/MediaStream, needed to actually
 * render a video track once the call turns the camera on. Dyte's core SDK
 * hands back raw WebRTC MediaStreamTrack objects; this is what paints them
 * to the screen. Same guarded-require pattern as everything else here.
 */
export function getWebRTC(): any | null {
  if (_webrtc === undefined) {
    _webrtc = safeRequire(
      () => require('@cloudflare/react-native-webrtc'),
      '@cloudflare/react-native-webrtc',
    );
  }
  return _webrtc;
}

/**
 * Whether this build can place and receive in-app calls at all.
 * The RealtimeKit SDK is the hard requirement — without it there is no audio.
 */
export function callingSupported(): boolean {
  return getRealtimeKit() !== null;
}

/**
 * Whether this build can ring while backgrounded or force-killed.
 * Needs CallKeep for the native call UI, plus PushKit (iOS) or FCM (Android)
 * to deliver the wake-up.
 */
export function backgroundRingingSupported(): boolean {
  if (!getCallKeep()) return false;
  return Platform.OS === 'ios' ? getVoipPush() !== null : getMessaging() !== null;
}

/** Human-readable reason calling is unavailable, for surfacing in the UI. */
export function callingUnavailableReason(): string | null {
  if (callingSupported()) return null;
  if (IS_EXPO_GO) {
    return 'In-app calling needs a development build — it cannot run in Expo Go.';
  }
  return 'In-app calling is not available in this build.';
}
