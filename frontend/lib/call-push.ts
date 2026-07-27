/**
 * Push wiring for incoming calls.
 *
 * Three delivery paths, in order of how much of the app has to be alive:
 *
 *   WebSocket  — app open. Handled in the store's realtime handler.
 *   PushKit    — iOS, app backgrounded OR force-killed. The only mechanism
 *                Apple provides that can ring a killed app.
 *   FCM data   — Android, app backgrounded OR swiped away. Must be data-only
 *                and high priority (see the backend's send_call_push).
 *
 * The iOS constraint that drives the code below: on receiving a PushKit push
 * the app must report a call to CallKit *immediately*. iOS kills apps that
 * don't, and repeat offenders lose VoIP push entirely. So the handler calls
 * `reportIncomingCall` first and does nothing slow before it.
 */
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { callManager } from './call-manager';
import { callsService, type IncomingCallPayload } from '../services/calls.service';
import { getCallKeep, getMessaging, getVoipPush, IS_EXPO_GO } from './native-modules';

let registered = false;
let cachedDeviceId: string | null = null;
let fcmToken: string | null = null;
let voipToken: string | null = null;

/** Stable per-install id, so re-registering updates rather than duplicates. */
async function deviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  let id: string | null = null;
  try {
    id =
      Platform.OS === 'android'
        ? Application.getAndroidId()
        : await Application.getIosIdForVendorAsync();
  } catch {
    id = null;
  }
  cachedDeviceId = id || `unknown-${Platform.OS}`;
  return cachedDeviceId;
}

function coerceCallPayload(raw: any): IncomingCallPayload | null {
  if (!raw) return null;
  // FCM data values always arrive as strings; PushKit gives the JSON as sent.
  const booking_id = raw.booking_id ?? raw.bookingId;
  const call_session_id = raw.call_session_id ?? raw.callSessionId;
  if (raw.type !== 'incoming_call' || !booking_id || !call_session_id) return null;
  return {
    type: 'incoming_call',
    booking_id: String(booking_id),
    call_session_id: String(call_session_id),
    dyte_meeting_id: String(raw.dyte_meeting_id ?? raw.dyteMeetingId ?? ''),
    caller_name: String(raw.caller_name ?? raw.callerName ?? 'NurseConnect'),
  };
}

/**
 * Send whatever tokens we have to the backend. Called after each token
 * arrives, because iOS delivers the FCM and PushKit tokens independently and
 * we want the device ringable as soon as either lands.
 */
async function syncTokens(): Promise<void> {
  if (!fcmToken && !voipToken) return;
  try {
    await callsService.registerDevice({
      device_id: await deviceId(),
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      fcm_token: fcmToken ?? undefined,
      apns_voip_token: voipToken ?? undefined,
    });
  } catch (e) {
    // Not fatal: the user can still be reached over WebSocket while the app
    // is open, and registration retries on the next sign-in.
    console.warn('[calls] device registration failed:', (e as Error)?.message);
  }
}

/**
 * Wire up push listeners and register this device.
 * Call once after sign-in. No-ops in Expo Go and on builds without the
 * native modules.
 */
export async function registerForCallPush(): Promise<void> {
  if (registered || IS_EXPO_GO) return;
  registered = true;

  await callManager.setup();

  // ------------------------------------------------------------- iOS ----
  const VoipPush = getVoipPush();
  if (VoipPush) {
    VoipPush.addEventListener('register', (token: string) => {
      voipToken = token;
      syncTokens();
    });

    VoipPush.addEventListener('notification', (notification: any) => {
      const payload = coerceCallPayload(notification);
      if (!payload) return;
      // FIRST, before anything async — see the module docstring.
      callManager.reportIncomingCall(payload);
    });

    // Fired for a push that arrived while the app was killed and caused the
    // launch. Without handling this the call would be lost on cold start.
    VoipPush.addEventListener('didLoadWithEvents', (events: any[]) => {
      for (const event of events || []) {
        if (event?.name === 'RNVoipPushRemoteNotificationReceivedEvent') {
          const payload = coerceCallPayload(event.data);
          if (payload) callManager.reportIncomingCall(payload);
        }
      }
    });

    VoipPush.registerVoipToken();
  }

  // --------------------------------------------------------- Android ----
  const messaging = getMessaging();
  if (messaging) {
    try {
      const authStatus = await messaging().requestPermission();
      // 1 = AUTHORIZED, 2 = PROVISIONAL
      if (authStatus === 1 || authStatus === 2 || Platform.OS === 'android') {
        fcmToken = await messaging().getToken();
        await syncTokens();
      }
      // Tokens rotate on reinstall/restore — a stale one silently swallows
      // every future ring, so keep it fresh.
      messaging().onTokenRefresh((token: string) => {
        fcmToken = token;
        syncTokens();
      });
      // Foreground data message (app open but not on a call screen).
      messaging().onMessage((message: any) => {
        const payload = coerceCallPayload(message?.data);
        if (payload) callManager.reportIncomingCall(payload);
      });
    } catch (e) {
      console.warn('[calls] FCM setup failed:', (e as Error)?.message);
    }
  }
}

/**
 * Background/killed FCM handler.
 *
 * Must be registered at module scope in the app entry point, NOT inside a
 * component — Firebase requires the handler to exist before React mounts,
 * because on a cold start triggered by a push there is no React yet.
 */
export function registerBackgroundCallHandler(): void {
  if (IS_EXPO_GO) return;
  const messaging = getMessaging();
  if (!messaging) return;
  try {
    messaging().setBackgroundMessageHandler(async (message: any) => {
      const payload = coerceCallPayload(message?.data);
      if (!payload) return;
      await callManager.setup();
      callManager.reportIncomingCall(payload);
    });
  } catch (e) {
    console.warn('[calls] background handler registration failed:', (e as Error)?.message);
  }
}

/** Stop this device ringing for the account being signed out. */
export async function unregisterFromCallPush(): Promise<void> {
  if (IS_EXPO_GO) return;
  try {
    await callsService.unregisterDevice(await deviceId());
  } catch {
    // Sign-out must never be blocked by push cleanup.
  }
  try {
    getCallKeep()?.setAvailable(false);
  } catch {
    // Not set up on this build.
  }
  fcmToken = null;
  voipToken = null;
  registered = false;
}
