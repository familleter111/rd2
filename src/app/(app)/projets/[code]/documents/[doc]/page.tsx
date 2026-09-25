import type { Metadata } from "next";
import { DocumentDetail, type DocSection } from "@/components/project/document-detail";

export const metadata: Metadata = { title: "Document du projet" };

const SECTIONS: DocSection[] = ["informations", "versions", "commentaires", "tracabilite"];

export default async function Page({ params, searchParams }: PageProps<"/projets/[code]/documents/[doc]">) {
  const { code, doc } = await params;
  const { section, "nouvelle-version": newVersion } = await searchParams;
  const initialSection = SECTIONS.find((s) => s === section);
  const mode = newVersion === "exemple" ? "exemple" : newVersion ? "vide" : undefined;
  return <DocumentDetail key={`${doc}-${mode}-${initialSection}`} slug={code} docId={doc} initialSection={initialSection} newVersion={mode} />;
}
