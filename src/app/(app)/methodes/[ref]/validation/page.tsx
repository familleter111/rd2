import type { Metadata } from "next";
import { MethodValidationView } from "@/components/methods/method-validation";

export const metadata: Metadata = { title: "Méthode — validation" };

export default async function Page({ params, searchParams }: PageProps<"/methodes/[ref]/validation">) {
  const { ref } = await params;
  const { correction } = await searchParams;
  return <MethodValidationView key={correction === "1" ? "correction" : "revue"} slug={ref} openCorrection={correction === "1"} />;
}
