import { useState, useEffect, useRef } from "react";
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
import { useAuthStore } from "../../store/authStore";
import { resolveDistrictName, resolveProvinceName } from "../../lib/rwanda-locations";
import {
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
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { cn } from "../../lib/utils";

export function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>(
    {},
  );
  const setAL = (key: string, val: boolean) =>
    setActionLoading((prev) => ({ ...prev, [key]: val }));
  const isAL = (key: string) => actionLoading[key] === true;

  const { user: currentUser } = useAuthStore();
  const fetchPromise = useRef<Promise<any> | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    if (fetchPromise.current) return fetchPromise.current;
    
    setLoading(true);
    
    fetchPromise.current = Promise.all([
      api.get("/users"),
      api.get("/roles"),
      api.get("/schools"),
    ]).then(([usersRes, rolesRes, schoolsRes]) => {
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
      const rawSchools = schoolsRes.data.data;
      setSchools(
        Array.isArray(rawSchools)
          ? rawSchools
          : Array.isArray(rawSchools?.data)
            ? rawSchools.data
            : Array.isArray(rawSchools?.items)
              ? rawSchools.items
              : [],
      );
    }).catch(err => {
      console.error("Failed to load initial data", err);
    }).finally(() => {
      setLoading(false);
      fetchPromise.current = null;
    });

    return fetchPromise.current;
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to deactivate ${name}?`)) return;
    const key = `del-user-${id}`;
    setAL(key, true);
    try {
      await api.delete(`/users/${id}`);
      fetchInitialData();
    } catch (err) {
      console.error("Failed to deactivate user", err);
    } finally {
      setAL(key, false);
    }
  };

  const roleOptions = roles.map((role) => ({
    label: role.name.replace("_", " ").toUpperCase(),
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fade-in animate-in"
    >
      <Card className="border border-border/20 dark:border-gray-900 bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden">
        <CardHeader className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 py-4 pr-4 border-b border-border/40">
          <div>
            <CardTitle className="text-lg font-bold tracking-tight">
              Administrative Directory
            </CardTitle>
            <CardDescription className="text-[11px] font-medium text-muted-foreground/70 hidden lg:block">
              Manage and inspect authorized system identities.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">
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

            <div className="flex flex-row items-center gap-3 w-full sm:w-auto">
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
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingUser(u);
                              setIsModalOpen(true);
                            }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary rounded-lg"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-full border-border/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all shadow-none"
                            disabled={
                              u.id === currentUser?.id ||
                              !u.isActive ||
                              isAL(`del-user-${u.id}`)
                            }
                            onClick={() => handleDeleteUser(u.id, u.firstName)}
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
            <div className="p-1 mx-6 my-4 border border-border/20 flex items-center justify-between text-[10px] font-bold text-muted-foreground bg-muted/20 rounded-xl backdrop-blur-sm">
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
              className="mt-6 h-10 rounded-xl font-black uppercase text-[10px] tracking-wider w-full bg-linear-to-r from-primary to-primary/80"
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
        schools={schools}
      />

      <BulkUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={fetchInitialData}
      />
    </motion.div>
  );
}
