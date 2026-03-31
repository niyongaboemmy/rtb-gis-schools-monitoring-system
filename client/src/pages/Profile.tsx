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
import { api } from "../lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "../components/ui/page-header";
import { cn } from "../lib/utils";

export default function Profile() {
  const { user, updateUser } = useAuthStore();
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

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length > 7) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const strengthScore = getPasswordStrength(passwordData.newPassword);

  const getStrengthWord = (score: number) => {
    if (score === 0) return "Empty";
    if (score < 3) return "Weak";
    if (score < 5) return "Medium";
    return "Strong";
  };

  const accessLevelName =
    typeof user?.role === "object" && user?.role !== null
      ? (user.role as any)?.accessLevel?.name ?? null
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
      const { data } = await api.patch(`/users/me/profile`, formData);
      updateUser(data);
      setMessage({ text: "Profile updated successfully", type: "success" });
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || "Failed to update profile",
        type: "error",
      });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage({ text: "", type: "" }), 5000);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ text: "New passwords do not match", type: "error" });
      return;
    }
    if (strengthScore < 5) {
      setMessage({ text: "Please use a stronger password.", type: "error" });
      return;
    }

    setLoading(true);
    try {
      await api.patch(`/users/me/password`, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setMessage({ text: "Password updated successfully", type: "success" });
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || "Failed to update password",
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
          <div className="relative group mr-4">
            <div className="w-32 h-32 rounded-3xl bg-linear-to-br from-primary to-blue-600 flex items-center justify-center text-white text-4xl font-black rotate-3 group-hover:rotate-0 transition-transform duration-500">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-white dark:bg-gray-900 border border-border flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
          </div>
        }
        title={<>{user?.firstName} {user?.lastName}</>}
        titleBadge={
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest border border-primary/10">
              {typeof user?.role === "string"
                ? user.role.replace("_", " ")
                : (user?.role as any)?.name?.replace("_", " ")}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
              <Mail className="w-4 h-4" /> {user?.email}
            </span>
          </div>
        }
        description={
          <div className="flex flex-col gap-3 mt-2">
            {(accessLevelName || scopeLabel) && (
              <div className="flex flex-wrap items-center gap-3 py-2 px-3 bg-card border border-border/40 rounded-xl w-fit">
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
              for the RTB GIS Platform.
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
              onClick={() => setActiveTab(tab.id as any)}
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
                  <div className="p-8 space-y-6">
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
                <Card className="bg-card/60 border border-border/20 backdrop-blur-xl overflow-hidden rounded-3xl shadow-none">
                  <div className="p-8 space-y-6">
                    <div className="flex items-center gap-3 pb-4">
                      <div className="p-2 rounded-xl bg-primary/10">
                        <Lock className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">Account Security</h4>
                        <p className="text-xs text-muted-foreground font-medium">
                          Protect your identity
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handlePasswordUpdate} className="space-y-8">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground/80">
                          Current Password
                        </label>
                        <Input
                          type="password"
                          required
                          className="h-12 rounded-xl bg-background/50 border-border"
                          value={passwordData.currentPassword}
                          onChange={(e) =>
                            setPasswordData({
                              ...passwordData,
                              currentPassword: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground/80">
                              New Password
                            </label>
                            <Input
                              type="password"
                              required
                              className="h-12 rounded-xl bg-background/50 border-border"
                              value={passwordData.newPassword}
                              onChange={(e) =>
                                setPasswordData({
                                  ...passwordData,
                                  newPassword: e.target.value,
                                })
                              }
                            />
                          </div>

                          {/* Advanced Strength Indicator */}
                          <div className="p-5 rounded-2xl bg-black/5 dark:bg-white/5 space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Security level
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1",
                                  strengthScore < 1
                                    ? "text-muted-foreground"
                                    : strengthScore < 3
                                      ? "text-destructive"
                                      : strengthScore < 5
                                        ? "text-amber-500"
                                        : "text-emerald-500",
                                )}
                              >
                                {getStrengthWord(strengthScore)}
                              </span>
                            </div>

                            <div className="flex gap-1.5 h-1.5 w-full">
                              {[1, 2, 3, 4, 5].map((level) => (
                                <motion.div
                                  key={level}
                                  initial={false}
                                  animate={{
                                    backgroundColor:
                                      level <= strengthScore
                                        ? strengthScore < 3
                                          ? "#ef4444"
                                          : strengthScore < 5
                                            ? "#f59e0b"
                                            : "#10b981"
                                        : "rgba(156, 163, 175, 0.2)",
                                  }}
                                  className="flex-1 rounded-full transition-colors duration-500"
                                />
                              ))}
                            </div>

                            <div className="grid grid-cols-1 gap-2 pt-2">
                              {[
                                {
                                  text: "Minimum 8 characters",
                                  check: passwordData.newPassword.length > 7,
                                },
                                {
                                  text: "Include capital letter",
                                  check: /[A-Z]/.test(passwordData.newPassword),
                                },
                                {
                                  text: "Include number",
                                  check: /[0-9]/.test(passwordData.newPassword),
                                },
                                {
                                  text: "Special character (!@#$)",
                                  check: /[^A-Za-z0-9]/.test(
                                    passwordData.newPassword,
                                  ),
                                },
                              ].map((req, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-2"
                                >
                                  {req.check ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30" />
                                  )}
                                  <span
                                    className={cn(
                                      "text-[10px] font-bold transition-colors duration-300",
                                      req.check
                                        ? "text-emerald-500"
                                        : "text-muted-foreground/60",
                                    )}
                                  >
                                    {req.text}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground/80">
                              Confirm New Password
                            </label>
                            <Input
                              type="password"
                              required
                              className={cn(
                                "h-12 rounded-xl bg-background/50 border-border",
                                passwordData.confirmPassword &&
                                  passwordData.newPassword !==
                                    passwordData.confirmPassword &&
                                  "border-destructive/50 focus:ring-destructive/20",
                              )}
                              value={passwordData.confirmPassword}
                              onChange={(e) =>
                                setPasswordData({
                                  ...passwordData,
                                  confirmPassword: e.target.value,
                                })
                              }
                            />
                            {passwordData.confirmPassword &&
                              passwordData.newPassword !==
                                passwordData.confirmPassword && (
                                <p className="text-[10px] font-bold text-destructive">
                                  Passwords do not match
                                </p>
                              )}
                          </div>

                          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-600 dark:text-amber-500 font-medium leading-relaxed">
                            <Lock className="w-3 h-3 inline mr-1 mb-0.5" />
                            Security Tip: Avoid using the same password across
                            multiple platforms for better safety.
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 flex justify-end">
                        <Button
                          type="submit"
                          variant="secondary"
                          disabled={
                            loading ||
                            strengthScore < 5 ||
                            passwordData.newPassword !==
                              passwordData.confirmPassword
                          }
                          className="h-12 px-8 rounded-full font-black text-sm transition-all duration-300 active:scale-95"
                        >
                          {loading
                            ? "Syncing..."
                            : "Update Application Security"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
