import React, { useState, useEffect, type ReactNode } from "react";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { PasswordInput } from "../ui/password-input";
import { RichDropdown } from "../ui/rich-dropdown";
import { StatusPill } from "../ui/status-pill";
import { INSET, PILL_BUTTON } from "../ui/surfaces";
import {
  AlertCircle,
  User as UserIcon,
  UserPlus,
  MapPin,
  Mail,
  Lock,
  Flag,
  KeyRound,
  ShieldOff,
  Send,
  History,
  Globe2,
  type LucideIcon,
} from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { cn } from "../../lib/utils";
import { useToast } from "../ui/toast";
import { PasswordStrengthMeter } from "../auth/PasswordStrengthMeter";
import { isPasswordAcceptable } from "../auth/password-policy";
import { ActivityFeed } from "../audit/ActivityFeed";
import { useAuthorization } from "../../hooks/useAuthorization";
import { Permission } from "../../lib/permissions";
import { titleCase } from "../../lib/labels";
import { Eyebrow, FieldLabel, IconTile } from "../settings/settings-ui";
import {
  getProvinces,
  getDistricts,
  getSectors,
  resolveProvinceName,
  resolveDistrictName,
} from "../../lib/rwanda-locations";

/** Small section heading inside the form. */
function FormSection({ icon: Icon, title, children, className }: { icon: LucideIcon; title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("min-w-0 space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
        <Eyebrow>{title}</Eyebrow>
      </div>
      {children}
    </section>
  );
}

/** Radio option as a selectable row: flat primary tint when chosen. */
function RadioOption({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl px-3.5 py-3 text-sm transition-colors",
        checked ? "bg-primary/[0.07] ring-1 ring-inset ring-primary/20" : cn(INSET, "hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.04]"),
      )}
    >
      <input type="radio" name="password-mode" checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
      <span className="min-w-0 text-foreground">{children}</span>
    </label>
  );
}

export interface UserLocation {
  province?: string;
  district?: string;
  sector?: string;
  schoolId?: string;
  schoolName?: string;
}

export interface ManagedRole {
  id: string;
  name: string;
  accessLevel?: { name?: string } | null;
}

/** A user row as returned by `GET /users`. */
export interface ManagedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  totpEnabled?: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
  role?: ManagedRole | null;
  location?: UserLocation | null;
}

interface SchoolOption {
  id: string;
  name: string;
  province?: string;
  district?: string;
}

interface UserFormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleId: string;
  location: UserLocation;
}

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingUser: ManagedUser | null;
  roles: ManagedRole[];
  schools: SchoolOption[];
}

export function UserFormModal({
  isOpen,
  onClose,
  onSuccess,
  editingUser,
  roles,
  schools,
}: UserFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // New accounts: email a set-password code (recommended) instead of an
  // admin-chosen password (WS10.4). Either way the user must pick their own.
  const [sendInvite, setSendInvite] = useState(true);
  const [actionBusy, setActionBusy] = useState<"" | "reset" | "mfa">("");
  const [confirmMfaReset, setConfirmMfaReset] = useState(false);
  const toast = useToast();
  const { isAuthorized } = useAuthorization();
  const canViewAudit = isAuthorized(Permission.VIEW_AUDIT_LOGS);
  const [formData, setFormData] = useState<UserFormState>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    roleId: roles.length > 0 ? roles[0].id : "",
    location: {},
  });

  useEffect(() => {
    if (isOpen) {
      if (editingUser) {
        setFormData({
          firstName: editingUser.firstName,
          lastName: editingUser.lastName,
          email: editingUser.email,
          password: "",
          roleId: editingUser.role?.id || (roles.length > 0 ? roles[0].id : ""),
          location: editingUser.location || {},
        });
      } else {
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          password: "",
          roleId: roles.length > 0 ? roles[0].id : "",
          location: {},
        });
      }
      setError("");
      setSendInvite(true);
    }
  }, [isOpen, editingUser, roles]);

  const sendReset = async () => {
    if (!editingUser) return;
    setActionBusy("reset");
    try {
      const { data } = await api.post<{ message: string; delivered: boolean }>(
        `/users/${editingUser.id}/send-reset`,
      );
      if (data.delivered) toast.success(data.message);
      else toast.warning("Email is disabled on this server; the code was written to the server log.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not send the reset code."));
    } finally {
      setActionBusy("");
    }
  };

  const resetMfa = async () => {
    if (!editingUser) return;
    setConfirmMfaReset(false);
    setActionBusy("mfa");
    try {
      await api.post(`/users/${editingUser.id}/2fa/reset`);
      toast.success(`Two-factor authentication reset for ${editingUser.firstName} ${editingUser.lastName}`.trim());
      onSuccess();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not reset two-factor."));
    } finally {
      setActionBusy("");
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const setLocation = (patch: Partial<UserLocation>) =>
    setFormData((prev) => ({
      ...prev,
      location: { ...prev.location, ...patch },
    }));

  const resetLocationFields = (level: "province" | "district" | "sector") => {
    setFormData((prev) => {
      const newLoc = { ...prev.location };
      if (level === "province") {
        delete newLoc.province;
        delete newLoc.district;
        delete newLoc.sector;
        delete newLoc.schoolId;
        delete newLoc.schoolName;
      }
      if (level === "district") {
        delete newLoc.district;
        delete newLoc.sector;
        delete newLoc.schoolId;
        delete newLoc.schoolName;
      }
      if (level === "sector") {
        delete newLoc.sector;
        delete newLoc.schoolId;
        delete newLoc.schoolName;
      }
      return { ...prev, location: newLoc };
    });
  };

  const getSelectedRoleAccessLevel = (roleId: string): string => {
    const role = roles.find((r) => r.id === roleId);
    return role?.accessLevel?.name?.toLowerCase() || "national";
  };

  const accessLevelName = getSelectedRoleAccessLevel(formData.roleId);

  const provinceOptions = getProvinces();
  const districtOptions = formData.location?.province
    ? getDistricts(formData.location.province)
    : [];
  const sectorOptions =
    formData.location?.province && formData.location?.district
      ? getSectors(formData.location.province, formData.location.district)
      : [];
  const schoolOptions = schools.filter((s) => {
    if (!formData.location?.province) return false;
    if (resolveProvinceName(s.province) !== formData.location.province) return false;
    if (
      formData.location?.district &&
      resolveDistrictName(s.district) !== formData.location.district
    )
      return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Only the fields the API accepts (it rejects unknown ones).
    const loc = formData.location ?? {};
    const location = Object.fromEntries(
      (["province", "district", "sector", "schoolId", "schoolName"] as const)
        .filter((k) => loc[k])
        .map((k) => [k, loc[k]]),
    );
    const base = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      ...(formData.roleId ? { roleId: formData.roleId } : {}),
      location,
    };

    const who = `${formData.firstName} ${formData.lastName}`.trim() || formData.email;
    try {
      if (editingUser) {
        // Edit flow — passwords are never set here (use "Send reset code").
        await api.patch(`/users/${editingUser.id}`, base);
        toast.success(`User "${who}" updated`);
      } else {
        if (!sendInvite && !isPasswordAcceptable(formData.password, formData.email)) {
          setError("The temporary password does not meet the password policy.");
          return;
        }
        const { data } = await api.post<{ inviteSent?: boolean }>(
          "/users",
          sendInvite ? base : { ...base, password: formData.password },
        );
        if (sendInvite && data.inviteSent)
          toast.success(`User "${who}" created. ${formData.email} was emailed a code to set their password.`);
        else if (sendInvite)
          toast.warning(`User "${who}" created, but the email could not be sent. Use “Send reset code” later.`);
        else
          toast.success(`User "${who}" created. They must change the temporary password at first sign-in.`);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, `Could not ${editingUser ? "update" : "create"} the user.`));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="sm:max-w-4xl"
      title={
        <span className="flex items-center gap-3">
          <IconTile icon={editingUser ? UserIcon : UserPlus} />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-lg font-semibold tracking-tight text-foreground">
              {editingUser ? "Edit user" : "Add user"}
            </span>
            <span className="text-xs font-normal text-muted-foreground/70">
              {editingUser ? "Details, role and scope" : "Details, sign-in, role and scope"}
            </span>
          </span>
        </span>
      }
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" className={cn(PILL_BUTTON.secondary, "w-full sm:w-auto")} onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="user-form"
            className={cn(PILL_BUTTON.primary, "w-full sm:w-auto")}
            disabled={loading}
            isLoading={loading}
          >
            {loading ? "Saving…" : editingUser ? "Save changes" : "Add user"}
          </Button>
        </div>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="@container space-y-6 py-2">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-3.5 py-3 text-sm font-normal text-destructive ring-1 ring-inset ring-destructive/20"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-x-8 gap-y-7 @3xl:grid-cols-2">
          <div className="min-w-0 space-y-7">
            <FormSection icon={UserIcon} title="Details">
              <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="user-first-name">First name</FieldLabel>
                  <Input
                    id="user-first-name"
                    name="firstName"
                    required
                    autoComplete="off"
                    placeholder="e.g. Jean"
                    value={formData.firstName}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="user-last-name">Last name</FieldLabel>
                  <Input
                    id="user-last-name"
                    name="lastName"
                    required
                    autoComplete="off"
                    placeholder="e.g. Claude"
                    value={formData.lastName}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="user-email" icon={Mail}>
                  Email
                </FieldLabel>
                <Input
                  id="user-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="off"
                  placeholder="name@rtb.gov.rw"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
            </FormSection>

            {editingUser ? (
              <FormSection icon={Lock} title="Sign-in and security">
                <div className={cn("space-y-3 rounded-2xl p-4", INSET)}>
                  <div className="flex flex-wrap gap-1.5">
                    {editingUser.totpEnabled ? (
                      <StatusPill tone="good">2FA on</StatusPill>
                    ) : (
                      <StatusPill tone="neutral">2FA off</StatusPill>
                    )}
                    {editingUser.mustChangePassword && <StatusPill tone="warn">Must change password</StatusPill>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className={PILL_BUTTON.small}
                      onClick={() => void sendReset()}
                      isLoading={actionBusy === "reset"}
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden /> Send reset code
                    </Button>
                    {editingUser.totpEnabled && (
                      <Button
                        type="button"
                        variant="outline"
                        className={PILL_BUTTON.small}
                        onClick={() => setConfirmMfaReset(true)}
                        isLoading={actionBusy === "mfa"}
                      >
                        <ShieldOff className="h-3.5 w-3.5" aria-hidden /> Reset 2FA
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Administrators never set passwords for existing users: the user receives a one-time code by email and
                    chooses their own.
                  </p>
                </div>
              </FormSection>
            ) : (
              <FormSection icon={KeyRound} title="First sign-in">
                <fieldset className="space-y-2">
                  <legend className="sr-only">Initial password</legend>
                  <RadioOption checked={sendInvite} onChange={() => setSendInvite(true)}>
                    Email a code to set their own password{" "}
                    <span className="text-muted-foreground">(recommended)</span>
                  </RadioOption>
                  <RadioOption checked={!sendInvite} onChange={() => setSendInvite(false)}>
                    Set a temporary password{" "}
                    <span className="text-muted-foreground">(changed at first sign-in)</span>
                  </RadioOption>
                  {!sendInvite && (
                    <div className="space-y-2 pt-2">
                      <FieldLabel htmlFor="user-temp-password">Temporary password</FieldLabel>
                      <PasswordInput
                        appearance="app"
                        id="user-temp-password"
                        name="password"
                        aria-label="Temporary password"
                        aria-describedby="new-user-password-rules"
                        autoComplete="new-password"
                        required
                        placeholder="••••••••••"
                        value={formData.password}
                        onChange={handleInputChange}
                      />
                      <PasswordStrengthMeter id="new-user-password-rules" password={formData.password} email={formData.email} />
                    </div>
                  )}
                </fieldset>
              </FormSection>
            )}
          </div>

          <FormSection icon={MapPin} title="Role and scope">
            <div className="space-y-1.5">
              <FieldLabel icon={Flag}>Role</FieldLabel>
              <RichDropdown
                value={formData.roleId}
                onChange={(val) => {
                  setFormData((prev) => ({
                    ...prev,
                    roleId: val,
                    location: {},
                  }));
                }}
                options={roles.map((r) => ({
                  value: r.id,
                  label: `${titleCase(r.name)} (${titleCase(r.accessLevel?.name || "National")})`,
                }))}
                placeholder="Choose a role"
                searchPlaceholder="Find a role"
              />
              <input type="hidden" name="roleId" value={formData.roleId} required />
            </div>

            {accessLevelName === "national" ? (
              <div className={cn("flex items-start gap-3 rounded-2xl p-4", INSET)}>
                <IconTile icon={Globe2} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">National scope</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">This role sees every school in the country.</p>
                </div>
              </div>
            ) : (
              <div className={cn("grid grid-cols-1 gap-4 rounded-2xl p-4 @md:grid-cols-2 @3xl:grid-cols-1", INSET)}>
                <div className="space-y-1.5">
                  <FieldLabel>Province</FieldLabel>
                  <RichDropdown
                    value={formData.location?.province || ""}
                    onChange={(val) => {
                      resetLocationFields("province");
                      setLocation({ province: val as string });
                    }}
                    options={provinceOptions.map((p) => ({
                      label: p,
                      value: p,
                    }))}
                    placeholder="Choose a province"
                  />
                </div>

                {(accessLevelName === "district" || accessLevelName === "sector" || accessLevelName === "school") && (
                  <div className="space-y-1.5">
                    <FieldLabel>District</FieldLabel>
                    <RichDropdown
                      value={formData.location?.district || ""}
                      onChange={(val) => {
                        resetLocationFields("district");
                        setLocation({ district: val as string });
                      }}
                      options={districtOptions.map((d: string) => ({
                        label: d,
                        value: d,
                      }))}
                      disabled={!formData.location?.province}
                      placeholder={formData.location?.province ? "Choose a district" : "Choose a province first"}
                    />
                  </div>
                )}

                {(accessLevelName === "sector" || accessLevelName === "school") && (
                  <div className="space-y-1.5">
                    <FieldLabel>Sector</FieldLabel>
                    <RichDropdown
                      value={formData.location?.sector || ""}
                      onChange={(val) => {
                        resetLocationFields("sector");
                        setLocation({ sector: val as string });
                      }}
                      options={sectorOptions.map((s: string) => ({
                        label: s,
                        value: s,
                      }))}
                      disabled={!formData.location?.district}
                      placeholder={formData.location?.district ? "Choose a sector" : "Choose a district first"}
                    />
                  </div>
                )}

                {accessLevelName === "school" && (
                  <div className="space-y-1.5">
                    <FieldLabel>School</FieldLabel>
                    <RichDropdown
                      value={formData.location?.schoolId || ""}
                      onChange={(val) => {
                        const id = val as string;
                        const school = schools.find((sc) => sc.id === id);
                        setLocation({
                          schoolId: id,
                          schoolName: school?.name || "",
                        });
                      }}
                      options={schoolOptions.map((s) => ({
                        label: s.name,
                        value: s.id,
                      }))}
                      disabled={!formData.location?.district}
                      placeholder={formData.location?.district ? "Choose a school" : "Choose a district first"}
                      searchPlaceholder="Find a school"
                    />
                  </div>
                )}
              </div>
            )}
          </FormSection>
        </div>

        {editingUser && canViewAudit && (
          <FormSection icon={History} title="Activity" className="border-t border-border/30 pt-6">
            <ActivityFeed filters={{ subjectUserId: editingUser.id }} pageSize={10} />
          </FormSection>
        )}
      </form>
      <Modal
        isOpen={confirmMfaReset}
        onClose={() => setConfirmMfaReset(false)}
        title="Reset two-factor authentication?"
        maxWidth="sm:max-w-md"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:justify-end">
            <Button variant="ghost" className={cn(PILL_BUTTON.secondary, "w-full sm:w-auto")} onClick={() => setConfirmMfaReset(false)}>
              Cancel
            </Button>
            <Button variant="destructive" className={cn(PILL_BUTTON.primary, "w-full sm:w-auto")} onClick={() => void resetMfa()}>
              Reset 2FA
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          {editingUser?.email} will be signed out of every device and must set up two-factor again at their next sign-in
          (if their role requires it). Only do this after verifying their identity.
        </p>
      </Modal>
    </Modal>
  );
}
