import type { Metadata } from "next";
import { SearchView } from "@/components/search/search-view";

export const metadata: Metadata = { title: "Recherche" };

export default async function Page({ searchParams }: PageProps<"/recherche">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  // Keyed by query so selection and tab reset for each new search.
  return <SearchView key={query} query={query} />;
}
