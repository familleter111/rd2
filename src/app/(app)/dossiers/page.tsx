import type { Metadata } from "next";
import { DossiersList } from "@/components/dossiers/dossiers-list";

export const metadata: Metadata = { title: "Dossiers & revues" };

export default function Page() {
  return <DossiersList />;
}
