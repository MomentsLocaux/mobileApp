const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  '@': path.resolve(__dirname, 'src'),
};

config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'css');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'css'];

module.exports = config;
