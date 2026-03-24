import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  titleBadge?: ReactNode; // Optional badge or text above the title
  icon?: LucideIcon;
  customIcon?: ReactNode; // Optional full custom icon node (bypasses default styling)
  backButton?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  titleBadge,
  icon: Icon,
  customIcon,
  backButton,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl sm:rounded-3xl bg-linear-to-br from-white/70 via-white/40 to-white dark:from-blue-800/20 dark:via-blue-800/10 dark:to-blue-800/20 border border-border/10 px-5 py-4 sm:px-5 sm:py-5 backdrop-blur-xl shrink-0",
        className,
      )}
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2"></div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          {backButton && <div className="shrink-0">{backButton}</div>}
          {customIcon && <div className="shrink-0">{customIcon}</div>}
          {Icon && !customIcon && (
            <div className="w-10 h-10 rounded-[14px] bg-linear-to-br from-primary to-blue-600 flex items-center justify-center shadow-none rotate-3 shrink-0">
              <Icon className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="flex flex-col justify-center min-w-0">
            {titleBadge && <div className="mb-0.5">{titleBadge}</div>}

            <div className="flex items-center gap-3 mb-0.5">
              {typeof title === "string" ? (
                <h2 className="text-xl font-black tracking-tight text-foreground leading-none">
                  {title}
                </h2>
              ) : (
                title
              )}
            </div>

            {description &&
              (typeof description === "string" ? (
                <p className="text-muted-foreground mt-1 font-normal text-[12px] tracking-widest">
                  {description}
                </p>
              ) : (
                <div className="mt-1">{description}</div>
              ))}
          </div>
        </div>

        {actions && (
          <div className="w-full lg:w-auto shrink-0 flex items-center gap-3 no-scrollbar pb-1 lg:pb-0 overflow-x-auto">
            {actions}
          </div>
        )}
      </div>
    </motion.div>
  );
}
