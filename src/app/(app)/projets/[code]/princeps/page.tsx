import type { Metadata } from "next";
import { PrincepsView } from "@/components/princeps/princeps-view";

export const metadata: Metadata = { title: "Fiche princeps" };

export default async function Page({ params }: PageProps<"/projets/[code]/princeps">) {
  const { code } = await params;
  return <PrincepsView slug={code} />;
}