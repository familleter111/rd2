import type { Metadata } from "next";
import { FormulationView } from "@/components/formulation/formulation-view";

export const metadata: Metadata = { title: "Formulation et essais" };

export default async function Page({ params }: PageProps<"/projets/[code]/formulation">) {
  const { code } = await params;
  return <FormulationView slug={code} />;
}