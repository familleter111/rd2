import type { Metadata } from "next";
import { NewProjectWizard, type WizardSource } from "@/components/projects/new-project-wizard";
import { AI_STAGES, type AiStage } from "@/lib/data-ai";

export const metadata: Metadata = { title: "Nouveau projet" };

export default async function Page({ searchParams }: PageProps<"/projets/nouveau">) {
  const { brouillon, depuis, modele, demo, ia } = await searchParams;
  const source: WizardSource =
    demo === "parcours" || demo === "verification" || demo === "erreurs"
      ? { kind: "demo", variant: demo }
      : typeof ia === "string" && (AI_STAGES as string[]).includes(ia)
        ? { kind: "ia", stage: ia as AiStage }
        : brouillon === "1"
          ? { kind: "draft" }
          : typeof depuis === "string"
            ? { kind: "duplicate", slug: depuis }
            : typeof modele === "string"
              ? { kind: "template", family: modele }
              : { kind: "new" };
  return <NewProjectWizard key={JSON.stringify(source)} source={source} />;
}
