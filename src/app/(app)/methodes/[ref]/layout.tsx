import { MethodFrame } from "@/components/methods/method-frame";

export default async function MethodLayout({ children, params }: LayoutProps<"/methodes/[ref]">) {
  const { ref } = await params;
  return <MethodFrame slug={ref}>{children}</MethodFrame>;
}
