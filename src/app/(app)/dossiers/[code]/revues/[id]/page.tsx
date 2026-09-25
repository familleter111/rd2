import type { Metadata } from "next";
import { ReviewDecision } from "@/components/dossiers/review-decision";

export const metadata: Metadata = { title: "Décision de revue" };

export default async function Page({ params }: PageProps<"/dossiers/[code]/revues/[id]">) {
  const { code, id } = await params;
  return <ReviewDecision key={id} slug={code} reviewId={id} />;
}
