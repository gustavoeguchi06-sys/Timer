// Plugin do Expo que torna o app compatível com Android TV / TV Box:
// - aparece no menu da TV (categoria LEANBACK_LAUNCHER + banner 320x180)
// - não exige tela de toque (a TV usa controle remoto)
const fs = require("fs");
const path = require("path");
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

function withTvManifest(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;

    manifest["uses-feature"] = manifest["uses-feature"] || [];
    for (const name of ["android.software.leanback", "android.hardware.touchscreen", "android.hardware.faketouch"]) {
      if (!manifest["uses-feature"].some((f) => f.$["android:name"] === name)) {
        manifest["uses-feature"].push({ $: { "android:name": name, "android:required": "false" } });
      }
    }

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    app.$["android:banner"] = "@drawable/tv_banner";

    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(c.modResults);
    const filters = activity["intent-filter"] || [];
    const main = filters.find((f) => (f.action || []).some((a) => a.$["android:name"] === "android.intent.action.MAIN"));
    if (main) {
      main.category = main.category || [];
      const tv = "android.intent.category.LEANBACK_LAUNCHER";
      if (!main.category.some((x) => x.$["android:name"] === tv)) main.category.push({ $: { "android:name": tv } });
    }
    return c;
  });
}

function withTvBanner(config) {
  return withDangerousMod(config, [
    "android",
    async (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, "app", "src", "main", "res", "drawable-xhdpi");
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(path.join(c.modRequest.projectRoot, "assets", "images", "tv-banner.png"), path.join(dir, "tv_banner.png"));
      return c;
    },
  ]);
}

module.exports = function withAndroidTV(config) {
  return withTvBanner(withTvManifest(config));
};
