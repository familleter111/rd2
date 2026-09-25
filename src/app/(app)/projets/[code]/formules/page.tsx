import type { Metadata } from "next";
import { FormulasView } from "@/components/project/formulas-view";

export const metadata: Metadata = { title: "Versions de formule" };

export default async function Page({ params }: PageProps<"/projets/[code]/formules">) {
  const { code } = await params;
  return <FormulasView slug={code} />;
}
