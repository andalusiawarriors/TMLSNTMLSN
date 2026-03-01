// URL polyfill needed for Supabase on native only; web has native URL support
import { Platform } from 'react-native';
if (Platform.OS !== 'web') {
  require('react-native-url-polyfill/auto');
}
// Reanimated: disable strict mode to avoid ref-in-worklet and .value-during-render warnings
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });
import 'expo-router/entry';
