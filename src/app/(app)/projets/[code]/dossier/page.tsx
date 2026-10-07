import type { Metadata } from "next";
import { ValidationView } from "@/components/validation/validation-view";

export const metadata: Metadata = { title: "Dossier de validation" };

export default async function Page({ params }: PageProps<"/projets/[code]/dossier">) {
  const { code } = await params;
  return <ValidationView slug={code} />;
}
