import type { Metadata } from "next";
import { ReviewsList } from "@/components/dossiers/reviews-list";

export const metadata: Metadata = { title: "Revues du dossier" };

export default async function Page({ params }: PageProps<"/dossiers/[code]/revues">) {
  const { code } = await params;
  return <ReviewsList slug={code} />;
}
