import type { Metadata } from "next";
import { ProjectClosure } from "@/components/project/project-closure";

export const metadata: Metadata = { title: "Clôture du projet" };

export default async function Page({ params, searchParams }: PageProps<"/projets/[code]/cloture">) {
  const { code } = await params;
  const { confirmer } = await searchParams;
  return <ProjectClosure key={String(confirmer)} slug={code} confirm={confirmer === "1"} />;
}
