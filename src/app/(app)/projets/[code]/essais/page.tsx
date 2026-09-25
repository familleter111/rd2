import type { Metadata } from "next";
import { TestsView } from "@/components/project/tests-view";

export const metadata: Metadata = { title: "Essais du projet" };

export default async function Page({ params }: PageProps<"/projets/[code]/essais">) {
  const { code } = await params;
  return <TestsView slug={code} />;
}
