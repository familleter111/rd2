import { ArrowRight, type LucideIcon } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";

/** Placeholder for navigation entries whose mock-ups are not delivered yet. */
export function ComingSoon({
  title,
  subtitle,
  icon: Icon,
  items,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  items: string[];
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="mt-8 flex flex-col items-center px-6 py-14 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon className="h-8 w-8" strokeWidth={1.6} aria-hidden />
        </span>
        <h2 className="mt-5 text-xl font-bold text-ink-900">Écran prévu dans une prochaine étape</h2>
        <p className="mt-2 max-w-lg text-[15px] text-ink-600">
          Cet écran sera disponible dans une prochaine version. Les éléments suivants y seront regroupés :
        </p>
        <ul className="mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
          {items.map((item) => (
            <li key={item} className="rounded-lg border border-line bg-subtle px-3 py-1.5 text-sm text-ink-700">
              {item}
            </li>
          ))}
        </ul>
        <LinkButton href="/vue-ensemble" variant="outline" className="mt-8" iconRight={<ArrowRight className="h-4 w-4" />}>
          Retour à la vue d&apos;ensemble
        </LinkButton>
      </Card>
    </>
  );
}
