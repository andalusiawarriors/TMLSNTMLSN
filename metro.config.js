const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

// When running from a git worktree the node_modules directory lives in the
// main repository root, not inside the worktree.  Walk up until we find it.
function findNodeModules(start) {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'node_modules');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(start, 'node_modules'); // fallback to local
}

const nodeModulesRoot = path.dirname(findNodeModules(__dirname));

const config = getDefaultConfig(__dirname);

// Teach Metro to watch the real node_modules directory when it differs from
// the worktree (e.g. main repo root is 3 levels above the worktree path).
if (nodeModulesRoot !== __dirname) {
  config.watchFolders = [
    ...(config.watchFolders ?? []),
    nodeModulesRoot,
  ];
}

const bodyHighlighterPath = path.join(
  nodeModulesRoot,
  'node_modules',
  'react-native-body-highlighter',
  'dist',
  'index.js',
);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-body-highlighter') {
    return { type: 'sourceFile', filePath: bodyHighlighterPath };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
