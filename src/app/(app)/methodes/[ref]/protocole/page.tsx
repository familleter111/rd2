import type { Metadata } from "next";
import { MethodProtocolView } from "@/components/methods/method-protocol";

export const metadata: Metadata = { title: "Méthode — protocole" };

export default async function Page({ params }: PageProps<"/methodes/[ref]/protocole">) {
  const { ref } = await params;
  return <MethodProtocolView slug={ref} />;
}
