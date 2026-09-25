import type { Metadata } from "next";
import { MethodTestsView } from "@/components/methods/method-tests";

export const metadata: Metadata = { title: "Méthode — préparer les essais" };

export default async function Page({ params }: PageProps<"/methodes/[ref]/essais">) {
  const { ref } = await params;
  return <MethodTestsView slug={ref} />;
}
