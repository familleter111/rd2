import type { Metadata } from "next";
import { ProjectStabilityView } from "@/components/stability/project-stability-view";

export const metadata: Metadata = { title: "Stabilité du projet" };

export default async function Page({ params }: PageProps<"/projets/[code]/stabilite">) {
  const { code } = await params;
  return <ProjectStabilityView slug={code} />;
}
