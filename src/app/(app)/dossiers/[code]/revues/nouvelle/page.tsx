import type { Metadata } from "next";
import { ReviewForm } from "@/components/dossiers/review-form";

export const metadata: Metadata = { title: "Préparer une revue" };

export default async function Page({ params }: PageProps<"/dossiers/[code]/revues/nouvelle">) {
  const { code } = await params;
  return <ReviewForm slug={code} />;
}
