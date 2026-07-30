/**
 * Dynamic Expo config.
 *
 * This is a .js config rather than app.json because two of the plugins are
 * credential-dependent and *throw at prebuild time* when their files are
 * absent:
 *
 *   - @react-native-firebase/app requires google-services.json (Android) and
 *     GoogleService-Info.plist (iOS). Its plugin raises
 *     "Path to GoogleService-Info.plist is not defined" and the build dies.
 *
 * Rather than forcing every developer to hold a full set of production
 * credentials just to compile, the Firebase plugin is added only when the
 * files are actually on disk. Drop them in and Android call ringing lights up
 * on the next build with no config edit.
 *
 * CallKeep and the PushKit plugin need no credentials and are always applied,
 * so CallKit/ConnectionService and the `voip` background mode are present in
 * every build.
 */
const fs = require('fs');
const path = require('path');

const BUNDLE_ID = 'com.yantrammedtech.nurseconnect';

const GOOGLE_SERVICES_ANDROID = './google-services.json';
const GOOGLE_SERVICES_IOS = './GoogleService-Info.plist';

const exists = (p) => fs.existsSync(path.resolve(__dirname, p));

// Firebase needs BOTH files: its plugin configures each platform and throws on
// whichever is missing, so a half-configured project must not enable it.
const firebaseReady = exists(GOOGLE_SERVICES_ANDROID) && exists(GOOGLE_SERVICES_IOS);

if (!firebaseReady) {
  console.warn(
    '[app.config] Firebase credentials not found — Android call ringing will be ' +
    'disabled in this build. Add google-services.json and GoogleService-Info.plist ' +
    'to the app/ directory to enable it.',
  );
}

module.exports = () => ({
  expo: {
    name: 'NurseConnect',
    slug: 'frontend',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'nurseconnect',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,

    ios: {
      supportsTablet: true,
      bundleIdentifier: BUNDLE_ID,
      ...(firebaseReady ? { googleServicesFile: GOOGLE_SERVICES_IOS } : {}),
      infoPlist: {
        NSMicrophoneUsageDescription:
          'NurseConnect uses your microphone for voice calls between families and their care professional.',
        NSLocationWhenInUseUsageDescription:
          'NurseConnect uses your location to match you with nearby care and to confirm visit check-in.',
        NSPhotoLibraryUsageDescription:
          'NurseConnect needs photo access so you can upload verification documents and clinical photos.',
        NSCameraUsageDescription:
          'NurseConnect uses the camera to capture clinical documentation during a visit.',
        // `voip` is what makes iOS issue a PushKit token at all; `audio` keeps
        // a call alive when the screen locks.
        UIBackgroundModes: ['voip', 'audio', 'remote-notification'],
      },
      entitlements: {
        // Flip to "production" for TestFlight / App Store builds, and set
        // APNS_USE_SANDBOX=false on the backend to match — a token minted for
        // one environment is rejected by the other.
        'aps-environment': 'development',
      },
    },

    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#000',
      },
      edgeToEdgeEnabled: true,
      package: BUNDLE_ID,
      ...(firebaseReady ? { googleServicesFile: GOOGLE_SERVICES_ANDROID } : {}),
      permissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_MICROPHONE',
        // Required to raise the incoming-call screen over the lock screen.
        'android.permission.USE_FULL_SCREEN_INTENT',
        'android.permission.WAKE_LOCK',
      ],
    },

    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/images/favicon.png',
    },

    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-image.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#000',
        },
      ],
      'expo-font',
      // Only when credentials are present — see the note at the top.
      ...(firebaseReady ? ['@react-native-firebase/app'] : []),
      // CallKit (iOS) + ConnectionService (Android). No credentials needed.
      '@config-plugins/react-native-callkeep',
      // iOS PushKit wiring — see plugins/withVoipPush.js.
      './plugins/withVoipPush',
      [
        'expo-build-properties',
        {
          // react-native-firebase requires static frameworks on iOS.
          ios: { useFrameworks: 'static' },
          // CallKeep's ConnectionService needs API 24+.
          android: { minSdkVersion: 24 },
        },
      ],
    ],

    experiments: { typedRoutes: true },

    extra: {
      router: {},
      eas: { projectId: '1375e8db-cf00-4227-a082-3ebd02170b70' },
      firebaseConfigured: firebaseReady,
    },
  },
});
