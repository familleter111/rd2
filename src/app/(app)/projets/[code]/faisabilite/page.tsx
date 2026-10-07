import type { Metadata } from "next";
import { FeasibilityView } from "@/components/feasibility/feasibility-view";

export const metadata: Metadata = { title: "Faisabilité du projet" };

export default async function Page({ params }: PageProps<"/projets/[code]/faisabilite">) {
  const { code } = await params;
  return <FeasibilityView slug={code} />;
}