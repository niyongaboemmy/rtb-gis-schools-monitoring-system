/**
 * Pure permission-sync rules for the built-in roles (WS7.3).
 *
 * The seed used to overwrite every built-in role's permissions with the code
 * list, silently undoing whatever an administrator configured. Now each role
 * stores `seededPermissions`, the code list as of the last sync, and a sync:
 *   - adds only permissions that are new in code since that snapshot;
 *   - never removes a permission an admin granted;
 *   - never re-adds one an admin deliberately removed (it is already in the
 *     snapshot, so it is not "new");
 *   - leaves permissions dropped from code in place (an admin can remove them).
 *
 * With no snapshot (rows created before tracking existed) the old seed had
 * overwritten the role on every run, so the stored list is effectively the
 * previous code list: the baseline is the stored permissions, and missing
 * code permissions are added once.
 */
export interface RoleSyncPlan {
  permissions: string[];
  seededPermissions: string[];
  added: string[];
  changed: boolean;
}

export function planRolePermissionSync(
  current: readonly string[] | null | undefined,
  seeded: readonly string[] | null | undefined,
  code: readonly string[],
): RoleSyncPlan {
  const currentList = [...(current ?? [])];
  const baseline = new Set(seeded ?? currentList);
  const have = new Set(currentList);

  const added = code.filter((p) => !baseline.has(p) && !have.has(p));
  const permissions = [...currentList, ...added];
  const seededPermissions = [...code];

  const snapshotChanged =
    !seeded ||
    seeded.length !== code.length ||
    seeded.some((p, i) => p !== code[i]);

  return {
    permissions,
    seededPermissions,
    added,
    changed: added.length > 0 || snapshotChanged,
  };
}
