import type { Metadata } from "next";
import { DossierSectionView } from "@/components/dossiers/dossier-section";

export const metadata: Metadata = { title: "Section du dossier" };

export default async function Page({ params }: PageProps<"/dossiers/[code]/sections/[section]">) {
  const { code, section } = await params;
  return <DossierSectionView key={section} slug={code} sectionId={section} />;
}
