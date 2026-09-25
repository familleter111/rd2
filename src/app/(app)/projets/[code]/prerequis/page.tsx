import type { Metadata } from "next";
import { PrerequisitesView } from "@/components/project/prerequisites-view";

export const metadata: Metadata = { title: "Prérequis du projet" };

export default async function Page({ params, searchParams }: PageProps<"/projets/[code]/prerequis">) {
  const { code } = await params;
  const { demande } = await searchParams;
  const request = typeof demande === "string" ? demande : undefined;
  return <PrerequisitesView key={request ?? "list"} slug={code} openRequestFor={request} />;
}
