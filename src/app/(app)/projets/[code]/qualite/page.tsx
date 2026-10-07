import type { Metadata } from "next";
import { QualityView } from "@/components/quality/quality-view";

export const metadata: Metadata = { title: "Qualité et lot pilote" };

export default async function Page({ params }: PageProps<"/projets/[code]/qualite">) {
  const { code } = await params;
  return <QualityView slug={code} />;
}
