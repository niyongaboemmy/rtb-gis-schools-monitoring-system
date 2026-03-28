import React, { useState, useEffect, useRef } from "react";
import { api } from "../../lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Modal } from "../ui/modal";
import { RichDropdown } from "../ui/rich-dropdown";
import {
  Shield,
  Plus,
  Trash2,
  ChevronRight,
  Layers,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";
import { Permission } from "../../lib/permissions";

export function RolesTab() {
  const [roles, setRoles] = useState<any[]>([]);
  const [accessLevels, setAccessLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedRole, setSelectedRole] = useState<any | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleFormData, setRoleFormData] = useState({
    name: "",
    description: "",
    accessLevelId: "",
  });

  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>(
    {},
  );
  const setAL = (key: string, val: boolean) =>
    setActionLoading((prev) => ({ ...prev, [key]: val }));
  const isAL = (key: string) => actionLoading[key] === true;

  const fetchPromise = useRef<Promise<any> | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    if (fetchPromise.current) return fetchPromise.current;
    setLoading(true);
    
    fetchPromise.current = Promise.all([
      api.get("/roles"),
      api.get("/access-levels"),
    ]).then(([rolesRes, levelsRes]) => {
      const rolesData = rolesRes.data;
      setRoles(rolesData);
      setAccessLevels(levelsRes.data);
      if (rolesData.length > 0 && !selectedRole) {
        setSelectedRole(rolesData[0]);
      }
    }).catch(err => {
      console.error("Failed to load roles data", err);
    }).finally(() => {
      setLoading(false);
      fetchPromise.current = null;
    });

    return fetchPromise.current;
  };

  const handleRoleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setRoleFormData({ ...roleFormData, [e.target.name]: e.target.value });
  };

  const handleTogglePermission = async (
    role: any,
    permissionLabel: string,
    checked: boolean,
  ) => {
    if (role.name === "super_admin") return;
    const key = `perm-${role.id}-${permissionLabel}`;
    setAL(key, true);

    const updatedPermissions = checked
      ? [...role.permissions, permissionLabel]
      : role.permissions.filter((p: string) => p !== permissionLabel);

    const updatedRole = { ...role, permissions: updatedPermissions };
    setSelectedRole(updatedRole);
    setRoles(roles.map((r) => (r.id === role.id ? updatedRole : r)));

    try {
      await api.patch(`/roles/${role.id}`, { permissions: updatedPermissions });
    } catch (err) {
      console.error("Failed to update role permissions", err);
      setSelectedRole(role); // Revert on failure
      fetchInitialData();
    } finally {
      setAL(key, false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError("");
    try {
      const payload = { ...roleFormData, permissions: [] };
      const res = await api.post("/roles", payload);
      setIsRoleModalOpen(false);
      setRoleFormData({ name: "", description: "", accessLevelId: "" });
      await fetchInitialData();
      setSelectedRole(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create role");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleRoleAccessLevelChange = async (
    roleId: string,
    accessLevelId: string,
  ) => {
    const key = `role-al-${roleId}`;
    setAL(key, true);
    try {
      const res = await api.patch(`/roles/${roleId}`, { accessLevelId });
      setRoles((prev) => prev.map((r) => (r.id === roleId ? res.data : r)));
      if (selectedRole?.id === roleId) setSelectedRole(res.data);
    } catch (err) {
      console.error("Failed to update role access level", err);
    } finally {
      setAL(key, false);
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete this role? This might break users assigned to it.`,
      )
    )
      return;
    const key = `del-role-${id}`;
    setAL(key, true);
    try {
      await api.delete(`/roles/${id}`);
      setSelectedRole(roles[0]);
      fetchInitialData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete role");
    } finally {
      setAL(key, false);
    }
  };

  const getPermissionDescription = (p: string) => {
    switch (p) {
      case "VIEW_DASHBOARD":
        return "Access the main system dashboard and top-level summaries";
      case "VIEW_MAP":
        return "View the interactive National GIS Map and 3D plotting";
      case "VIEW_SCHOOLS":
        return "Access the global directory and listing of TVET schools";
      case "MANAGE_USERS":
        return "Create, update, and manage system users and roles";
      case "VIEW_USERS":
        return "Read-only access to view the user directory";
      case "MANAGE_SCHOOLS":
        return "Add, edit, or delete school records";
      case "UPLOAD_KMZ":
        return "Upload and trigger geospatial data processing (KMZ)";
      case "VIEW_ANALYTICS":
        return "Access standard reporting and analytics dashboards";
      case "MANAGE_DECISIONS":
        return "Re-run priority algorithms and modify assessment weights";
      case "EXPORT_REPORTS":
        return "Export data tables and comprehensive system reports";
      default:
        return "System permission";
    }
  };

  if (loading && roles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 opacity-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Loading Authority Configurations...
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-8"
    >
      {/* Roles Navigation Sidebar */}
      <div className="lg:col-span-4 space-y-1">
        <div className="px-2 pb-2">
          <h3 className="text-sm font-normal text-muted-foreground/50">
            System Authorities
          </h3>
        </div>
        {roles.map((role) => (
          <button
            key={role.id}
            onClick={() => setSelectedRole(role)}
            className={cn(
              "w-full flex items-center justify-between p-3.5 rounded-2xl transition-all duration-300 group relative",
              selectedRole?.id === role.id
                ? "bg-primary text-white"
                : "bg-card/40 backdrop-blur-md border border-border/40 hover:bg-card/60 hover:translate-x-1",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors font-black text-xs",
                  selectedRole?.id === role.id
                    ? "bg-white/20"
                    : "bg-primary/10 text-primary",
                )}
              >
                {role.name[0].toUpperCase()}
              </div>
              <div className="text-left">
                <div className="font-bold text-xs uppercase tracking-wider">
                  {role.name.replace("_", " ")}
                </div>
                <div
                  className={cn(
                    "text-[9px] font-medium",
                    selectedRole?.id === role.id
                      ? "text-white/70"
                      : "text-muted-foreground",
                  )}
                >
                  {role.usersCount || 0} users
                </div>
              </div>
            </div>
            <ChevronRight
              className={cn(
                "w-4 h-4 transition-transform",
                selectedRole?.id === role.id
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100",
              )}
            />
          </button>
        ))}

        <Button
          variant="outline"
          className="w-full h-12 rounded-xl border-dashed border-2 hover:border-primary hover:bg-primary/5 text-primary text-xs font-bold transition-all mt-2"
          onClick={() => setIsRoleModalOpen(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-2" /> New Authority
        </Button>
      </div>

      {/* Permissions Configuration Area */}
      <div className="lg:col-span-8">
        <AnimatePresence mode="wait">
          {selectedRole ? (
            <motion.div
              key={selectedRole.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <Card className="border border-border/20 bg-card/60 backdrop-blur-xl rounded-2xl overflow-hidden">
                <CardHeader className="p-6 border-b border-border/40 bg-linear-to-r from-primary/6 to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                        {selectedRole.name.replace("_", " ")}
                        <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 text-[9px] px-2 py-0">
                          Active
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs font-medium">
                        {selectedRole.description || "Standard tactical scope."}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl h-8 px-3 border-destructive/20 text-destructive text-[10px] uppercase font-bold hover:bg-destructive/5"
                        onClick={() => handleDeleteRole(selectedRole.id)}
                        disabled={
                          ["super_admin", "admin", "viewer"].includes(
                            selectedRole.name,
                          ) || isAL(`del-role-${selectedRole.id}`)
                        }
                      >
                        {isAL(`del-role-${selectedRole.id}`) ? (
                          <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3 mr-1.5" />
                        )}
                        Dissolve
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Access Level Row */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/20">
                    <div className="flex items-center gap-2">
                      {isAL(`role-al-${selectedRole.id}`) && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      )}
                      <Layers className="w-3.5 h-3.5 text-muted-foreground/60" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                        Access Level
                      </span>
                    </div>
                    <select
                      value={selectedRole.accessLevel?.id || ""}
                      onChange={(e) =>
                        handleRoleAccessLevelChange(
                          selectedRole.id,
                          e.target.value,
                        )
                      }
                      required
                      disabled={isAL(`role-al-${selectedRole.id}`)}
                      className="text-[10px] font-black uppercase tracking-wide bg-primary/10 text-primary border border-primary/20 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="" disabled>
                        Select level...
                      </option>
                      {accessLevels.map((al) => (
                        <option key={al.id} value={al.id}>
                          {al.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between px-2">
                    <h4 className="text-xs font-black tracking-widest text-muted-foreground/60">
                      Tactical Permissions Matrix
                    </h4>
                    <div className="text-[10px] font-bold text-primary/60 italic">
                      Live configuration
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.values(Permission).map((permission) => {
                      const hasPermission =
                        selectedRole.permissions?.includes(permission);
                      return (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          key={permission}
                          onClick={() =>
                            handleTogglePermission(
                              selectedRole,
                              permission,
                              !hasPermission,
                            )
                          }
                          className={cn(
                            "flex items-start gap-3 p-4 rounded-xl border transition-all text-left group",
                            hasPermission
                              ? "bg-primary/10 border-primary/30"
                              : "bg-muted/10 border-border/40 hover:bg-muted/20",
                            isAL(`perm-${selectedRole.id}-${permission}`) &&
                              "opacity-60",
                          )}
                          disabled={
                            selectedRole.name === "super_admin" ||
                            isAL(`perm-${selectedRole.id}-${permission}`)
                          }
                        >
                          <div
                            className={cn(
                              "w-5 h-5 rounded-lg flex items-center justify-center transition-colors mt-0.5",
                              hasPermission
                                ? "bg-primary text-white"
                                : "bg-muted-foreground/10 text-muted-foreground",
                            )}
                          >
                            {isAL(`perm-${selectedRole.id}-${permission}`) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : hasPermission ? (
                              <Plus className="w-3 h-3 rotate-45" />
                            ) : (
                              <Shield className="w-3 h-3" />
                            )}
                          </div>
                          <div className="space-y-0.5">
                            <div
                              className={cn(
                                "text-xs font-black uppercase tracking-wide",
                                hasPermission
                                  ? "text-primary"
                                  : "text-muted-foreground",
                              )}
                            >
                              {permission.replace("_", " ")}
                            </div>
                            <p className="text-[9px] font-medium leading-tight text-muted-foreground/60">
                              {getPermissionDescription(permission)}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="h-[500px] flex items-center justify-center border-2 border-dashed border-border/40 rounded-3xl bg-muted/5">
              <div className="text-center space-y-3 opacity-40">
                <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-bold text-sm tracking-widest uppercase">
                  Select an authority to inspect
                </p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        maxWidth="max-w-sm"
        className="bg-card border-border/20"
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold uppercase tracking-tight text-foreground">
                New Authority
              </span>
              <span className="text-[10px] font-medium tracking-normal normal-case text-muted-foreground">
                Define tactical access level
              </span>
            </div>
          </div>
        }
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsRoleModalOpen(false)}
              className="font-bold text-[14px] h-9 rounded-full"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="addRoleForm"
              className="px-6 h-10 rounded-full text-[14px] tracking-wide"
              disabled={submitLoading}
            >
              {submitLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Forging...
                </>
              ) : (
                "Register Role"
              )}
            </Button>
          </>
        }
      >
        <form
          id="addRoleForm"
          onSubmit={handleCreateRole}
          className="space-y-6 pb-2"
        >
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
              Authority Identifier
            </label>
            <Input
              name="name"
              required
              value={roleFormData.name}
              onChange={handleRoleInputChange}
              className="h-10 rounded-xl bg-muted/30 border-border/20 focus:ring-primary/10 text-sm"
              placeholder="e.g. coordinator"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
              Access Level <span className="text-destructive">*</span>
            </label>
            <RichDropdown
              options={accessLevels.map((al) => ({
                label: al.name,
                value: al.id,
              }))}
              value={roleFormData.accessLevelId}
              onChange={(val) =>
                setRoleFormData((prev: any) => ({
                  ...prev,
                  accessLevelId: val as string,
                }))
              }
              placeholder="Select access level..."
            />
            <input
              type="text"
              required
              value={roleFormData.accessLevelId}
              readOnly
              className="sr-only"
              aria-hidden
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
              Operational Summary
            </label>
            <textarea
              name="description"
              value={roleFormData.description}
              onChange={handleRoleInputChange}
              placeholder="Tactical scope summary..."
              className="flex min-h-[80px] w-full rounded-xl border border-border/20 bg-muted/30 px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
