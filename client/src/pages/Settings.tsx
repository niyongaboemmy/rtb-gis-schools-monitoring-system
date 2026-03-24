import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Modal } from "../components/ui/modal";
import {
  Search,
  Plus,
  Eye,
  Trash2,
  Edit2,
  AlertCircle,
  Shield,
  ChevronLeft,
  ChevronRight,
  Users as UsersIcon,
  Settings2,
} from "lucide-react";
import { SearchInput } from "../components/ui/search-input";
import { RichDropdown } from "../components/ui/rich-dropdown";
import type { DropdownOption } from "../components/ui/rich-dropdown";
import { useAuthStore } from "../store/authStore";
import { format } from "date-fns";
import { Permission } from "../lib/permissions";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "../components/ui/page-header";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../components/ui/table";
import { cn } from "../lib/utils";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtering & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const roleOptions: DropdownOption[] = roles.map((role) => ({
    label: role.name.replace("_", " ").toUpperCase(),
    value: role.id,
  }));

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Modals & User Management State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [previewUser, setPreviewUser] = useState<any | null>(null);

  // Roles Management State
  const [selectedRole, setSelectedRole] = useState<any | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    roleId: "", // using roleId for dynamic roles
  });

  const [roleFormData, setRoleFormData] = useState({
    name: "",
    description: "",
  });

  const { user: currentUser } = useAuthStore();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.get("/users"),
        api.get("/roles"),
      ]);
      setUsers(usersRes.data);
      const rolesData = rolesRes.data;
      setRoles(rolesData);

      if (rolesData.length > 0 && !selectedRole) {
        setSelectedRole(rolesData[0]);
      }

      // Default to the first role for user creation if none selected
      if (!formData.roleId && rolesData.length > 0) {
        // Prefer 'viewer' role by default if exists
        const viewerRole = rolesData.find((r: any) => r.name === "viewer");
        setFormData((prev) => ({
          ...prev,
          roleId: viewerRole ? viewerRole.id : rolesData[0].id,
        }));
      }
    } catch (err) {
      console.error("Failed to load initial data", err);
    } finally {
      setLoading(false);
    }
  };

  // User Filter logic
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role?.id === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setRoleFormData({ ...roleFormData, [e.target.name]: e.target.value });
  };

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setFormData({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      password: "", // empty during edit
      roleId: user.role?.id || "",
    });
    setIsModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError("");

    try {
      const payload = { ...formData };
      if (editingUser && !payload.password) {
        delete (payload as any).password;
      }

      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, payload);
      } else {
        await api.post("/users", formData);
      }

      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        roleId: roles[0]?.id || "",
      });
      fetchInitialData();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          `Failed to ${editingUser ? "update" : "create"} identity`,
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to deactivate ${name}?`)) return;
    try {
      await api.delete(`/users/${id}`);
      fetchInitialData();
    } catch (err) {
      console.error("Failed to deactivate user", err);
    }
  };

  // ROLE MANAGEMENT LOGIC
  const handleTogglePermission = async (
    role: any,
    permissionLabel: string,
    checked: boolean,
  ) => {
    if (role.name === "super_admin") return; // Cannot edit super_admin

    // Optimistic UI updates
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
      // Revert if failed
      setSelectedRole(role);
      fetchInitialData();
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
      setRoleFormData({ name: "", description: "" });
      await fetchInitialData();
      setSelectedRole(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create role");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete this role? This might break users assigned to it.`,
      )
    )
      return;
    try {
      await api.delete(`/roles/${id}`);
      setSelectedRole(roles[0]); // Reset to first available
      fetchInitialData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete role");
    }
  };

  const getPermissionDescription = (p: string) => {
    switch (p) {
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

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Hero Header */}
      <PageHeader
        title="Control Center"
        description="Orchestrate users, define access roles, and monitor permissions."
        icon={Settings2}
        actions={
          <div className="flex bg-muted/20 p-1 rounded-full border border-border/30 backdrop-blur-md">
            {[
              { id: "users", label: "User Directory", icon: UsersIcon },
              { id: "roles", label: "Roles Management", icon: Shield },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300",
                  activeTab === tab.id
                    ? "text-blue-600 dark:text-blue-100"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-blue-100/60 dark:bg-blue-700/30 rounded-full"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
                <tab.icon className="w-3 h-3 relative z-10 shrink-0" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>
        }
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === "users" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="fade-in animate-in"
            >
              <Card className="border border-border/20 bg-card/60 backdrop-blur-xl rounded-2xl overflow-hidden">
                <CardHeader className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 border-b border-border/40">
                  <div>
                    <CardTitle className="text-lg font-bold tracking-tight">
                      Administrative Directory
                    </CardTitle>
                    <CardDescription className="text-[11px] font-medium text-muted-foreground/70 hidden lg:block">
                      Manage and inspect authorized system identities.
                    </CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <Button
                      size="sm"
                      className="h-10 px-5 rounded-full bg-primary text-[14px] shadow-none hover:scale-105 active:scale-95 transition-all w-full sm:w-auto"
                      onClick={() => setIsModalOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" /> New Identity
                    </Button>

                    <div className="flex flex-row items-center gap-3 w-full sm:w-auto">
                      <SearchInput
                        placeholder="Search identities..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClear={() => setSearchTerm("")}
                        containerClassName="w-full sm:w-64"
                      />
                      <RichDropdown
                        options={[
                          { label: "All Roles", value: "all" },
                          ...roleOptions,
                        ]}
                        value={roleFilter}
                        onChange={(val) => {
                          setRoleFilter(val);
                          setCurrentPage(1);
                        }}
                        className="w-full sm:w-52 rounded-full"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex flex-col min-h-[450px]">
                  <div className="flex-1">
                    <Table wrapperClassName="max-h-[500px] border-none rounded-none bg-transparent backdrop-blur-none">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Identity</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Onboarded</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="py-20 text-center"
                            >
                              <div className="flex flex-col items-center gap-3">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                <p className="font-bold text-[10px] animate-pulse tracking-widest uppercase text-muted-foreground/60">
                                  Syncing Vault...
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : paginatedUsers.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="py-20 text-center"
                            >
                              <div className="flex flex-col items-center gap-2 opacity-30">
                                <Search className="w-8 h-8 mb-1" />
                                <p className="font-bold text-xs uppercase tracking-wider">
                                  No records found.
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedUsers.map((u) => (
                            <TableRow key={u.id} className="group/row">
                              <TableCell>
                                <div className="flex items-center gap-3 text-left">
                                  <div className="w-9 h-9 rounded-xl bg-linear-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center font-black text-[10px] uppercase border border-primary/10 group-hover/row:scale-110 transition-transform">
                                    {u.firstName?.[0]}
                                    {u.lastName?.[0]}
                                  </div>
                                  <div>
                                    <div className="font-bold text-foreground text-sm leading-tight group-hover/row:text-primary transition-colors">
                                      {u.firstName} {u.lastName}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-medium">
                                      {u.email}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className="uppercase text-[8px] font-black tracking-widest px-2 py-0 rounded-full border-primary/20 text-primary bg-primary/5 shadow-none"
                                >
                                  {u.role?.name?.replace("_", " ") || "None"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {u.isActive ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                                      Synchronized
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-destructive" />
                                    <span className="text-[10px] font-black uppercase text-destructive">
                                      Offline
                                    </span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground font-mono text-[9px] font-bold">
                                {format(new Date(u.createdAt), "dd.MM.yy")}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full border-border/20 hover:bg-accent hover:text-primary transition-all shadow-none"
                                    onClick={() => setPreviewUser(u)}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full border-border/20 hover:bg-accent hover:text-primary transition-all shadow-none"
                                    onClick={() => handleEditClick(u)}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full border-border/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all shadow-none"
                                    disabled={
                                      u.id === currentUser?.id || !u.isActive
                                    }
                                    onClick={() =>
                                      handleDeleteUser(u.id, u.firstName)
                                    }
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {!loading && totalPages > 1 && (
                    <div className="p-1 mx-6 my-4 border border-border/20 flex items-center justify-between text-[10px] font-bold text-muted-foreground bg-muted/20 rounded-xl backdrop-blur-sm">
                      <div className="px-3 uppercase tracking-wider">
                        Index {(currentPage - 1) * itemsPerPage + 1} —{" "}
                        {Math.min(
                          currentPage * itemsPerPage,
                          filteredUsers.length,
                        )}{" "}
                        of {filteredUsers.length}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 rounded-lg hover:bg-background"
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </Button>
                        <div className="tracking-widest uppercase px-2 text-[9px]">
                          Page {currentPage} / {totalPages}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 rounded-lg hover:bg-background"
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === "roles" && (
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
                  className="w-full h-12 rounded-xl border-dashed border-2 hover:border-primary hover:bg-primary/5 text-primary text-xs font-bold transition-all"
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
                                {selectedRole.description ||
                                  "Standard tactical scope."}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl h-8 px-3 border-destructive/20 text-destructive text-[10px] uppercase font-bold hover:bg-destructive/5"
                                onClick={() =>
                                  handleDeleteRole(selectedRole.id)
                                }
                                disabled={[
                                  "super_admin",
                                  "admin",
                                  "viewer",
                                ].includes(selectedRole.name)}
                              >
                                <Trash2 className="w-3 h-3 mr-1.5" /> Dissolve
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
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
                                  )}
                                  disabled={selectedRole.name === "super_admin"}
                                >
                                  <div
                                    className={cn(
                                      "w-5 h-5 rounded-lg flex items-center justify-center transition-colors mt-0.5",
                                      hasPermission
                                        ? "bg-primary text-white"
                                        : "bg-muted-foreground/10 text-muted-foreground",
                                    )}
                                  >
                                    {hasPermission ? (
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
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Modals & Previews */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        maxWidth="max-w-lg"
        className="bg-card border-border/20"
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              {editingUser ? (
                <Edit2 className="w-5 h-5 text-primary" />
              ) : (
                <UsersIcon className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold uppercase tracking-tight text-foreground">
                {editingUser ? "Amend Identity" : "New Identity"}
              </span>
              <span className="text-[10px] font-medium tracking-normal normal-case text-muted-foreground">
                {editingUser
                  ? "Update administrative agent clearance and info"
                  : "Commission a new administrative agent"}
              </span>
            </div>
          </div>
        }
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              className="font-bold text-[10px] uppercase h-9 rounded-xl"
              onClick={() => {
                setIsModalOpen(false);
                setEditingUser(null);
                setFormData({
                  firstName: "",
                  lastName: "",
                  email: "",
                  password: "",
                  roleId: roles[0]?.id || "",
                });
              }}
            >
              Abort
            </Button>
            <Button
              type="submit"
              form="addUserForm"
              className="px-6 h-10 rounded-xl font-black text-[10px] uppercase tracking-wide"
              disabled={submitLoading}
            >
              {submitLoading
                ? "Transmitting..."
                : editingUser
                  ? "Update Identity"
                  : "Initialize Identity"}
            </Button>
          </>
        }
      >
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold flex items-center gap-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form
          id="addUserForm"
          onSubmit={handleCreateUser}
          className="grid grid-cols-2 gap-4 pb-2"
        >
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
              First Name
            </label>
            <Input
              name="firstName"
              required
              value={formData.firstName}
              onChange={handleInputChange}
              className="h-10 rounded-xl bg-muted/30 border-border/20 focus:ring-primary/10 text-sm"
              placeholder="First Name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
              Last Name
            </label>
            <Input
              name="lastName"
              required
              value={formData.lastName}
              onChange={handleInputChange}
              className="h-10 rounded-xl bg-muted/30 border-border/20 focus:ring-primary/10 text-sm"
              placeholder="Last Name"
            />
          </div>
          <div className="col-span-2 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
              Email Signature
            </label>
            <Input
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              placeholder="agent@rtb.gov.rw"
            />
          </div>
          <div className="col-span-2 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
              Authority Level
            </label>
            <RichDropdown
              options={roleOptions}
              value={formData.roleId}
              onChange={(val) =>
                setFormData((prev) => ({ ...prev, roleId: val }))
              }
              placeholder="Select authority level..."
            />
          </div>
          <div className="col-span-2 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
              Access Password
            </label>
            <Input
              name="password"
              type="password"
              required={!editingUser}
              value={formData.password}
              onChange={handleInputChange}
              className="h-10 rounded-xl bg-muted/30 border-border/20 focus:ring-primary/10 text-sm"
              placeholder={
                editingUser ? "•••••••• (Leave blank to keep)" : "••••••••"
              }
            />
          </div>
        </form>
      </Modal>

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
              {submitLoading ? "Forging..." : "Register Role"}
            </Button>
          </>
        }
      >
        <form
          id="addRoleForm"
          onSubmit={handleCreateRole}
          className="space-y-6 pb-2"
        >
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

      <Modal
        isOpen={!!previewUser}
        onClose={() => setPreviewUser(null)}
        maxWidth="max-w-[320px]"
        className="bg-card/80 border-border/20 backdrop-blur-3xl overflow-hidden"
        hideCloseButton
      >
        {previewUser && (
          <div className="relative flex flex-col pt-2 pb-2">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/20 rounded-full blur-[80px] -z-10 -translate-y-1/2 translate-x-1/2"></div>

            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-primary to-blue-600 text-white flex items-center justify-center font-black text-2xl uppercase mb-4 rotate-2 shadow-xl shadow-primary/20">
                {previewUser.firstName?.[0]}
                {previewUser.lastName?.[0]}
              </div>
              <h4 className="text-xl font-black text-center tracking-tight leading-none">
                {previewUser.firstName} {previewUser.lastName}
              </h4>
              <p className="text-muted-foreground font-medium text-[11px] mt-1">
                {previewUser.email}
              </p>
              <Badge className="mt-3 px-3 py-0.5 rounded-full uppercase tracking-widest text-[8px] font-black bg-primary/10 text-primary border-primary/20">
                {previewUser.role?.name?.replace("_", " ") || "No Clearance"}
              </Badge>
            </div>

            <div className="space-y-2 text-[10px]">
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-muted/20 border border-border/20">
                <span className="text-muted-foreground font-bold uppercase tracking-widest">
                  Status
                </span>
                <span
                  className={cn(
                    "font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md",
                    previewUser.isActive
                      ? "text-emerald-500 bg-emerald-500/10"
                      : "text-destructive bg-destructive/10",
                  )}
                >
                  {previewUser.isActive ? "Active" : "Locked"}
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-muted/20 border border-border/20">
                <span className="text-muted-foreground font-bold uppercase tracking-widest">
                  Commissioned
                </span>
                <span className="font-mono font-bold">
                  {format(new Date(previewUser.createdAt), "dd.MM.yy")}
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-muted/20 border border-border/20">
                <span className="text-muted-foreground font-bold uppercase tracking-widest">
                  Last Pulse
                </span>
                <span className="font-mono font-bold text-right">
                  {previewUser.lastLoginAt
                    ? format(new Date(previewUser.lastLoginAt), "HH:mm dd.MM")
                    : "NEVER"}
                </span>
              </div>
            </div>

            <Button
              className="mt-6 h-10 rounded-xl font-black uppercase text-[10px] tracking-wider w-full bg-linear-to-r from-primary to-primary/80"
              onClick={() => setPreviewUser(null)}
            >
              Close Record
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
