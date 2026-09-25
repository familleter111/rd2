import type { Metadata } from "next";
import { DocumentsView } from "@/components/project/documents-view";

export const metadata: Metadata = { title: "Documents du projet" };

export default async function Page({ params, searchParams }: PageProps<"/projets/[code]/documents">) {
  const { code } = await params;
  const { doc } = await searchParams;
  const docId = typeof doc === "string" ? doc : undefined;
  return <DocumentsView key={docId ?? "all"} slug={code} initialDocId={docId} />;
}
