import { ProjectFrame } from "@/components/project/project-frame";

export default async function ProjectLayout({ children, params }: LayoutProps<"/projets/[code]">) {
  const { code } = await params;
  return <ProjectFrame slug={code}>{children}</ProjectFrame>;
}
