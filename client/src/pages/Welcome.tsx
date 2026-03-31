import { useAuthorization } from "../hooks/useAuthorization";
import { Permission } from "../lib/permissions";
import { Link } from "react-router-dom";
import {
  Compass,
  Map,
  Building2,
  FileSearch,
  Settings,
  User,
  BarChart3,
  ArrowRight,
  Shield,
  Layers,
  MapPin,
} from "lucide-react";
import { motion } from "framer-motion";
import { ImigongoPattern } from "../components/ui/ImigongoPattern";

export default function Welcome() {
  const { user, isAuthorized } = useAuthorization();

  const firstName = user?.firstName || "User";
  const roleName = (
    typeof user?.role === "object" ? user.role?.name || "" : user?.role || ""
  )
    .replace(/_/g, " ")
    .toLowerCase();

  const accessLevelName =
    typeof user?.role === "object"
      ? user?.role?.accessLevel?.name || "System"
      : "System";

  // Dynamic greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Quick links based on user permissions
  const quickLinks = [
    {
      title: "Interactive Map",
      description:
        "Explore the nationwide 3D topological map and assess geographic infrastructure.",
      icon: Map,
      path: "/map",
      color: "from-blue-500 to-cyan-400",
      permission: Permission.VIEW_MAP,
    },
    {
      title: "Schools Directory",
      description:
        "Manage, review, and filter all registered TVET schools and facilities.",
      icon: Building2,
      path: "/schools",
      color: "from-indigo-500 to-purple-400",
      shadow: "shadow-indigo-500/30",
      permission: Permission.VIEW_SCHOOLS,
    },
    {
      title: "Decision Analytics",
      description:
        "Review priority algorithms and data-driven administrative forecasts.",
      icon: BarChart3,
      path: "/analytics",
      color: "from-emerald-500 to-teal-400",
      shadow: "shadow-emerald-500/30",
      permission: Permission.VIEW_ANALYTICS,
    },
    {
      title: "System Reports",
      description:
        "Export compliance reports and analyze aggregated institutional data.",
      icon: FileSearch,
      path: "/reports",
      color: "from-amber-500 to-orange-400",
      shadow: "shadow-amber-500/30",
      permission: Permission.EXPORT_REPORTS,
    },
    {
      title: "User Management",
      description:
        "Configure system roles, privileges, and invite new administrators.",
      icon: Settings,
      path: "/settings",
      color: "from-slate-600 to-slate-400",
      shadow: "shadow-slate-500/30",
      permission: Permission.MANAGE_USERS,
    },
  ].filter((link) => isAuthorized(link.permission));

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 300, damping: 24 },
    },
  };

  return (
    <div className="relative min-h-[calc(100vh-6rem)] w-full overflow-hidden rounded-[2.5rem] bg-linear-to-br from-background/95 to-background/50 dark:from-black dark:to-black backdrop-blur-3xl border border-border/20 font-sans shadow-none">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Full-screen Cultural Motif (Imigongo) with Gradient Fade */}
        <ImigongoPattern
          className="absolute inset-0 text-primary mask-[linear-gradient(to_bottom_right,black_0%,transparent_30%,transparent_70%,black_100%)]"
          opacity={0.08}
        />

        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full animate-pulse delay-700" />
        <div className="absolute inset-0 bg-size-[30px_30px] bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] opacity-[0.03]" />

        {/* Holographic Premium Watermark */}
        <div className="absolute top-[-5%] right-[-10%] opacity-[0.15] dark:opacity-[0.08] pointer-events-none hidden lg:block">
          <div className="relative flex items-center justify-center">
            {/* Soft glowing orb behind the logo */}
            <div className="absolute inset-0 bg-blue-400 blur-[100px] rounded-full mix-blend-screen opacity-50 animate-pulse" />
            <motion.img
              initial={{ opacity: 0, scale: 0.8, rotate: -15, y: 50 }}
              animate={{ opacity: 1, scale: 1, rotate: -5, y: 0 }}
              transition={{
                duration: 2.5,
                ease: "easeOut",
                type: "spring",
                stiffness: 40,
              }}
              src="/logortb.png"
              alt="RTB Holographic Watermark"
              className="w-[800px] h-[800px] object-contain opacity-50"
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 w-full h-full p-4 sm:p-6 md:p-10 lg:p-16 flex flex-col">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 mb-10 md:mb-16"
        >
          <div className="space-y-4 relative z-20">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl md:rounded-3xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 flex items-center justify-center p-3 sm:p-4 ring-1 ring-black/5 dark:ring-white/10 shrink-0"
              >
                <img
                  src="/logortb.png"
                  alt="RTB Logo"
                  className="w-full h-full object-contain"
                />
              </motion.div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20 backdrop-blur-md">
                <Shield className="w-3.5 h-3.5" />
                Authenticated Session
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-foreground leading-tight">
              {greeting}, <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-blue-500">
                {firstName}
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground font-medium max-w-2xl leading-relaxed">
              Welcome to the Rwanda TVET Board Centralized Infrastructure
              Platform. Your dashboard is ready.
            </p>
          </div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex flex-col gap-3 p-4 sm:p-5 rounded-2xl bg-card/60 backdrop-blur-xl w-full md:w-auto md:min-w-[280px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Active Profile
              </span>
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground capitalize">
                {roleName}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  {accessLevelName} Clearance
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Quick Links Grid */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Compass className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Quick Launch</h2>
          </div>

          {quickLinks.length > 0 ? (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {quickLinks.map((link) => (
                <motion.div key={link.title} variants={itemVariants}>
                  <Link to={link.path} className="block group h-full">
                    <div className="h-full p-6 rounded-3xl bg-card/40 backdrop-blur-sm border border-border/40 hover:bg-card/80 transition-all duration-300 hover:border-primary/30 hover:-translate-y-1 overflow-hidden relative">
                      {/* Hover Gradient Overlay */}
                      <div
                        className={`absolute top-0 right-0 w-32 h-32 bg-linear-to-bl ${link.color} opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500 rounded-full translate-x-10 -translate-y-10`}
                      />

                      <div className="relative z-10 flex flex-col h-full">
                        <div
                          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-linear-to-br ${link.color} flex items-center justify-center text-white mb-4 sm:mb-6 border border-white/20 shrink-0`}
                        >
                          <link.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 sm:mb-3 group-hover:text-primary transition-colors">
                          {link.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed flex-1">
                          {link.description}
                        </p>
                        <div className="flex items-center gap-2 mt-6 text-sm font-bold text-primary opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                          Launch Module <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-8 rounded-3xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-md max-w-2xl"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-amber-500/20 text-amber-600">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-700 dark:text-amber-500 mb-2">
                    Restricted Permissions
                  </h3>
                  <p className="text-sm text-amber-700/80 dark:text-amber-500/80 leading-relaxed">
                    It appears your account does not have authorization to
                    access any active modules. Please contact your system
                    administrator to update your profile privileges.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-auto pt-16 flex items-center justify-between text-xs font-medium text-muted-foreground/60 w-full"
        >
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" />
            <span>Kigali, Rwanda</span>
          </div>
          <span>&copy; {new Date().getFullYear()} Rwanda TVET Board</span>
        </motion.div>
      </div>
    </div>
  );
}
