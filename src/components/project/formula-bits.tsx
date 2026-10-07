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

const fr = (value: number, digits = 1) => value.toLocaleString("fr-FR", { maximumFractionDigits: digits });

/**
 * What 1 kg of the formula gives: number of units and mass of each role (active substance,
 * excipient, then the other roles). Needs a complete composition in mg, g or %.
 */
export function perKilogram(rows: Component[]) {
  const total = compositionTotal(rows);
  if (!total || total.total <= 0 || !["mg", "g", "%"].includes(total.unit)) return null;
  const roles = [...new Set(["Principe actif", "Excipient", ...rows.map((r) => r.role)])];
  const parts = roles
    .map((role) => {
      const sum = rows.filter((r) => r.role === role).reduce((a, r) => a + Number(r.qty.replace(",", ".")), 0);
      return { role, grams: (sum / total.total) * 1000, share: (sum / total.total) * 100 };
    })
    .filter((p) => p.grams > 0);
  // A composition in % has no unit mass: the number of units cannot be known.
  const unitGrams = total.unit === "mg" ? total.total / 1000 : total.unit === "g" ? total.total : null;
  return { units: unitGrams ? Math.floor(1000 / unitGrams) : null, parts };
}

/** Name of the units made from a formula ("comprimés", "gélules"…). */
export const unitLabelFor = (form: string) => (form === "Comprimé" ? "comprimés" : form === "Gélule" ? "gélules" : "unités");

/** Notice "Pour 1 kg de mélange": units obtained and mass of each role. */
export function PerKilogramNote({ rows, unitLabel = "unités", className }: { rows: Component[]; unitLabel?: string; className?: string }) {
  const result = perKilogram(rows);
  if (!result) return null;
  return (
    <div className={cn("flex gap-3 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3.5 text-[15px] text-ink-700", className)} role="note">
      <Weight className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
      <div className="min-w-0 flex-1">
        <p>
          Pour <strong className="text-ink-900">1 kg</strong> de mélange
          {result.units !== null && (
            <>
              {" "}
              : environ <strong className="text-ink-900">{fr(result.units, 0)} {unitLabel}</strong>
            </>
          )}
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {result.parts.map((p) => (
            <li key={p.role} className="rounded-md bg-white px-2.5 py-1 text-sm ring-1 ring-inset ring-brand-100">
              <span className="text-ink-600">{p.role} : </span>
              <strong className="text-ink-900">{fr(p.grams)} g</strong>
              <span className="text-ink-500"> ({fr(p.share)} %)</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
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
