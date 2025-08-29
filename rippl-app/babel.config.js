module.exports = function (api) {
  api.cache(true)
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    // Reanimated v4 moved its Babel plugin to react-native-worklets.
    // Ensure this plugin is last in the list.
    plugins: [
      "react-native-worklets/plugin"
    ],
  }
}
