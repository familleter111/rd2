import type { Metadata } from "next";
import { ActivityDetail } from "@/components/activities/activity-detail";

export const metadata: Metadata = { title: "Activité" };

export default async function Page({ params }: PageProps<"/activites/[id]">) {
  const { id } = await params;
  return <ActivityDetail key={id} id={id} />;
}
