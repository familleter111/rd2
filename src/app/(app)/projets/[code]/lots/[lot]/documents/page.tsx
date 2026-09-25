import type { Metadata } from "next";
import { LotDocumentsView } from "@/components/lots/lot-extra";

export const metadata: Metadata = { title: "Lot pilote — documents" };

export default async function Page({ params }: PageProps<"/projets/[code]/lots/[lot]/documents">) {
  const { code, lot } = await params;
  return <LotDocumentsView slug={code} lotSlug={lot} />;
}
