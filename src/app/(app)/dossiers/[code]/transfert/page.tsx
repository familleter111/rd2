import type { Metadata } from "next";
import { TransferView } from "@/components/dossiers/transfer-view";

export const metadata: Metadata = { title: "Transfert du projet" };

export default async function Page({ params }: PageProps<"/dossiers/[code]/transfert">) {
  const { code } = await params;
  return <TransferView slug={code} />;
}
