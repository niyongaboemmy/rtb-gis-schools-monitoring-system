import { useState, useEffect, useRef, useMemo } from "react";
import { api, apiErrorMessage } from "../../lib/api";
import { useToast, notify } from "../ui/toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Modal } from "../ui/modal";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../ui/table";
import { SearchInput } from "../ui/search-input";
import { RichDropdown } from "../ui/rich-dropdown";
import { UserFormModal } from "../users/UserFormModal";
import { BulkUploadModal } from "../users/BulkUploadModal";
import { DeleteConfirmationModal } from "../ui/delete-confirmation-modal";
import { useAuthStore } from "../../store/authStore";
import { useSchoolsStore } from "../../store/schoolsStore";
import { resolveDistrictName, resolveProvinceName } from "../../lib/rwanda-locations";
import {
  Send,
  Search,
  Plus,
  Eye,
  Trash2,
  Edit2,
  Loader2,
  MapPin,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  Layers,
  Users2,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { cn } from "../../lib/utils";
import { titleCase } from "../../lib/labels";

export function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { allSchools, fetchAllSchools } = useSchoolsStore();

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [previewUser, setPreviewUser] = useState<any | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<{ id: string; name: string } | null>(null);

  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>(
    {},
  );
  const setAL = (key: string, val: boolean) =>
    setActionLoading((prev) => ({ ...prev, [key]: val }));
  const isAL = (key: string) => actionLoading[key] === true;

  const { user: currentUser } = useAuthStore();
  const toast = useToast();
  const fetchPromise = useRef<Promise<any> | null>(null);

  useEffect(() => {
    fetchInitialData();
    fetchAllSchools();
  }, [fetchAllSchools]);

  const fetchInitialData = async () => {
    if (fetchPromise.current) return fetchPromise.current;
    
    setLoading(true);
    
    fetchPromise.current = Promise.all([
      api.get("/users"),
      api.get("/roles"),
    ]).then(([usersRes, rolesRes]) => {
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
    }).catch(err => {
      console.error("Failed to load initial data", err);
      notify.error(apiErrorMessage(err, "Could not load users."));
    }).finally(() => {
      setLoading(false);
      fetchPromise.current = null;
    });

    return fetchPromise.current;
  };

  const handleDeleteUser = async (id: string, name: string) => {
    const key = `del-user-${id}`;
    setAL(key, true);
    try {
      await api.delete(`/users/${id}`);
      setPendingDeactivate(null);
      fetchInitialData();
      toast.success(`User "${name}" deactivated and signed out`);
    } catch (err) {
      toast.error(apiErrorMessage(err, `Could not deactivate ${name}.`));
    } finally {
      setAL(key, false);
    }
  };

  /** Emails the user a one-time code to set a new password (WS10.4). */
  const handleSendReset = async (id: string, email: string) => {
    const key = `reset-user-${id}`;
    setAL(key, true);
    try {
      const { data } = await api.post<{ delivered: boolean }>(`/users/${id}/send-reset`);
      if (data.delivered) toast.success(`A reset code was emailed to ${email}.`);
      else toast.warning("Email is disabled on this server; the code was written to the server log.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not send the reset code."));
    } finally {
      setAL(key, false);
    }
  };

  const roleOptions = roles.map((role) => ({
    label: titleCase(role.name),
    value: role.id,
  }));

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

  const overview = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const rolesInUse = new Set(users.map((u) => u.role?.id).filter(Boolean)).size;
    return { total, active, offline: total - active, rolesInUse };
  }, [users]);

  const statTiles = [
    { label: "Total Identities", value: overview.total, icon: Users2, tone: "text-primary bg-primary/10" },
    { label: "Active", value: overview.active, icon: Wifi, tone: "text-emerald-500 bg-emerald-500/10" },
    { label: "Offline", value: overview.offline, icon: WifiOff, tone: "text-destructive bg-destructive/10" },
    { label: "Roles In Use", value: `${overview.rolesInUse}/${roles.length}`, icon: ShieldCheck, tone: "text-violet-500 bg-violet-500/10" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fade-in animate-in space-y-5"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statTiles.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-2xl border border-border/20 bg-card/60 backdrop-blur-xl p-4"
          >
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", s.tone)}>
              <s.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black font-mono leading-none tabular-nums">
                {loading ? "—" : s.value}
              </div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-black mt-1 truncate">
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card className="border border-border/20 dark:border-gray-900 bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden">
        <CardHeader className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 xl:gap-6 p-4 sm:p-6 sm:py-4 sm:pr-4 border-b border-border/40">
          <div>
            <CardTitle className="text-lg font-bold tracking-tight">
              Administrative Directory
            </CardTitle>
            <CardDescription className="text-[11px] font-medium text-muted-foreground/70 hidden lg:block">
              Manage and inspect authorized system identities.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-center gap-4 w-full xl:w-auto xl:justify-end">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                className="h-10 px-5 rounded-full border-primary/20 bg-primary/5 text-primary text-[14px] shadow-none hover:bg-primary/10 transition-all flex-1 sm:flex-none"
                onClick={() => setIsUploadModalOpen(true)}
              >
                <UploadCloud className="w-4 h-4 mr-2" /> Upload Users
              </Button>
              <Button
                size="sm"
                className="h-10 px-5 rounded-full bg-primary text-[14px] shadow-none hover:scale-105 active:scale-95 transition-all flex-1 sm:flex-none"
                onClick={() => {
                  setEditingUser(null);
                  setIsModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> New Identity
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <SearchInput
                placeholder="Search identities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClear={() => setSearchTerm("")}
                containerClassName="w-full sm:w-64"
              />
              <RichDropdown
                options={[{ label: "All Roles", value: "all" }, ...roleOptions]}
                value={roleFilter}
                onChange={(val) => {
                  setRoleFilter(val as string);
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
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Onboarded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-20 text-center">
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
                    <TableCell colSpan={6} className="py-20 text-center">
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
                            <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5">
                              {u.email}
                              {u.totpEnabled && (
                                <span title="Two-factor authentication on" className="inline-flex items-center text-emerald-600 dark:text-emerald-400">
                                  <ShieldCheck className="w-3 h-3" aria-hidden />
                                  <span className="sr-only">2FA on</span>
                                </span>
                              )}
                              {u.mustChangePassword && (
                                <span className="rounded-full bg-amber-500/15 px-1.5 text-[9px] font-bold text-amber-700 dark:text-amber-400">
                                  pending password
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="uppercase text-[8px] font-black tracking-widest px-2 py-0 rounded-full border-primary/20 text-primary bg-primary/5 shadow-none"
                        >
                          {u.role?.name ? titleCase(u.role.name) : "None"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const lvl = u.role?.accessLevel?.name;
                          const loc = u.location;
                          if (!lvl)
                            return (
                              <span className="text-muted-foreground/50 text-[10px] italic">
                                National
                              </span>
                            );

                          const locLabel = loc
                            ? loc.schoolName
                              ? loc.schoolName
                              : loc.sector
                                ? `${loc.sector}, ${resolveDistrictName(loc.district)}`
                                : loc.district
                                  ? `${resolveDistrictName(loc.district)}, ${resolveProvinceName(loc.province)}`
                                  : resolveProvinceName(loc.province)
                            : null;

                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-bold text-foreground capitalize flex items-center gap-1">
                                <Layers className="w-3 h-3 text-primary/60" />{" "}
                                {lvl.toLowerCase()}
                              </span>
                              {locLabel && (
                                <span className="text-[9px] text-muted-foreground font-medium flex items-center gap-1">
                                  <MapPin className="w-2.5 h-2.5" /> {locLabel}
                                </span>
                              )}
                            </div>
                          );
                        })()}
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
                        <div className="flex items-center justify-end gap-1.5 md:opacity-0 md:group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-full border-border/20 hover:bg-accent hover:text-primary transition-all shadow-none"
                            aria-label={`View ${u.firstName} ${u.lastName}`}
                            onClick={() => setPreviewUser(u)}
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${u.firstName} ${u.lastName}`}
                            onClick={() => {
                              setEditingUser(u);
                              setIsModalOpen(true);
                            }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary rounded-lg"
                          >
                            <Edit2 className="w-3.5 h-3.5" aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Send ${u.email} a password reset code`}
                            title="Send reset code"
                            disabled={!u.isActive || isAL(`reset-user-${u.id}`)}
                            onClick={() => void handleSendReset(u.id, u.email)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary rounded-lg"
                          >
                            {isAL(`reset-user-${u.id}`) ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={`Deactivate ${u.email}`}
                            className="h-8 w-8 rounded-full border-border/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all shadow-none"
                            disabled={
                              u.id === currentUser?.id ||
                              !u.isActive ||
                              isAL(`del-user-${u.id}`)
                            }
                            onClick={() =>
                              setPendingDeactivate({
                                id: u.id,
                                name: `${u.firstName} ${u.lastName}`.trim(),
                              })
                            }
                          >
                            {isAL(`del-user-${u.id}`) ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
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
            <div className="p-1 mx-4 sm:mx-6 my-4 border border-border/20 flex flex-wrap items-center justify-between gap-1 text-[10px] font-bold text-muted-foreground bg-muted/20 rounded-xl backdrop-blur-sm">
              <div className="px-3 uppercase tracking-wider">
                Index {(currentPage - 1) * itemsPerPage + 1} —{" "}
                {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of{" "}
                {filteredUsers.length}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 rounded-lg hover:bg-background"
                  aria-label="Previous page"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                  aria-label="Next page"
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

      {/* Profile Preview Modal */}
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
              <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-primary to-blue-600 text-white flex items-center justify-center font-black text-2xl uppercase mb-4 rotate-2">
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
                {previewUser.role?.name ? titleCase(previewUser.role.name) : "No Clearance"}
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
              {previewUser.location &&
                Object.keys(previewUser.location).length > 0 && (
                  <div className="flex justify-between items-start p-2.5 rounded-xl bg-primary/5 border border-primary/15">
                    <span className="text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Scope
                    </span>
                    <span className="font-bold text-right text-primary/80 max-w-[55%]">
                      {previewUser.location.schoolName
                        ? previewUser.location.schoolName
                        : previewUser.location.sector
                          ? `${previewUser.location.sector}, ${resolveDistrictName(previewUser.location.district)}`
                          : previewUser.location.district
                            ? `${resolveDistrictName(previewUser.location.district)}, ${resolveProvinceName(previewUser.location.province)}`
                            : resolveProvinceName(previewUser.location.province)}
                    </span>
                  </div>
                )}
            </div>

            <Button
              className="mt-6 h-10 rounded-full font-black uppercase text-[10px] tracking-wider w-full bg-linear-to-r from-primary to-primary/80 text-primary-foreground"
              onClick={() => setPreviewUser(null)}
            >
              Close Record
            </Button>
          </div>
        )}
      </Modal>

      <UserFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchInitialData()}
        editingUser={editingUser}
        roles={roles}
        schools={allSchools}
      />

      <BulkUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={fetchInitialData}
      />

      <DeleteConfirmationModal
        isOpen={pendingDeactivate !== null}
        onClose={() => setPendingDeactivate(null)}
        onConfirm={() =>
          pendingDeactivate &&
          handleDeleteUser(pendingDeactivate.id, pendingDeactivate.name)
        }
        title="Deactivate user"
        description={`Deactivate ${pendingDeactivate?.name ?? "this user"}? They will be signed out and can no longer sign in.`}
        confirmLabel="Deactivate"
        isLoading={pendingDeactivate ? isAL(`del-user-${pendingDeactivate.id}`) : false}
      />
    </motion.div>
  );
}
