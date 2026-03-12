/** Defines globals required when running tests under Node/tsx (no React Native runtime). */
(global as unknown as { __DEV__?: boolean }).__DEV__ = false;
