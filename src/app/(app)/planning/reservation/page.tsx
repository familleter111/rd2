import type { Metadata } from "next";
import { ReservationForm } from "@/components/planning/reservation-form";

export const metadata: Metadata = { title: "Nouvelle réservation" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function Page({ searchParams }: PageProps<"/planning/reservation">) {
  const sp = await searchParams;
  const preset = {
    resourceId: str(sp.ressource) ?? "HPLC-01",
    date: str(sp.date) ?? "2026-10-07",
    start: str(sp.debut) ?? "11:00",
    end: str(sp.fin) ?? "13:00",
    projectCode: (str(sp.projet) ?? "CS-01").toUpperCase(),
    lotCode: str(sp.lot) ?? "LP-01",
    activity: str(sp.activite) ?? "Analyse Dosage PA",
  };
  return <ReservationForm key={JSON.stringify(preset)} preset={preset} />;
}
