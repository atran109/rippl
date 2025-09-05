module.exports = function (api) {
  api.cache(true)
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    // Expo Go (SDK 53) bundles Reanimated 3.x; use its Babel plugin.
    // Keep this plugin as the last entry.
    plugins: ["react-native-reanimated/plugin"],
  }
}
