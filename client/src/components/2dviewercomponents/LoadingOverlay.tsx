import React from "react";

interface LoadingOverlayProps {
  isLoading: boolean;
  loadingProgress: number;
  loadingMessage: string;
  loadingStartTime: number;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  loadingProgress,
  loadingMessage,
  loadingStartTime,
}) => {
  if (!isLoading) return null;

  return (
    <div className="absolute inset-0 z-100 flex flex-col items-center justify-center bg-[#0a0d14]/90 backdrop-blur-xl transition-all duration-700">
      {/* Decorative background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-md px-8 text-center animate-in fade-in zoom-in duration-500">
        {/* Main Visual: Animated Scanning Ring */}
        <div className="relative mx-auto mb-10 h-32 w-32">
          <div className="absolute inset-0 rounded-full border-4 border-white/5" />
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray="301.59"
              strokeDashoffset={301.59 - (301.59 * loadingProgress) / 100}
              className="text-blue-500 transition-all duration-700 ease-out"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className="text-3xl font-bold text-white tabular-nums tracking-tight">
                {Math.round(loadingProgress)}%
              </span>
            </div>
          </div>
          {/* Spinning highlight */}
          <div 
            className="absolute inset-0 rounded-full border-t-2 border-blue-400/40" 
            style={{ animation: "spin 1.5s linear infinite" }}
          />
        </div>

        <div className="space-y-2 mb-8">
          <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-sm">
            Synchronising School Assets
          </h2>
          <div className="flex flex-col items-center gap-1">
            <span className="text-blue-400 font-semibold text-xs py-1 px-3 rounded-full bg-blue-500/10 border border-blue-500/20 inline-block uppercase tracking-widest">
              {loadingMessage}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm mb-10 shadow-inner">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Session Elapsed</p>
            <p className="text-lg font-mono font-medium text-white/90">
              {Math.floor((Date.now() - loadingStartTime) / 1000)}s
            </p>
          </div>
        </div>

        {/* Progress Bar Container */}
        <div className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-4 shadow-inner">
          <div 
            className="h-full bg-linear-to-r from-blue-600 via-indigo-500 to-blue-400 transition-all duration-700 ease-out"
            style={{ 
              width: `${loadingProgress}%`,
              boxShadow: "0 0 16px rgba(59,130,246,0.6)"
            }}
          />
          <div className="absolute inset-y-0 left-0 w-full h-full opacity-20 bg-shimmer pointer-events-none" />
        </div>
        
        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/30 px-1">
          <span>System Integrity Validated</span>
          <span className="text-blue-400/60 animate-pulse">Initializing GIS engine…</span>
        </div>
      </div>
    </div>
  );
};
