/** Leftover keys from the pre-API Permission Matrix mock (safe to remove). */
const LEGACY_RBAC_STORAGE_KEYS = ['lms_rbac_matrix', 'lms_rbac_audit'] as const;

export function clearLegacyRbacStorage(): void {
  for (const key of LEGACY_RBAC_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}
