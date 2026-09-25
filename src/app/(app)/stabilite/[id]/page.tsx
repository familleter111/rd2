import type { Metadata } from "next";
import { StudyView } from "@/components/stability/study-view";

export const metadata: Metadata = { title: "Protocole de stabilité" };

export default async function Page({ params }: PageProps<"/stabilite/[id]">) {
  const { id } = await params;
  return <StudyView key={id} id={id} />;
}
