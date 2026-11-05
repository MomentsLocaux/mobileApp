const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  '@': path.resolve(__dirname, 'src'),
};

// The filter tests compile with Node16, which requires a .js suffix on
// relative imports. The source files are .ts. Metro must drop that suffix.
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const next = resolveRequest ?? context.resolveRequest;
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const rewritten = moduleName.slice(0, -3);
    const candidate = path.resolve(path.dirname(context.originModulePath), rewritten);
    const sourceExts = context.sourceExts ?? config.resolver.sourceExts ?? [];
    const hasSource = sourceExts.some((ext) => fs.existsSync(`${candidate}.${ext}`));
    if (hasSource) {
      return next(context, rewritten, platform);
    }
  }
  return next(context, moduleName, platform);
};

config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'css');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'css'];

module.exports = config;
