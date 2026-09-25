import type { Metadata } from "next";
import { DeviationsList } from "@/components/deviations/deviations-list";

export const metadata: Metadata = { title: "Déviations du projet" };

export default async function Page({ params }: PageProps<"/projets/[code]/deviations">) {
  const { code } = await params;
  return <DeviationsList slug={code} />;
}
