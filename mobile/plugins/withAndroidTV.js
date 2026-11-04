// Plugin do Expo que torna o app compatível com Android TV / TV Box:
// - aparece no menu da TV (categoria LEANBACK_LAUNCHER + banner 320x180)
// - não exige tela de toque (a TV usa controle remoto)
const fs = require("fs");
const path = require("path");
const { AndroidConfig, withAndroidManifest, withDangerousMod, withMainActivity } = require("expo/config-plugins");

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

// Repassa as teclas (setas, OK, play/pause, avançar...) para o JavaScript como evento "ctmaxKey".
// Funciona em qualquer aparelho, inclusive TV Box que não se identifica como Android TV,
// e não depende de qual botão está com o foco.
const KEY_METHOD = `
  // CT MAX TIMER: repassa as teclas do controle remoto para o JavaScript
  override fun dispatchKeyEvent(event: android.view.KeyEvent): Boolean {
    try {
      if (event.action == android.view.KeyEvent.ACTION_DOWN) {
        val ctx = (application as com.facebook.react.ReactApplication).reactHost?.currentReactContext
        if (ctx != null && ctx.hasActiveReactInstance()) {
          val map = com.facebook.react.bridge.Arguments.createMap()
          map.putInt("keyCode", event.keyCode)
          map.putInt("repeat", event.repeatCount)
          ctx.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)?.emit("ctmaxKey", map)
        }
      }
    } catch (e: Throwable) {
    }
    return super.dispatchKeyEvent(event)
  }
`;

function withKeyEvents(config) {
  return withMainActivity(config, (c) => {
    let src = c.modResults.contents;
    if (c.modResults.language !== "kt") throw new Error("withAndroidTV: MainActivity precisa ser Kotlin");
    if (!src.includes("ctmaxKey")) {
      const re = /class MainActivity\s*:\s*ReactActivity\(\)\s*\{/;
      if (!re.test(src)) throw new Error("withAndroidTV: não encontrei a classe MainActivity");
      src = src.replace(re, (m) => m + "\n" + KEY_METHOD);
    }
    c.modResults.contents = src;
    return c;
  });
}

module.exports = function withAndroidTV(config) {
  return withKeyEvents(withTvBanner(withTvManifest(config)));
};
