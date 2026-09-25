import type { Metadata } from "next";
import { ProjectsView } from "@/components/projects/projects-view";

export const metadata: Metadata = { title: "Projets" };

export default async function Page({ searchParams }: PageProps<"/projets">) {
  const { vue } = await searchParams;
  const initial = vue === "liste" ? "liste" : vue === "archives" ? "archives" : "cartes";
  return <ProjectsView key={initial} initialView={initial} />;
}
