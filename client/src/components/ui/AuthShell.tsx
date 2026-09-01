import { motion } from "framer-motion";
import { ImigongoPattern } from "./ImigongoPattern";

/**
 * Shared chrome for the unauthenticated pages (login, forgot/reset password):
 * the Imigongo branding panel on the left, a centred form column on the right.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex bg-background overflow-hidden font-sans">
      {/* Left panel - Branding with Imigongo */}
      <div className="hidden lg:flex w-1/2 bg-[#001D3D] relative overflow-hidden items-center justify-center p-12 border-r border-white/4">
        <ImigongoPattern
          className="absolute inset-0 text-white mask-[linear-gradient(to_bottom_right,black_0%,transparent_40%,transparent_60%,black_100%)]"
          opacity={0.05}
          scale={1.5}
        />
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
            className="w-32 h-32 bg-white/10 backdrop-blur-2xl rounded-[2.5rem] flex items-center justify-center mb-12 relative group"
          >
            <div className="absolute inset-0 bg-white/5 rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <img
              src="/logortb.png"
              alt="RTB Logo"
              className="w-20 h-20 object-contain brightness-110"
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
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-black/40 to-transparent pointer-events-none" />
      </div>

      {/* Right panel - form column */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-size-[40px_40px] bg-[radial-gradient(#000_1px,transparent_1px)]" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md space-y-8 relative z-10"
        >
          <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            src="/logortb.png"
            alt="RTB Logo"
            className="w-24 h-24 object-contain lg:hidden mb-2 mx-auto"
          />

          {children}

          <div className="pt-6 border-t border-border/20 dark:border-blue-700/20 text-center">
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
