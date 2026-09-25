import type { Metadata } from "next";
import { NewFormulaView } from "@/components/project/new-formula-view";

export const metadata: Metadata = { title: "Nouvelle formule" };

export default async function Page({ params, searchParams }: PageProps<"/projets/[code]/formules/nouvelle">) {
  const { code } = await params;
  const { parent } = await searchParams;
  const parentCode = typeof parent === "string" ? parent : undefined;
  return <NewFormulaView key={parentCode ?? "new"} slug={code} parentCode={parentCode} />;
}
