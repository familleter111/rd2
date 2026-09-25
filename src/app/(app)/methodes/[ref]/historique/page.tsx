import type { Metadata } from "next";
import { MethodHistoryView } from "@/components/methods/method-history";

export const metadata: Metadata = { title: "Méthode — historique" };

export default async function Page({ params }: PageProps<"/methodes/[ref]/historique">) {
  const { ref } = await params;
  return <MethodHistoryView slug={ref} />;
}
