import type { Metadata } from "next";
import { CadrageView } from "@/components/cadrage/cadrage-view";

export const metadata: Metadata = { title: "Cadrage du projet" };

export default async function Page({ params }: PageProps<"/projets/[code]/cadrage">) {
  const { code } = await params;
  return <CadrageView slug={code} />;
}
