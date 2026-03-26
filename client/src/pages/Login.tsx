import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { api } from "../lib/api";
import { Lock, Mail, Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const [email, setEmail] = useState("admin@rtb.gov.rw");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/login", { email, password });
      setAuth(
        response.data.accessToken,
        response.data.refreshToken,
        response.data.user,
      );
      navigate("/");
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Login failed. Please verify credentials.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background overflow-hidden font-sans">
      {/* Left panel - Branding with Imigongo */}
      <div className="hidden lg:flex w-1/2 bg-[#001D3D] relative overflow-hidden items-center justify-center p-12">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-blue-600/30 blur-[150px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-indigo-600/20 blur-[150px] rounded-full animate-pulse delay-1000" />
          <div className="absolute top-[30%] right-[10%] w-[150px] h-[150px] bg-primary/20 blur-[80px] rounded-full animate-bounce-slow" />
        </div>

        <div className="relative z-10 text-white max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, type: "spring" }}
            className="w-32 h-32 bg-white/10 backdrop-blur-2xl rounded-[2.5rem] flex items-center justify-center mb-12 border border-white/20 shadow-2xl relative group"
          >
            <div className="absolute inset-0 bg-white/5 rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <img
              src="/logortb.png"
              alt="RTB Logo"
              className="w-20 h-20 object-contain drop-shadow-2xl brightness-110"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h1 className="text-7xl font-black tracking-tighter mb-10 leading-none text-transparent bg-clip-text bg-linear-to-br from-white via-white to-blue-300">
              National GIS <br />
              <span className="text-primary-foreground/90 font-bold italic text-5xl">
                Infrastructure
              </span>
            </h1>
            <p className="text-xl text-blue-100/70 font-medium leading-relaxed mb-14 max-w-md border-l-2 border-primary/40 pl-6">
              Empowering TVET transformation through advanced geospatial
              intelligence and data-driven infrastructure monitoring.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex items-center gap-6"
          >
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-center text-[10px] font-bold"
                >
                  JS
                </div>
              ))}
            </div>
            <p className="text-sm text-blue-200/60 font-medium">
              More than 500+ <br />
              schools monitored
            </p>
          </motion.div>
        </div>

        {/* Imigongo lines decorative element at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-black/40 to-transparent pointer-events-none" />
      </div>

      {/* Right panel - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background relative">
        {/* Subtle background pattern for light mode */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-size-[20px_20px] bg-[radial-gradient(#000_1px,transparent_1px)]" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md space-y-8 relative z-10"
        >
          <div className="flex flex-col items-center lg:items-start space-y-6">
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              src="/logortb.png"
              alt="RTB Logo"
              className="w-24 h-24 object-contain lg:hidden mb-2"
            />
            
            <div className="space-y-3">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-2 border border-primary/10 shadow-sm"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                SYSTEM ACCESS PORTAL
              </motion.div>
              <h2 className="text-5xl font-black tracking-tight text-foreground leading-tight">
                Authentification
              </h2>
              <p className="text-muted-foreground font-medium text-lg">
                Enter your credentials to manage the platform
              </p>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20 text-center"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-5">
              <div className="space-y-2.5">
                <div className="pb-1">
                  <label className="text-sm font-bold text-foreground/80 ml-1">
                    Email Address
                  </label>
                </div>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex h-12 w-full rounded-xl border border-input dark:border-blue-700/30 bg-background/50 backdrop-blur-sm pl-12 pr-4 py-2 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="admin@rtb.gov.rw"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-sm font-bold text-foreground/80">
                    Password
                  </label>
                  <a
                    href="#"
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    Forgot Password?
                  </a>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex h-12 w-full rounded-xl border border-input dark:border-blue-700/30 bg-background/50 backdrop-blur-sm pl-12 pr-4 py-2 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02, translateY: -2 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full h-14 rounded-2xl bg-primary px-6 text-base font-bold text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-[0_10px_30px_-10px_rgba(var(--primary),0.5)] group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Access GIS Dashboard
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </motion.button>
          </form>

          <div className="pt-6 border-t border-border/20 dark:border-blue-700/30 text-center">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Rwanda TVET Board Monitoring Platform &copy; 2026. <br />
              Authorized personnel only. Data usage is monitored.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
