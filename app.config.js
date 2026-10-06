// Extends app.json. Everything lives there except the one thing that has to
// differ between the sideloaded build and the Google Play build.
//
// USE_EXACT_ALARM makes Android fire notifications at the exact minute we ask
// for. Without it, Doze batches them and several arrive at once. But Google
// Play restricts that permission to apps whose core purpose is alarms,
// calendars, or timers, declaring it on a quote app invites rejection.
//
// So: the sideloaded build keeps it, the Play build drops it. The Play build
// still declares SCHEDULE_EXACT_ALARM, which users can grant themselves under
// "Alarms & reminders" in the app's system settings.
const PLAY_RESTRICTED_PERMISSIONS = ["android.permission.USE_EXACT_ALARM"];

// CommonJS on purpose. Expo evaluates this file on its own servers before a
// GitHub-triggered build starts, and the ES module form (`export default`)
// in a package without "type": "module" is the one structural difference from
// a sibling project whose GitHub builds dispatch normally.
module.exports = ({ config }) => {
  const isPlayBuild = process.env.SHEETPOSO_PLAY_BUILD === "1";
  if (!isPlayBuild) return config;

  return {
    ...config,
    android: {
      ...config.android,
      permissions: (config.android?.permissions ?? []).filter(
        (permission) => !PLAY_RESTRICTED_PERMISSIONS.includes(permission)
      ),
    },
  };
};
