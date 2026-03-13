/**
 * Current user ID for user-scoped AsyncStorage keys.
 * Set by AuthContext on login/logout. Zero dependencies to avoid circular imports.
 */
let _storageUserId: string | null = null;

export function setStorageUserId(userId: string | null): void {
  _storageUserId = userId;
}

export function getStorageUserId(): string | null {
  return _storageUserId;
}
