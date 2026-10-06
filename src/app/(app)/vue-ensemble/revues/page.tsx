import type { Metadata } from "next";
import { ReviewsView } from "@/components/overview/reviews-view";

export const metadata: Metadata = { title: "Vue d'ensemble — Revues" };

export default async function Page({ searchParams }: PageProps<"/vue-ensemble/revues">) {
  const { planifier } = await searchParams;
  const planFor = typeof planifier === "string" ? planifier.toLowerCase() : undefined;
  return <ReviewsView key={planFor ?? "revues"} planFor={planFor} />;
}
