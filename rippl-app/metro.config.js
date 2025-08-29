const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Configure for web compatibility
config.resolver.platforms = ["ios", "android", "native", "web"];

module.exports = withNativeWind(config, { 
  input: "./global.css",
  inlineRem: 16
});