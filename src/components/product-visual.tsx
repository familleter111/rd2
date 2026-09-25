"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import type { ProductKind } from "@/lib/types";

const VIEWBOX: Record<ProductKind, string> = {
  comprime: "12 16 98 64",
  creme: "18 16 84 76",
  solution: "26 7 68 86",
  gelule: "16 18 88 66",
};

/**
 * Vector product thumbnails (tablets, cream jar, vial, capsule) standing in for
 * the product photos of the mock-ups.
 */
export function ProductVisual({ kind, className, label }: { kind: ProductKind; className?: string; label?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#e6eef8] via-[#eef4fb] to-[#f8fbfe]",
        className,
      )}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox={VIEWBOX[kind]} className="h-[84%] w-[84%]" fill="none">
        <defs>
          <filter id={id("blur")} x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
          <linearGradient id={id("side")} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#bccadb" />
            <stop offset="0.45" stopColor="#eef2f7" />
            <stop offset="1" stopColor="#b6c4d6" />
          </linearGradient>
          <radialGradient id={id("face")} cx="0.4" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.7" stopColor="#f6f9fc" />
            <stop offset="1" stopColor="#dbe4ef" />
          </radialGradient>
          <linearGradient id={id("glass")} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#d7e8fa" stopOpacity="0.95" />
            <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.75" />
            <stop offset="1" stopColor="#c9dff6" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id={id("liquid")} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#d4e8fc" stopOpacity="0.85" />
            <stop offset="1" stopColor="#a9cdf3" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id={id("cap")} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#dfe5ec" />
            <stop offset="0.4" stopColor="#fbfcfd" />
            <stop offset="1" stopColor="#d3dbe5" />
          </linearGradient>
          <linearGradient id={id("jar")} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#dbe3ed" />
            <stop offset="0.38" stopColor="#ffffff" />
            <stop offset="0.72" stopColor="#f3f6fa" />
            <stop offset="1" stopColor="#cfd9e5" />
          </linearGradient>
          <linearGradient id={id("blue")} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#5aa2f0" />
            <stop offset="1" stopColor="#1d67c9" />
          </linearGradient>
        </defs>

        {kind === "comprime" && (
          <g>
            <ellipse cx="52" cy="64" rx="31" ry="7" fill="#7f97b6" opacity="0.45" filter={url("blur")} />
            <ellipse cx="86" cy="72" rx="16" ry="4.5" fill="#7f97b6" opacity="0.45" filter={url("blur")} />
            {/* Flat tablet */}
            <path d="M20 50 L20 58 A30 11 0 0 0 80 58 L80 50 A30 11 0 0 1 20 50 Z" fill={url("side")} />
            <ellipse cx="50" cy="50" rx="30" ry="11" fill={url("face")} stroke="#d9e2ec" strokeWidth="0.6" />
            <ellipse cx="50" cy="50" rx="26.5" ry="9.2" stroke="#e7edf4" strokeWidth="0.8" />
            <path d="M23.5 52 L76.5 48" stroke="#c9d5e3" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M23.5 52.9 L76.5 48.9" stroke="#ffffff" strokeWidth="0.7" strokeLinecap="round" />
            {/* Leaning tablet */}
            <g transform="translate(84 46) rotate(-16)">
              <ellipse cx="-6" cy="1" rx="16.5" ry="24" fill={url("side")} />
              <ellipse cx="0" cy="0" rx="16.5" ry="24" fill={url("face")} stroke="#d9e2ec" strokeWidth="0.6" />
              <ellipse cx="0" cy="0" rx="14" ry="21" stroke="#e7edf4" strokeWidth="0.8" />
              <path d="M0 -21 L0 21" stroke="#c9d5e3" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M0.9 -21 L0.9 21" stroke="#ffffff" strokeWidth="0.7" strokeLinecap="round" />
            </g>
          </g>
        )}

        {kind === "creme" && (
          <g>
            <ellipse cx="60" cy="84" rx="34" ry="5.5" fill="#8ea6c3" opacity="0.4" filter={url("blur")} />
            <path d="M26 47 L28.5 74 Q29 82 37 82 L83 82 Q91 82 91.5 74 L94 47 Z" fill={url("jar")} stroke="#d5deea" strokeWidth="0.6" />
            <path d="M28 62 Q60 66 92 62" stroke="#e4eaf2" strokeWidth="1" />
            <ellipse cx="60" cy="47" rx="34" ry="9" fill="#eef3f8" stroke="#d5deea" strokeWidth="0.6" />
            <ellipse cx="60" cy="47" rx="30.5" ry="7.2" fill="#fbfcfe" />
            <path
              d="M33 48 C33 41 41 37 49 36 C51 31 56 28 62 24 C61.5 29.5 66 31.5 72 33.5 C82 36.5 87.5 41.5 87 48 C76 52 44 52 33 48 Z"
              fill={url("face")}
              stroke="#dfe7f0"
              strokeWidth="0.7"
            />
            <path d="M42 42 C52 38.5 67 38.5 79 42" stroke="#e1e8f1" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M51 35.8 C56 33.8 62 33.6 67 34.6" stroke="#e1e8f1" strokeWidth="1.1" strokeLinecap="round" />
          </g>
        )}

        {kind === "solution" && (
          <g>
            <ellipse cx="60" cy="89" rx="22" ry="3.5" fill="#8ea6c3" opacity="0.45" filter={url("blur")} />
            <path
              d="M42 45 Q42 38.5 48 36.5 L52 34.5 L52 29 L68 29 L68 34.5 L72 36.5 Q78 38.5 78 45 L78 82 Q78 88 72 88 L48 88 Q42 88 42 82 Z"
              fill={url("glass")}
              stroke="#a9c4e2"
              strokeWidth="0.9"
            />
            <path d="M42.6 55 Q60 57.5 77.4 55 L77.4 82 Q77.4 87.4 72 87.4 L48 87.4 Q42.6 87.4 42.6 82 Z" fill={url("liquid")} />
            <ellipse cx="60" cy="55" rx="17.4" ry="1.8" fill="#e6f1fd" />
            <rect x="46" y="40" width="3.4" height="44" rx="1.7" fill="#ffffff" opacity="0.8" />
            <rect x="72.5" y="44" width="1.6" height="36" rx="0.8" fill="#ffffff" opacity="0.55" />
            <rect x="51" y="27" width="18" height="3.2" rx="1" fill="#cbd5e1" />
            <rect x="49" y="11" width="22" height="17" rx="3" fill={url("cap")} stroke="#cfd8e3" strokeWidth="0.6" />
            {[53, 57, 61, 65].map((x) => (
              <path key={x} d={`M${x} 13.5 L${x} 25.5`} stroke="#dde3ea" strokeWidth="0.8" />
            ))}
          </g>
        )}

        {kind === "gelule" && (
          <g>
            <ellipse cx="60" cy="76" rx="32" ry="5" fill="#7f97b6" opacity="0.45" filter={url("blur")} />
            <g transform="rotate(-24 60 52)">
              <rect x="54" y="41" width="42" height="22" rx="11" fill={url("jar")} stroke="#d5deea" strokeWidth="0.6" />
              <rect x="24" y="40" width="42" height="24" rx="12" fill={url("blue")} />
              <rect x="30" y="44" width="28" height="3" rx="1.5" fill="#ffffff" opacity="0.45" />
              <rect x="70" y="45" width="18" height="2.6" rx="1.3" fill="#ffffff" opacity="0.9" />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
