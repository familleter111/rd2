import { ProjectOverview } from "@/components/project/project-overview";

export default async function Page({ params, searchParams }: PageProps<"/projets/[code]">) {
  const { code } = await params;
  const { configurer } = await searchParams;
  return <ProjectOverview slug={code} configure={configurer === "1"} />;
}
