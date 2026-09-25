import type { Metadata } from "next";
import { ReviewsView } from "@/components/overview/reviews-view";

export const metadata: Metadata = { title: "Vue d'ensemble — Revues" };

export default function Page() {
  return <ReviewsView />;
}
