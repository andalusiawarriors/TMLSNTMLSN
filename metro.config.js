const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const bodyHighlighterPath = path.resolve(__dirname, 'node_modules/react-native-body-highlighter/dist/index.js');
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-body-highlighter') {
    return { type: 'sourceFile', filePath: bodyHighlighterPath };
  }
  return defaultResolveRequest ? defaultResolveRequest(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
