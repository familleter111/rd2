import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page";
import { LinkTabs } from "@/components/ui/tabs";

const TABS = [
  { href: "/vue-ensemble", label: "Synthèse", guide: 4 },
  { href: "/vue-ensemble/priorites", label: "Mes priorités", guide: 2 },
  { href: "/vue-ensemble/revues", label: "Revues", guide: 3 },
];

export function OverviewHeader({
  subtitle,
  action,
  tabActions,
}: {
  subtitle: string;
  action?: ReactNode;
  tabActions?: ReactNode;
}) {
  return (
    <div>
      <PageHeader title="Vue d'ensemble" subtitle={subtitle} actions={action} />
      <LinkTabs items={TABS} actions={tabActions} className="mt-4" />
    </div>
  );
}
