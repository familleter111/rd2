import { LotFrame } from "@/components/lots/lot-frame";

export default async function LotLayout({ children, params }: LayoutProps<"/projets/[code]/lots/[lot]">) {
  const { code, lot } = await params;
  return (
    <LotFrame slug={code} lotSlug={lot}>
      {children}
    </LotFrame>
  );
}
