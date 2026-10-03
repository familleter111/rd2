/**
 * People offered in the "responsable", "analyste", "destinataire"… lists.
 * The demonstration uses its fictitious team; a blank workspace uses the signed-in user and the
 * members added in "Configuration → Rôles et accès".
 */
import { CURRENT_USER } from "./catalog";
import { useDemo } from "./store";
import type { Person } from "./types";

export function useTeam(demoPeople: Person[]): Person[] {
  const { demo, roles } = useDemo();
  if (demo) return demoPeople;
  const team: Person[] = [{ name: CURRENT_USER, role: CURRENT_USER }];
  for (const role of roles) {
    for (const m of role.members) {
      if (!team.some((p) => p.name === m.name)) team.push({ name: m.name, role: m.role || role.name });
    }
  }
  return team;
}

export function useTeamNames(demoNames: string[]): string[] {
  const { demo } = useDemo();
  const team = useTeam([]);
  return demo ? demoNames : team.map((p) => p.name);
}
