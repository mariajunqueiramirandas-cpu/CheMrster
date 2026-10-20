// The app shares the web app's engine, course, tutor and stores (../src) instead of copying them.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const shared = path.resolve(__dirname, '..', 'src');
const config = getDefaultConfig(__dirname);

config.watchFolders = [shared];
// Packages imported by the shared code come from this app's node_modules, never the web app's,
// so there is one React (and one of everything else) in the bundle.
const here = path.join(__dirname, 'index.ts');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const bare = !moduleName.startsWith('.') && !path.isAbsolute(moduleName);
  if (bare && context.originModulePath.startsWith(shared + path.sep)) {
    return context.resolveRequest({ ...context, originModulePath: here }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
