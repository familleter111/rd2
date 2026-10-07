import type { Metadata } from "next";
import { NewProjectFlow } from "@/components/cadrage/new-project-flow";
import { NewProjectWizard, type WizardSource } from "@/components/projects/new-project-wizard";
import { AI_STAGES, type AiStage } from "@/lib/data-ai";

export const metadata: Metadata = { title: "Nouveau projet" };

export default async function Page({ searchParams }: PageProps<"/projets/nouveau">) {
  const { brouillon, depuis, modele, demo, ia } = await searchParams;
  // Previous wizard, still reached by the guided tour, a saved draft, a duplication or a template.
  const legacy: WizardSource | null =
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
              : null;
  if (legacy) return <NewProjectWizard key={JSON.stringify(legacy)} source={legacy} />;
  // Étape 0 of the decision-support pathway: start from the reference medicine.
  return <NewProjectFlow />;
}
