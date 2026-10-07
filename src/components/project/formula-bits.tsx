import {
  Archive,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  Droplet,
  Eye,
  FlaskConical,
  Hammer,
  Pencil,
  ShieldCheck,
  Star,
  TestTube,
  Timer,
  TriangleAlert,
  Waves,
  Weight,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { Component, FormulaStatus, TestStatus, Tone } from "@/lib/types";

const FORMULA_STATUS: Record<FormulaStatus, { tone: Tone; icon: LucideIcon }> = {
  Référence: { tone: "neutral", icon: Star },
  Brouillon: { tone: "warn", icon: Pencil },
  "Essais en cours": { tone: "info", icon: FlaskConical },
  "Essais terminés": { tone: "info", icon: CircleCheck },
  "À améliorer": { tone: "warn", icon: TriangleAlert },
  Retenue: { tone: "success", icon: CircleCheck },
  Archivée: { tone: "neutral", icon: Archive },
};

export function FormulaStatusBadge({ status, size = "md" }: { status: FormulaStatus; size?: "sm" | "md" }) {
  const s = FORMULA_STATUS[status];
  return (
    <Badge tone={s.tone} icon={s.icon} size={size}>
      {status}
    </Badge>
  );
}

export const CRITERION_ICONS: Record<string, LucideIcon> = {
  Aspect: Eye,
  "Masse unitaire": Weight,
  Désagrégation: Waves,
  Dureté: Hammer,
  Friabilité: Timer,
  Dissolution: Droplet,
  pH: TestTube,
  Dosage: FlaskConical,
  Stérilité: ShieldCheck,
};

const TEST_STYLE: Record<TestStatus, { icon: LucideIcon; text: string; iconClass: string; label: string }> = {
  Conforme: { icon: CircleCheck, text: "text-success-700", iconClass: "fill-success-500 text-white", label: "Conforme" },
  "Non conforme": { icon: CircleX, text: "text-danger-700", iconClass: "fill-danger-500 text-white", label: "Non conforme" },
  "En attente": { icon: Clock, text: "text-warn-700", iconClass: "text-warn-600", label: "Résultat encore attendu" },
  "Non démarré": { icon: CircleDashed, text: "text-ink-500", iconClass: "text-ink-400", label: "Non démarré" },
};

/** Coloured test status ("✔ Conforme", "⏱ Résultat encore attendu"…). */
export function TestStatusText({ status, short, className }: { status?: TestStatus; short?: boolean; className?: string }) {
  if (!status) return <span className="text-sm text-ink-400">—</span>;
  const s = TEST_STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-medium", s.text, className)}>
      <s.icon className={cn("h-[18px] w-[18px] shrink-0", s.iconClass)} aria-hidden />
      {short && status === "En attente" ? "En attente" : s.label}
    </span>
  );
}

/** Sum of the composition when every quantity is filled with the same unit. */
export function compositionTotal(rows: Component[]) {
  if (!rows.length) return null;
  const unit = rows[0].unit;
  if (!rows.every((r) => r.unit === unit)) return null;
  const values = rows.map((r) => Number(r.qty.replace(",", ".")));
  if (rows.some((r) => !r.qty.trim()) || values.some((v) => Number.isNaN(v))) return null;
  const total = Math.round(values.reduce((a, b) => a + b, 0) * 1000) / 1000;
  return { total, unit };
}

export function CompositionTable({ rows }: { rows: Component[] }) {
  const total = compositionTotal(rows);
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-line text-ink-500">
          <th className="py-2 pr-3 font-medium">Composant</th>
          <th className="py-2 pr-3 font-medium">Rôle</th>
          <th className="py-2 text-right font-medium">Quantité</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line/70">
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="py-2 pr-3 text-ink-900">{r.name}</td>
            <td className="py-2 pr-3 text-ink-600">{r.role}</td>
            <td className="py-2 text-right tabular-nums text-ink-900">
              {r.qty || "—"} {r.qty && r.unit}
            </td>
          </tr>
        ))}
      </tbody>
      {total && (
        <tfoot>
          <tr className="border-t border-line-strong font-semibold">
            <td className="py-2 pr-3 text-ink-900" colSpan={2}>
              Total
            </td>
            <td className="py-2 text-right tabular-nums text-ink-900">
              {String(total.total).replace(".", ",")} {total.unit}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
