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
import { Input } from "../ui/input";
import { Modal } from "../ui/modal";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../ui/table";
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";

export function AccessLevelsTab() {
  const [accessLevels, setAccessLevels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal & Form State
  const [isAccessLevelModalOpen, setIsAccessLevelModalOpen] = useState(false);
  const [editingAccessLevel, setEditingAccessLevel] = useState<any | null>(
    null,
  );
  const [accessLevelFormData, setAccessLevelFormData] = useState({ name: "" });

  // Loaders & Errors
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
    if (fetchPromise.current) {
      return fetchPromise.current;
    }
    
    setLoading(true);
    
    fetchPromise.current = Promise.all([
      api.get("/access-levels"),
      api.get("/roles"),
    ]).then(([levelsRes, rolesRes]) => {
      setAccessLevels(levelsRes.data);
      setRoles(rolesRes.data);
    }).catch(err => {
      console.error("Failed to load access levels data", err);
    }).finally(() => {
      setLoading(false);
      fetchPromise.current = null;
    });

    return fetchPromise.current;
  };

  const handleSaveAccessLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError("");
    try {
      if (editingAccessLevel) {
        await api.patch(
          `/access-levels/${editingAccessLevel.id}`,
          accessLevelFormData,
        );
      } else {
        await api.post("/access-levels", accessLevelFormData);
      }
      setIsAccessLevelModalOpen(false);
      setEditingAccessLevel(null);
      setAccessLevelFormData({ name: "" });
      fetchInitialData();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          `Failed to ${editingAccessLevel ? "update" : "create"} level`,
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteAccessLevel = async (id: string, name: string) => {
    if (!window.confirm(`Dissolve geographic scope level "${name}"?`)) return;
    const key = `del-al-${id}`;
    setAL(key, true);
    try {
      await api.delete(`/access-levels/${id}`);
      fetchInitialData();
    } catch (err) {
      console.error("Failed to delete access level", err);
    } finally {
      setAL(key, false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fade-in animate-in"
    >
      <Card className="border border-border/20 bg-card/60 backdrop-blur-xl rounded-2xl overflow-hidden">
        <CardHeader className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 py-4 pr-4 border-b border-border/40">
          <div>
            <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Access Levels
            </CardTitle>
            <CardDescription className="text-[12px] font-medium text-muted-foreground/70 hidden lg:block">
              Define geographic scope levels assigned to roles.
            </CardDescription>
          </div>
          <Button
            size="sm"
            className="h-10 px-5 rounded-full bg-primary text-[14px] shadow-none hover:scale-105 active:scale-95 transition-all"
            onClick={() => {
              setEditingAccessLevel(null);
              setAccessLevelFormData({ name: "" });
              setError("");
              setIsAccessLevelModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> New Level
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table wrapperClassName="max-h-[500px] border-none rounded-none bg-transparent backdrop-blur-none">
            <TableHeader>
              <TableRow>
                <TableHead>Level Name</TableHead>
                <TableHead>Roles Using This</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p className="font-bold text-[10px] animate-pulse tracking-widest uppercase text-muted-foreground/60">
                        Loading...
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : accessLevels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <Layers className="w-8 h-8 mb-1" />
                      <p className="font-bold text-xs uppercase tracking-wider">
                        No access levels found.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                accessLevels.map((al) => (
                  <TableRow key={al.id} className="group/row">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Layers className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="font-bold text-sm">{al.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {
                          roles.filter((r) => r.accessLevel?.id === al.id)
                            .length
                        }{" "}
                        role(s)
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full border-border/20 hover:bg-accent hover:text-primary transition-all shadow-none"
                          onClick={() => {
                            setEditingAccessLevel(al);
                            setAccessLevelFormData({ name: al.name });
                            setError("");
                            setIsAccessLevelModalOpen(true);
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full border-border/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all shadow-none"
                          disabled={isAL(`del-al-${al.id}`)}
                          onClick={() =>
                            handleDeleteAccessLevel(al.id, al.name)
                          }
                        >
                          {isAL(`del-al-${al.id}`) ? (
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
        </CardContent>
      </Card>

      {/* Access Level Create / Edit Modal */}
      <Modal
        isOpen={isAccessLevelModalOpen}
        onClose={() => {
          setIsAccessLevelModalOpen(false);
          setEditingAccessLevel(null);
          setAccessLevelFormData({ name: "" });
        }}
        maxWidth="max-w-sm"
        className="bg-card border-border/20"
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold uppercase tracking-tight text-foreground">
                {editingAccessLevel ? "Edit Level" : "New Level"}
              </span>
              <span className="text-[10px] font-medium tracking-normal normal-case text-muted-foreground">
                {editingAccessLevel
                  ? "Rename this access level"
                  : "Define a new geographic access scope"}
              </span>
            </div>
          </div>
        }
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsAccessLevelModalOpen(false);
                setEditingAccessLevel(null);
                setAccessLevelFormData({ name: "" });
              }}
              className="font-bold text-[14px] h-9 rounded-full"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="accessLevelForm"
              className="px-6 h-10 rounded-full text-[14px] tracking-wide"
              disabled={submitLoading}
            >
              {submitLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : editingAccessLevel ? (
                "Update Level"
              ) : (
                "Create Level"
              )}
            </Button>
          </>
        }
      >
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        <form
          id="accessLevelForm"
          onSubmit={handleSaveAccessLevel}
          className="space-y-4 pb-2"
        >
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
              Level Name <span className="text-destructive">*</span>
            </label>
            <Input
              required
              value={accessLevelFormData.name}
              onChange={(e) => setAccessLevelFormData({ name: e.target.value })}
              className="h-10 rounded-xl bg-muted/30 border-border/20 focus:ring-primary/10 text-sm"
              placeholder="e.g. District"
            />
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
