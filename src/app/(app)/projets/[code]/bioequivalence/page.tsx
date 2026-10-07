import type { Metadata } from "next";
import { BioequivalenceView } from "@/components/bioequivalence/bioequivalence-view";

export const metadata: Metadata = { title: "Stratégie de bioéquivalence" };

export default async function Page({ params }: PageProps<"/projets/[code]/bioequivalence">) {
  const { code } = await params;
  return <BioequivalenceView slug={code} />;
}
