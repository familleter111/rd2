import type { Metadata } from "next";
import { ReservesView } from "@/components/dossiers/reserves-view";

export const metadata: Metadata = { title: "Réserves du dossier" };

export default async function Page({ params }: PageProps<"/dossiers/[code]/reserves">) {
  const { code } = await params;
  return <ReservesView slug={code} />;
}
