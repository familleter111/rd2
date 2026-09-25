import type { Metadata } from "next";
import { MethodReferenceView } from "@/components/methods/method-reference";

export const metadata: Metadata = { title: "Méthode — référence" };

export default async function Page({ params }: PageProps<"/methodes/[ref]">) {
  const { ref } = await params;
  return <MethodReferenceView slug={ref} />;
}
