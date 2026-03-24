import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { api } from "../lib/api";
import { Lock, Mail, Loader2, Globe, ShieldCheck } from "lucide-react";
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
      <div className="hidden lg:flex w-1/2 bg-imigongo-dark relative overflow-hidden items-center justify-center p-12">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse delay-700" />
        </div>

        <div className="relative z-10 text-white max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-10 border border-white/20"
          >
            <Globe className="w-10 h-10 text-white animate-spin-slow" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h1 className="text-6xl font-black tracking-tighter mb-8 leading-[1.1]">
              RTB GIS <br />
              <span className="text-primary-foreground/80">Intelligence</span>
            </h1>
            <p className="text-xl text-blue-100/80 font-medium leading-relaxed mb-12">
              National platform for data-driven decisions on school
              infrastructure and geospatial analysis.
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
              Trusted by 500+ <br />
              Institutions nationwide
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
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-10 relative z-10"
        >
          <div className="text-center lg:text-left space-y-2">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-4"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Secure Access
            </motion.div>
            <h2 className="text-4xl font-extrabold tracking-tight text-foreground">
              Welcome Back
            </h2>
            <p className="text-muted-foreground font-medium">
              Securely sign in to the GIS dashboard
            </p>
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
                <label className="text-sm font-bold text-foreground/80 ml-1">
                  Email Address
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex h-12 w-full rounded-xl border border-input bg-background/50 backdrop-blur-sm pl-12 pr-4 py-2 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
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
                    className="flex h-12 w-full rounded-xl border border-input bg-background/50 backdrop-blur-sm pl-12 pr-4 py-2 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying Identity...
                </>
              ) : (
                "Sign In to Account"
              )}
            </motion.button>
          </form>

          <div className="pt-6 border-t border-border/20 text-center">
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
