/** Pure helpers for the profile page (kept apart for fast refresh and tests). */
import type { User } from "../../store/authStore";
import { titleCase } from "../../lib/labels";

/** The fields `PATCH /users/me/profile` accepts (email is admin-managed). */
export interface ProfileForm {
  firstName: string;
  lastName: string;
  phone: string;
  department: string;
}

export type ProfileField = keyof ProfileForm;

/** Server limits (UpdateProfileDto). */
export const PROFILE_LIMITS: Record<ProfileField, number> = {
  firstName: 100,
  lastName: 100,
  phone: 50,
  department: 150,
};

export function profileFormOf(user: User | null | undefined): ProfileForm {
  return {
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    phone: user?.phone ?? "",
    department: user?.department ?? "",
  };
}

/** Fields whose trimmed value differs from the saved one. */
export function changedFields(saved: ProfileForm, draft: ProfileForm): ProfileField[] {
  return (Object.keys(saved) as ProfileField[]).filter((k) => saved[k].trim() !== draft[k].trim());
}

export function validateProfile(f: ProfileForm): Partial<Record<ProfileField, string>> {
  const errors: Partial<Record<ProfileField, string>> = {};
  if (!f.firstName.trim()) errors.firstName = "First name is required";
  if (!f.lastName.trim()) errors.lastName = "Last name is required";
  if (f.phone.trim() && !/^\+?[\d\s()-]{7,}$/.test(f.phone.trim()))
    errors.phone = "Use digits only, e.g. +250 788 123 456";
  for (const k of Object.keys(PROFILE_LIMITS) as ProfileField[])
    if (!errors[k] && f[k].trim().length > PROFILE_LIMITS[k]) errors[k] = `At most ${PROFILE_LIMITS[k]} characters`;
  return errors;
}

/** Trimmed payload of the changed fields only. */
export function profilePatch(saved: ProfileForm, draft: ProfileForm): Partial<ProfileForm> {
  return Object.fromEntries(changedFields(saved, draft).map((k) => [k, draft[k].trim()]));
}

export function roleNameOf(user: User | null | undefined): string {
  const raw = typeof user?.role === "object" ? user?.role?.name : user?.role;
  return raw ? titleCase(raw) : "";
}

export function accessLevelOf(user: User | null | undefined): string | null {
  return typeof user?.role === "object" && user?.role ? user.role.accessLevel?.name ?? null : null;
}

/** The geographic area the account works in: school, sector, district or province. */
export function scopeLabelOf(user: User | null | undefined): string | null {
  const loc = user?.location;
  if (!loc) return null;
  if (loc.schoolName) return loc.schoolName;
  if (loc.sector) return `${loc.sector}, ${loc.district}`;
  if (loc.district) return `${loc.district}, ${loc.province}`;
  return loc.province ?? null;
}

export type ChecklistAction = "phone" | "department" | "security";

export interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  action: ChecklistAction | null;
}

/** Account setup steps, built from the saved profile only (never the draft). */
export function setupChecklist(user: User | null | undefined): ChecklistItem[] {
  return [
    {
      id: "name",
      label: "Full name",
      hint: "Shown on reports and audit records",
      done: !!(user?.firstName?.trim() && user?.lastName?.trim()),
      action: null,
    },
    {
      id: "phone",
      label: "Phone number",
      hint: "So the GIS team can reach you about reports",
      done: !!user?.phone?.trim(),
      action: "phone",
    },
    {
      id: "department",
      label: "Department",
      hint: "Helps colleagues route requests",
      done: !!user?.department?.trim(),
      action: "department",
    },
    {
      id: "mfa",
      label: "Two-factor authentication",
      hint: user?.mfaRequired ? "Required for your role" : "Protects your account if your password leaks",
      done: !!user?.totpEnabled,
      action: "security",
    },
  ];
}
