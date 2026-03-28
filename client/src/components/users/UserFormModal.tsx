import React, { useState, useEffect } from "react";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { RichDropdown } from "../ui/rich-dropdown";
import {
  AlertCircle,
  User as UserIcon,
  MapPin,
  Mail,
  Lock,
  Flag,
  Loader2,
} from "lucide-react";
import { api } from "../../lib/api";
import {
  getProvinces,
  getDistricts,
  getSectors,
  resolveProvinceName,
  resolveDistrictName,
} from "../../lib/rwanda-locations";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingUser: any | null;
  roles: any[];
  schools: any[];
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
  const [formData, setFormData] = useState<any>({
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
    }
  }, [isOpen, editingUser, roles]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const setLocation = (patch: Record<string, string>) =>
    setFormData((prev: any) => ({
      ...prev,
      location: { ...prev.location, ...patch },
    }));

  const resetLocationFields = (level: "province" | "district" | "sector") => {
    setFormData((prev: any) => {
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
    const role = roles.find((r: any) => r.id === roleId);
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
  const schoolOptions = schools.filter((s: any) => {
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

    try {
      if (editingUser) {
        // Edit flow
        const payload = { ...formData };
        if (!payload.password) delete payload.password; // Don't update password if empty
        await api.patch(`/users/${editingUser.id}`, payload);
      } else {
        // Create flow
        await api.post("/users", formData);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          `Failed to ${editingUser ? "update" : "create"} identity`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-5xl"
      title={
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <UserIcon className="w-6 h-6 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground">
              {editingUser ? "Edit Identity" : "New Identity Registration"}
            </span>
            <span className="text-xs md:text-sm font-medium tracking-normal normal-case text-muted-foreground">
              {editingUser
                ? "Modify credentials and access scope"
                : "Provision a new authorized personnel record"}
            </span>
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse sm:flex-row w-full sm:w-auto sm:justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto h-11 px-8 rounded-full dark:bg-gray-900 shadow-none font-bold"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="user-form"
            className="w-full sm:w-auto h-11 px-8 rounded-full shadow-none font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Processing...
              </>
            ) : editingUser ? (
              "Update Identity"
            ) : (
              "Confirm Record"
            )}
          </Button>
        </div>
      }
    >
      <form
        id="user-form"
        onSubmit={handleSubmit}
        className="space-y-6 pt-2 mb-12"
      >
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-10 pb-12 mb-12">
          {/* COLUMN 1: Identity & Credentials */}
          <div className="space-y-5">
            <h4 className="text-[14px] font-black text-foreground uppercase tracking-widest flex items-center gap-2 border-b border-border/40 pb-3">
              <UserIcon className="w-4 h-4 text-primary" /> Core Profile
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1">
                  First Name
                </label>
                <Input
                  name="firstName"
                  required
                  className="h-11 rounded-xl bg-muted/40 border-border"
                  placeholder="e.g. Jean"
                  value={formData.firstName}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1">
                  Last Name
                </label>
                <Input
                  name="lastName"
                  required
                  className="h-11 rounded-xl bg-muted/40 border-border"
                  placeholder="e.g. Claude"
                  value={formData.lastName}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1 flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> Email Address
              </label>
              <Input
                name="email"
                type="email"
                required
                className="h-11 rounded-xl bg-muted/40 border-border"
                placeholder="official@rtb.gov.rw"
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1 flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Password
              </label>
              <Input
                name="password"
                type="password"
                required={!editingUser}
                className="h-11 rounded-xl bg-muted/40 border-border"
                placeholder={
                  editingUser ? "Leave blank to keep unchanged" : "••••••••"
                }
                value={formData.password}
                onChange={handleInputChange}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1 flex items-center gap-1.5">
                <Flag className="w-3 h-3" /> Assigned Clearance Role
              </label>
              <RichDropdown
                value={formData.roleId}
                onChange={(val) => {
                  setFormData((prev: any) => ({
                    ...prev,
                    roleId: val,
                    location: {},
                  }));
                }}
                options={roles.map((r: any) => ({
                  value: r.id,
                  label: `${r.name.replace("_", " ").toUpperCase()} (${r.accessLevel?.name || "National"})`,
                }))}
                placeholder="Select authorization level..."
                className="h-11"
              />
              <input
                type="hidden"
                name="roleId"
                value={formData.roleId}
                required
              />
            </div>
          </div>

          {/* COLUMN 2: Location Scope */}
          <div className="space-y-5">
            <h4 className="text-[14px] font-black text-foreground uppercase tracking-widest flex items-center gap-2 border-b border-border/40 pb-3">
              <MapPin className="w-4 h-4 text-primary" /> Scope Constraints
            </h4>

            {accessLevelName === "national" ? (
              <div className="h-[200px] md:h-[280px] rounded-2xl border-2 border-dashed border-border/40 bg-muted/20 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Flag className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                </div>
                <div className="font-bold text-base md:text-lg tracking-tight text-foreground">
                  National Jurisdiction
                </div>
                <div className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-widest max-w-[80%]">
                  Agent has unrestricted geographic footprint.
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-4 h-full">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">
                    Province Constraint
                  </label>
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
                    placeholder="Lock to a province..."
                    className="h-11"
                  />
                </div>

                {(accessLevelName === "district" ||
                  accessLevelName === "sector" ||
                  accessLevelName === "school") && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">
                      District Constraint
                    </label>
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
                      placeholder="Lock to a district..."
                      className="h-11 disabled:opacity-50"
                    />
                  </div>
                )}

                {(accessLevelName === "sector" ||
                  accessLevelName === "school") && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">
                      Sector Constraint
                    </label>
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
                      placeholder="Lock to a sector..."
                      className="h-11 disabled:opacity-50"
                    />
                  </div>
                )}

                {accessLevelName === "school" && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">
                      Target Facility
                    </label>
                    <RichDropdown
                      value={formData.location?.schoolId || ""}
                      onChange={(val) => {
                        const id = val as string;
                        const school = schools.find((sc: any) => sc.id === id);
                        setLocation({
                          schoolId: id,
                          schoolName: school?.name || "",
                        });
                      }}
                      options={schoolOptions.map((s: any) => ({
                        label: s.name,
                        value: s.id,
                      }))}
                      disabled={!formData.location?.district}
                      placeholder="Enforce facility perimeter..."
                      className="h-11 disabled:opacity-50"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
