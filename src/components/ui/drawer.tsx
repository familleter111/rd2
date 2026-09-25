"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";
import { useModalBehavior, useMounted } from "./overlay";

const EASE = [0.25, 0.46, 0.45, 0.94] as const;

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Icon displayed before the title; defaults to the blue accent bar. */
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: "right" | "left";
  widthClass?: string;
  bodyClassName?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  side = "right",
  widthClass = "max-w-[460px]",
  bodyClassName,
}: DrawerProps) {
  const mounted = useMounted();
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalBehavior(open, onClose, panelRef);

  if (!mounted) return null;
  const offset = reduce ? 0 : side === "right" ? 48 : -48;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="drawer" className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-ink-900/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ willChange: "opacity" }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={cn(
              "absolute top-0 flex h-full w-full flex-col bg-white shadow-pop outline-none",
              side === "right" ? "right-0" : "left-0",
              widthClass,
            )}
            initial={{ x: offset, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: offset, opacity: 0 }}
            transition={{ duration: 0.26, ease: EASE }}
            style={{ willChange: "transform, opacity" }}
          >
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
              <div className="flex min-w-0 items-start gap-3">
                {icon ?? <span className="mt-1 h-7 w-1 shrink-0 rounded-full bg-brand-600" aria-hidden />}
                <div className="min-w-0">
                  <h2 id={titleId} className="text-2xl font-bold tracking-tight text-ink-900">
                    {title}
                  </h2>
                  {subtitle && <p className="mt-1 text-[15px] text-ink-500">{subtitle}</p>}
                </div>
              </div>
              <IconButton label="Fermer" onClick={onClose} className="-mr-2">
                <X className="h-5 w-5" />
              </IconButton>
            </div>
            <div className={cn("flex-1 overflow-y-auto px-6 pb-6", bodyClassName)}>{children}</div>
            {footer && <div className="border-t border-line bg-white px-6 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
