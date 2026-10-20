import { useState } from "react";
import { useAuthStore } from "../store/authStore";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  User,
  Mail,
  Shield,
  Phone,
  Building2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Lock,
  UserCircle,
  Layers,
  MapPin,
} from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "../components/ui/page-header";
import { cn } from "../lib/utils";
import { SecuritySettings } from "../components/auth/SecuritySettings";
import { useToast } from "../components/ui/toast";

export default function Profile() {
  const { user, updateUser } = useAuthStore();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [activeTab, setActiveTab] = useState<"personal" | "security">(
    "personal",
  );

  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    department: user?.department || "",
  });

  const accessLevelName =
    typeof user?.role === "object" && user?.role !== null
      ? user.role.accessLevel?.name ?? null
      : null;

  const loc = user?.location;
  const scopeLabel = loc
    ? loc.schoolName
      ? loc.schoolName
      : loc.sector
        ? `${loc.sector}, ${loc.district}`
        : loc.district
          ? `${loc.district}, ${loc.province}`
          : loc.province
    : null;

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      // Email is managed by administrators; the endpoint only takes these.
      const { firstName, lastName, phone, department } = formData;
      const { data } = await api.patch(`/users/me/profile`, {
        firstName,
        lastName,
        phone,
        department,
      });
      updateUser(data);
      setMessage({ text: "", type: "" });
      toast.success("Profile details updated");
    } catch (err) {
      setMessage({
        text: apiErrorMessage(err, "Failed to update profile"),
        type: "error",
      });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage({ text: "", type: "" }), 5000);
    }
  };

  const tabs = [
    { id: "personal", label: "Personal Details", icon: UserCircle },
    { id: "security", label: "Security & Privacy", icon: Lock },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <PageHeader
        className="md:p-12 mb-8"
        customIcon={
          <div className="relative group sm:mr-4">
            <div className="w-20 h-20 sm:w-32 sm:h-32 rounded-3xl bg-linear-to-br from-primary to-blue-600 flex items-center justify-center text-white text-2xl sm:text-4xl font-black rotate-3 group-hover:rotate-0 transition-transform duration-500">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-white dark:bg-gray-900 border border-border flex items-center justify-center">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
          </div>
        }
        title={<>{user?.firstName} {user?.lastName}</>}
        titleBadge={
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest border border-primary/10">
              {typeof user?.role === "string"
                ? user.role.replace("_", " ")
                : user?.role?.name?.replace("_", " ")}
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground font-medium break-all">
              <Mail className="w-4 h-4 shrink-0" aria-hidden /> {user?.email}
            </span>
          </div>
        }
        description={
          <div className="flex flex-col gap-3 mt-2">
            {(accessLevelName || scopeLabel) && (
              <div className="flex flex-wrap items-center gap-3 py-2 px-3 bg-card border border-border/40 rounded-xl w-fit max-w-full">
                {accessLevelName && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <Layers className="w-3.5 h-3.5" />
                    {accessLevelName}
                  </span>
                )}
                {accessLevelName && scopeLabel && (
                  <span className="text-muted-foreground/30">•</span>
                )}
                {scopeLabel && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />
                    {scopeLabel}
                  </span>
                )}
              </div>
            )}
            <span className="text-sm text-muted-foreground/80 font-medium max-w-md pt-2 block normal-case tracking-normal">
              Manage your identity, security settings, and personal preference
              for the TVET 3D GIS platform.
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "personal" | "security")}
              className={cn(
                "w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 group",
                activeTab === tab.id
                  ? "bg-primary text-white"
                  : "bg-card backdrop-blur-sm text-foreground hover:translate-x-1 border border-border/20",
              )}
            >
              <div className="flex items-center gap-3 font-semibold text-sm">
                <tab.icon
                  className={cn(
                    "w-5 h-5",
                    activeTab === tab.id ? "text-white" : "text-primary",
                  )}
                />
                {tab.label}
              </div>
              <ChevronRight
                className={cn(
                  "w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity",
                  activeTab === tab.id ? "text-white" : "text-primary",
                )}
              />
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {message.text && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "p-4 rounded-2xl text-sm font-bold border flex items-center gap-3",
                    message.type === "success"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border-destructive/20",
                  )}
                >
                  {message.type === "success" ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  {message.text}
                </motion.div>
              )}

              {activeTab === "personal" ? (
                <Card className="bg-card/60 border border-border/20 backdrop-blur-xl overflow-hidden rounded-3xl shadow-none">
                  <div className="p-5 sm:p-8 space-y-6">
                    <div className="flex items-center gap-3 pb-4">
                      <div className="p-2 rounded-xl bg-primary/10">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">
                          Personal Information
                        </h4>
                        <p className="text-xs text-muted-foreground font-medium">
                          Your public profile data
                        </p>
                      </div>
                    </div>

                    <form
                      onSubmit={handleProfileUpdate}
                      className="grid grid-cols-1 md:grid-cols-2 gap-6"
                    >
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground/80 flex items-center gap-2">
                          <User className="w-3.5 h-3.5" /> First Name
                        </label>
                        <Input
                          className="h-12 rounded-xl bg-background/50 border-border focus:ring-primary/20"
                          value={formData.firstName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              firstName: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground/80 flex items-center gap-2">
                          <User className="w-3.5 h-3.5" /> Last Name
                        </label>
                        <Input
                          className="h-12 rounded-xl bg-background/50 border-border"
                          value={formData.lastName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              lastName: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-bold text-foreground/80 flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5" /> Email Address
                        </label>
                        <Input
                          className="h-12 rounded-xl bg-background/50 border-border"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground/80 flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5" /> Phone Number
                        </label>
                        <Input
                          className="h-12 rounded-xl bg-background/50 border-border placeholder:text-muted-foreground/30"
                          value={formData.phone}
                          placeholder="+250 7xx xxx xxx"
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground/80 flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5" /> Department
                        </label>
                        <Input
                          className="h-12 rounded-xl bg-background/50 border-border placeholder:text-muted-foreground/30"
                          value={formData.department}
                          placeholder="e.g. Infrastructure, IT"
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              department: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-2 pt-4 flex justify-end">
                        <Button
                          type="submit"
                          disabled={loading}
                          className="h-12 px-8 rounded-full bg-primary font-bold text-sm"
                        >
                          {loading ? "Saving..." : "Update Profile Details"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </Card>
              ) : (
                <SecuritySettings />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
