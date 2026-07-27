/**
 * Expo config plugin for iOS PushKit (react-native-voip-push-notification).
 *
 * `react-native-voip-push-notification` ships no Expo plugin, so this wires it
 * up during prebuild. Three things are needed and none happen automatically:
 *
 *   1. `UIBackgroundModes` must include `voip` (and `audio`, so the call keeps
 *      running when the screen locks). Without `voip`, iOS refuses to hand the
 *      app a PushKit token at all — registerVoipToken() silently never fires.
 *
 *   2. The AppDelegate must register PKPushRegistry and forward its callbacks
 *      to RNVoipPushNotificationManager. Expo SDK 54 generates a *Swift*
 *      AppDelegate, so the library's Objective-C instructions don't apply
 *      as-written; the Swift equivalents are inserted below.
 *
 *   3. The `aps-environment` entitlement must be present. `expo-notifications`
 *      / EAS credentials normally add this, but it's asserted here so a build
 *      without them still gets it.
 *
 * NOTE: the AppDelegate edits are the one part that can only be validated by
 * an actual `expo prebuild` + Xcode build. If Expo changes its AppDelegate
 * template, the anchors below stop matching — the plugin fails loudly rather
 * than producing a silently broken build.
 */
const {
  withInfoPlist,
  withEntitlementsPlist,
  withAppDelegate,
  createRunOncePlugin,
} = require('@expo/config-plugins');

/** 1. Background modes — required for a PushKit token to ever be issued. */
const withVoipBackgroundModes = (config) =>
  withInfoPlist(config, (cfg) => {
    const modes = new Set(cfg.modResults.UIBackgroundModes || []);
    modes.add('voip');
    modes.add('audio');
    modes.add('remote-notification');
    cfg.modResults.UIBackgroundModes = Array.from(modes);
    return cfg;
  });

/** 3. APNs entitlement. */
const withApsEnvironment = (config) =>
  withEntitlementsPlist(config, (cfg) => {
    if (!cfg.modResults['aps-environment']) {
      cfg.modResults['aps-environment'] = 'development';
    }
    return cfg;
  });

/** 2. PushKit registration inside the Swift AppDelegate. */
const withVoipAppDelegate = (config) =>
  withAppDelegate(config, (cfg) => {
    const { language } = cfg.modResults;
    let src = cfg.modResults.contents;

    if (language !== 'swift') {
      throw new Error(
        '[withVoipPush] Expected a Swift AppDelegate (Expo SDK 54+). Got ' +
          `"${language}". Update this plugin before building, or PushKit will ` +
          'be silently absent from the build.',
      );
    }

    if (src.includes('RNVoipPushNotificationManager')) return cfg; // already applied

    // -- imports --------------------------------------------------------
    if (!src.includes('import PushKit')) {
      src = src.replace(/(import Expo\n)/, '$1import PushKit\n');
    }

    // -- PKPushRegistry setup, called from didFinishLaunching -----------
    const registerFn = `
  // ---- PushKit (VoIP) ------------------------------------------------
  // Registered at launch so a push that cold-starts the app is delivered.
  func voipRegistration() {
    let mainQueue = DispatchQueue.main
    let voipRegistry = PKPushRegistry(queue: mainQueue)
    voipRegistry.delegate = self
    voipRegistry.desiredPushTypes = [PKPushType.voIP]
  }
`;

    // Insert the helper + call it at the end of didFinishLaunching.
    const didFinishAnchor = /(func application\([\s\S]*?didFinishLaunchingWithOptions[\s\S]*?\{)/;
    if (!didFinishAnchor.test(src)) {
      throw new Error(
        '[withVoipPush] Could not find didFinishLaunchingWithOptions in the ' +
          'AppDelegate. The Expo template changed — update this plugin.',
      );
    }
    src = src.replace(didFinishAnchor, '$1\n    self.voipRegistration()\n');

    // -- PKPushRegistryDelegate conformance ------------------------------
    const delegateExtension = `
${registerFn}
// PushKit delegate. Every callback forwards to RNVoipPushNotificationManager,
// which surfaces them to JS. The JS handler MUST report the call to CallKit
// immediately — iOS terminates apps that receive a VoIP push without doing so,
// and repeat offenders lose VoIP push privileges entirely.
extension AppDelegate: PKPushRegistryDelegate {
  func pushRegistry(
    _ registry: PKPushRegistry,
    didUpdate pushCredentials: PKPushCredentials,
    for type: PKPushType
  ) {
    RNVoipPushNotificationManager.didUpdate(pushCredentials, forType: type.rawValue)
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didInvalidatePushTokenFor type: PKPushType
  ) {
    // Token revoked — the backend prunes it on the next failed send.
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    RNVoipPushNotificationManager.didReceiveIncomingPush(with: payload, forType: type.rawValue)
    RNVoipPushNotificationManager.addCompletionHandler(
      payload.dictionaryPayload["call_session_id"] as? String ?? UUID().uuidString,
      completionHandler: completion
    )
  }
}
`;
    src = src.trimEnd() + '\n' + delegateExtension;

    cfg.modResults.contents = src;
    return cfg;
  });

const withVoipPush = (config) => {
  config = withVoipBackgroundModes(config);
  config = withApsEnvironment(config);
  config = withVoipAppDelegate(config);
  return config;
};

module.exports = createRunOncePlugin(withVoipPush, 'withVoipPush', '1.0.0');
