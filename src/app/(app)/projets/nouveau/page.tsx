import type { Metadata } from "next";
import { NewProjectWizard, type WizardSource } from "@/components/projects/new-project-wizard";

export const metadata: Metadata = { title: "Nouveau projet" };

export default async function Page({ searchParams }: PageProps<"/projets/nouveau">) {
  const { brouillon, depuis, modele, demo } = await searchParams;
  const source: WizardSource =
    demo === "parcours" || demo === "verification" || demo === "erreurs"
      ? { kind: "demo", variant: demo }
      : brouillon === "1"
      ? { kind: "draft" }
      : typeof depuis === "string"
        ? { kind: "duplicate", slug: depuis }
        : typeof modele === "string"
          ? { kind: "template", family: modele }
          : { kind: "new" };
  return <NewProjectWizard key={JSON.stringify(source)} source={source} />;
}
