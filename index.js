// URL polyfill needed for Supabase on native only; web has native URL support
import { Platform } from 'react-native';
if (Platform.OS !== 'web') {
  require('react-native-url-polyfill/auto');
}
import 'expo-router/entry';
