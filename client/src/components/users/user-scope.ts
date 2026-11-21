import type { UserLocation } from "./UserFormModal";

/**
 * What a role's access level still needs from the area fields, or null when
 * the area is complete. A scoped role without its place would see nothing.
 */
export function missingScopeField(accessLevel: string, location: UserLocation): string | null {
  const need: [keyof UserLocation, string, string[]][] = [
    ["province", "a province", ["province", "district", "sector", "school"]],
    ["district", "a district", ["district", "sector", "school"]],
    ["sector", "a sector", ["sector", "school"]],
    ["schoolId", "a school", ["school"]],
  ];
  for (const [field, label, levels] of need)
    if (levels.includes(accessLevel) && !location[field]) return `Choose ${label} for this role.`;
  return null;
}
