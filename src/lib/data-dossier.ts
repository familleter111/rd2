/**
 * Demonstration data of the documentation, dossier, transfer and configuration
 * modules (mock-ups 45 → 56).
 */
import { PEOPLE_LAB } from "./data-lab";
import type {
  Dossier,
  DossierModule,
  NotificationSetting,
  PathTemplate,
  ProjectDocument,
  RolePermission,
  TeamRole,
  TemplatePhase,
  Transfer,
} from "./types";

/* ------------------------------------------------------------------ */
/* Documents (screens 45–47)                                           */
/* ------------------------------------------------------------------ */

type DocPatch = Partial<ProjectDocument>;

const DOC_PATCHES: Record<string, DocPatch> = {
  "doc-cs-rf2": {
    name: "Rapport d'essais F2",
    fileName: "Rapport_essais_F2_v2.pdf",
    description: "Rapport des résultats des essais de la formule F2.",
    keywords: ["F2", "Essais", "Rapport"],
    createdAt: "2026-09-15T09:00",
    approvedVersion: 1,
    versions: [
      {
        version: 2,
        date: "2026-09-24T10:18",
        author: "Chef de projet",
        note: "Version actuelle",
        status: "Brouillon",
        file: "Rapport_essais_F2_v2.pdf",
        size: "1,2 Mo",
        motif: "Intégration des résultats du lot E-02.",
        reviewer: "Responsable développement",
      },
      {
        version: 1,
        date: "2026-09-15T09:00",
        author: "Chef de projet",
        note: "Création du document",
        status: "Approuvé",
        file: "Rapport_essais_F2_v1.pdf",
        size: "940 Ko",
        motif: "Premiers résultats du lot E-02.",
        approvedAt: "2026-09-16T11:30",
        approvedBy: "Responsable développement",
      },
    ],
  },
  "doc-cs-rs": {
    name: "Rapport de stabilité ST-02",
    status: "En revue",
    owner: "Pharmacien responsable",
    updatedAt: "2026-09-10T15:30",
    lot: "E-02",
    fileName: "Rapport_stabilite_ST-02_v1.pdf",
    description: "Rapport intermédiaire de l'étude de stabilité ST-02 (lot d'essai E-02).",
    keywords: ["Stabilité", "E-02"],
  },
  "doc-cs-mo-lp01": {
    fileName: "MO-LP-01_v1.pdf",
    description: "Mode opératoire de fabrication du lot pilote LP-01.",
    keywords: ["LP-01", "Fabrication"],
  },
  "doc-cs-plan-lp01": {
    name: "Dossier de lot LP-01",
    fileName: "Dossier_lot_LP-01_v1.pdf",
    description: "Dossier de fabrication du lot pilote LP-01.",
  },
  "doc-cs-mo2": { fileName: "Mode_operatoire_F2_v1.pdf", description: "Procédé de fabrication de la formule F2." },
};

const EXTRA_DOCUMENTS: ProjectDocument[] = [
  {
    id: "doc-cs-synth",
    projectCode: "CS-01",
    category: "CTD",
    name: "Synthèse de développement",
    type: "Rapport d'étude",
    version: 1,
    owner: "Responsable développement",
    updatedAt: "2026-09-05T11:20",
    status: "Brouillon",
    size: "740 Ko",
    fileType: "PDF",
    formula: "F2",
    fileName: "Synthese_developpement_v1.pdf",
    description: "Synthèse du développement galénique et analytique de la formule F2 (module 3.2.P.2).",
    keywords: ["F2", "Synthèse", "CTD"],
    createdAt: "2026-09-05T11:20",
    versions: [{ version: 1, date: "2026-09-05T11:20", author: "Responsable développement", note: "Création du document", status: "Brouillon", file: "Synthese_developpement_v1.pdf", size: "740 Ko" }],
  },
];

/** Adds the fields of the new document screens to the seed documents. */
export function enrichDocuments(docs: ProjectDocument[]): ProjectDocument[] {
  const patched = docs.map((d) => {
    const patch = DOC_PATCHES[d.id];
    const base = patch ? { ...d, ...patch } : d;
    return { ...base, versions: base.versions.map((v) => ({ status: v.version === base.version ? base.status : ("Approuvé" as const), ...v })) };
  });
  const csIndex = patched.findIndex((d) => d.projectCode !== "CS-01");
  return [...patched.slice(0, csIndex), ...EXTRA_DOCUMENTS, ...patched.slice(csIndex)];
}

/* ------------------------------------------------------------------ */
/* Dossier CTD (screens 48–49)                                         */
/* ------------------------------------------------------------------ */

function modules(): DossierModule[] {
  return [
    {
      n: 1,
      title: "Informations régionales",
      description: "Documents administratifs propres au pays de dépôt.",
      sections: [
        {
          id: "formulaire",
          code: "1.2",
          title: "Formulaire de demande",
          summary: "Formulaire administratif de demande d'autorisation.",
          icon: "doc",
          status: "À compléter",
          heading: "Formulaire de demande",
          intro: "Informations administratives du demandeur et du produit, à adapter au pays de dépôt.",
          parts: [
            { id: "demandeur", title: "Demandeur", text: "" },
            { id: "produit", title: "Produit", text: "" },
          ],
          proofs: [],
          links: [],
        },
        {
          id: "information-produit",
          code: "1.3",
          title: "Informations produit",
          summary: "Résumé des caractéristiques du produit et notice.",
          icon: "doc",
          status: "À compléter",
          heading: "Informations produit",
          intro: "Résumé des caractéristiques du produit (RCP), notice et étiquetage.",
          parts: [
            { id: "rcp", title: "Résumé des caractéristiques", text: "" },
            { id: "notice", title: "Notice", text: "" },
          ],
          proofs: [],
          links: [],
        },
      ],
    },
    {
      n: 2,
      title: "Résumés",
      description: "Résumés et aperçus des modules 3 à 5.",
      sections: [
        {
          id: "resume-qualite",
          code: "2.3",
          title: "Résumé global de la qualité",
          summary: "Synthèse des données qualité du module 3.",
          icon: "doc",
          status: "À compléter",
          heading: "Résumé global de la qualité",
          intro: "Synthèse des informations présentées dans le module 3.",
          parts: [{ id: "synthese", title: "Synthèse qualité", text: "" }],
          proofs: [],
          links: [],
        },
      ],
    },
    {
      n: 3,
      title: "Qualité",
      description: "Documentation relative à la qualité du médicament.",
      sections: [
        {
          id: "developpement",
          code: "3.2.P.2",
          title: "Développement pharmaceutique",
          summary: "Formulation, développement et optimisation du procédé.",
          icon: "settings",
          status: "À compléter",
          heading: "Comparaison des formules F1 et F2",
          intro:
            "La comparaison des formules F1 et F2 a été documentée sur la base des essais réalisés et des résultats disponibles. Les différences de composition et de procédé ont été évaluées afin de retenir la formule F2 pour la suite du développement.",
          parts: [
            {
              id: "composition",
              title: "Composition",
              text: "Les compositions des formules F1 et F2 sont présentées et comparées. Les différences majeures entre les deux formules sont décrites.",
            },
            { id: "choix", title: "Choix de formule", text: "Le choix de la formule F2 est justifié sur la base des résultats obtenus lors des essais comparatifs." },
            { id: "procede", title: "Procédé", text: "Le procédé de fabrication de la formule F2 est décrit et comparé à celui de F1." },
            { id: "justification", title: "Justification", text: "La formule F2 est retenue pour la suite du développement sur la base des éléments présentés ci-dessus." },
          ],
          proofs: [
            { id: "p-rf2", label: "Rapport F2 v2", kind: "Rapport d'essais", docId: "doc-cs-rf2" },
            { id: "p-dec", label: "Décision F2 approuvée", kind: "Décision", decision: true },
            { id: "p-mo2", label: "Mode opératoire v1", kind: "Procédure", docId: "doc-cs-mo2" },
          ],
          links: [
            { id: "l-1", proofId: "p-rf2", ref: "Section 2.1", partId: "composition" },
            { id: "l-2", proofId: "p-dec", ref: "Section 1", partId: "choix" },
            { id: "l-3", proofId: "p-mo2", ref: "Section 3", partId: "procede" },
            { id: "l-4", proofId: "p-dec", ref: "Section 2", partId: "justification" },
          ],
        },
        {
          id: "fabrication",
          code: "3.2.P.3",
          title: "Fabrication",
          summary: "Description du procédé et contrôles associés.",
          icon: "factory",
          status: "En revue",
          heading: "Procédé de fabrication du lot pilote",
          intro: "Description du procédé de fabrication de la formule F2 à l'échelle pilote et des contrôles en cours de fabrication.",
          parts: [
            {
              id: "description",
              title: "Description du procédé",
              text: "Le procédé du lot pilote LP-01 (pesée, mélange, compression, conditionnement) est décrit selon le mode opératoire MO-LP-01.",
            },
            {
              id: "controles-ipc",
              title: "Contrôles en cours de fabrication",
              text: "Les contrôles en cours de fabrication (masse unitaire, dureté, friabilité) et leurs spécifications sont présentés.",
            },
          ],
          proofs: [{ id: "p-molp", label: "Mode opératoire MO-LP-01 v1", kind: "Procédure", docId: "doc-cs-mo-lp01" }],
          links: [
            { id: "l-5", proofId: "p-molp", ref: "Section 2", partId: "description" },
            { id: "l-6", proofId: "p-molp", ref: "Section 5", partId: "controles-ipc" },
          ],
          submittedAt: "2026-09-22T16:00",
        },
        {
          id: "controle",
          code: "3.2.P.5",
          title: "Contrôle du produit fini",
          summary: "Spécifications, méthodes et résultats de contrôle.",
          icon: "flask",
          status: "À compléter",
          heading: "Contrôle du produit fini",
          intro: "Spécifications du produit fini, méthodes analytiques et résultats des lots.",
          parts: [
            { id: "specifications", title: "Spécifications", text: "Les spécifications du produit fini (aspect, teneur, dissolution, uniformité) sont à consolider." },
            { id: "methodes", title: "Méthodes analytiques", text: "La méthode de dosage M-01 est décrite ; sa validation est en cours." },
          ],
          proofs: [{ id: "p-m01", label: "Méthode M-01 — Dosage PA", kind: "Méthode analytique", docId: "doc-cs-m01" }],
          links: [{ id: "l-7", proofId: "p-m01", ref: "Section 1", partId: "methodes" }],
        },
        {
          id: "stabilite",
          code: "3.2.P.8",
          title: "Stabilité",
          summary: "Études de stabilité et analyse des résultats.",
          icon: "chart",
          status: "À compléter",
          heading: "Stabilité",
          intro: "Protocole, résultats et conclusions des études de stabilité.",
          parts: [
            { id: "protocole", title: "Protocole de stabilité", text: "Les conditions de stockage et les échéances de l'étude de stabilité sont décrites." },
            { id: "resultats", title: "Résultats et conclusions", text: "" },
          ],
          proofs: [{ id: "p-ps", label: "Protocole de stabilité CS-01", kind: "Protocole", docId: "doc-cs-ps" }],
          links: [{ id: "l-8", proofId: "p-ps", ref: "Section 1", partId: "protocole" }],
        },
      ],
    },
    {
      n: 4,
      title: "Rapports non cliniques",
      description: "Études non cliniques ; à évaluer selon le type de demande.",
      sections: [
        {
          id: "non-clinique",
          code: "4.2",
          title: "Études non cliniques",
          summary: "Rapports d'études non cliniques, si applicable.",
          icon: "doc",
          status: "À évaluer",
          heading: "Études non cliniques",
          intro: "Applicabilité à évaluer : les demandes génériques s'appuient généralement sur la littérature.",
          parts: [{ id: "applicabilite", title: "Applicabilité", text: "" }],
          proofs: [],
          links: [],
        },
      ],
    },
    {
      n: 5,
      title: "Rapports cliniques",
      description: "Études cliniques ; à évaluer selon le type de demande.",
      sections: [
        {
          id: "clinique",
          code: "5.3",
          title: "Études de bioéquivalence",
          summary: "Rapports d'études cliniques, si applicable.",
          icon: "doc",
          status: "À évaluer",
          heading: "Études de bioéquivalence",
          intro: "Applicabilité à évaluer selon la stratégie de dépôt.",
          parts: [{ id: "strategie", title: "Stratégie", text: "" }],
          proofs: [],
          links: [],
        },
      ],
    },
  ];
}

export function dossiers(): Dossier[] {
  return [
    {
      projectCode: "CS-01",
      formula: "F2",
      modules: modules(),
      requirements: [
        {
          id: "req-stab",
          module: 3,
          label: "Rapport de stabilité consolidé",
          detail: "Document attendu dans cette section.",
          kind: "document",
          sectionId: "stabilite",
          docName: "Rapport de stabilité consolidé",
          docType: "Étude de stabilité",
        },
        {
          id: "req-synth",
          module: 3,
          label: "Synthèse à approuver",
          detail: "Version finale de la synthèse qualité.",
          kind: "approbation",
          sectionId: "developpement",
          docName: "Synthèse de développement",
          docType: "Rapport d'étude",
          docId: "doc-cs-synth",
        },
      ],
      exports: [],
    },
  ];
}

/** Example values of the review form (screen 50) and of the decision (screen 51). */
export const REVIEW_EXAMPLE = {
  type: "Revue de développement",
  date: "2026-10-20",
  participants: ["Chef de projet", "Responsable développement", "Qualité"],
  objet: "Revue de développement du comprimé 100 mg F2, en vue de la préparation du dossier et du transfert.",
  documents: ["doc-cs-synth", "doc-cs-rf2", "doc-cs-plan-lp01"],
  expected: "Évaluer la préparation du dossier et du transfert.",
  justification: "Module 3 complété : synthèse de développement approuvée et rapport de stabilité consolidé ajouté.",
};

export const DECISION_EXAMPLE = {
  justification: "Compléter les pièces documentaires avant transfert.",
  reserve: { description: "Joindre la version approuvée de la synthèse.", owner: "Développement", due: "2026-10-23", blocking: true },
};

export const REVIEW_TYPES_DOSSIER = ["Revue de développement", "Revue qualité", "Revue de transfert"];
export const REVIEW_PARTICIPANTS = ["Chef de projet", "Responsable développement", "Qualité", "Pharmacien responsable", "Production"];
export const RESERVE_OWNERS = ["Développement", "Qualité", "Production", "Chef de projet"];

/* ------------------------------------------------------------------ */
/* Transfer (screen 53)                                                */
/* ------------------------------------------------------------------ */

export function transfers(): Transfer[] {
  return [
    {
      projectCode: "CS-01",
      status: "À préparer",
      sourceTeam: "Équipe R&D",
      targetTeam: "Équipe Production",
      owner: PEOPLE_LAB.marie.name,
      documents: [
        { id: "t-formule", title: "Formule F2", code: "FOR-CS-01-F2", version: "Version 2.0", date: "2026-09-12", docId: "doc-cs-fc2" },
        { id: "t-mo", title: "Mode opératoire de fabrication", code: "MO-LP-01", version: "Version 1.0", date: "2026-09-24", docId: "doc-cs-mo-lp01" },
        { id: "t-rapport", title: "Rapport du lot pilote", code: "RAP-LP-01", version: "Version 1.0", date: "2026-10-09" },
        { id: "t-methodes", title: "Méthodes de contrôle", code: "MCO-CS-01", version: "Version 2.1", date: "2026-09-10", docId: "doc-cs-m01" },
      ],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Configuration (screens 54–55)                                       */
/* ------------------------------------------------------------------ */

const PERMISSIONS: Omit<RolePermission, "enabled">[] = [
  { key: "consulter", label: "Consulter projets assignés", detail: "Voir les projets, documents et historiques des projets affectés." },
  { key: "saisir", label: "Saisir résultats", detail: "Saisir les résultats d'essais et de contrôles." },
  { key: "soumettre", label: "Soumettre pour revue", detail: "Soumettre des résultats, protocoles ou sections de dossier pour revue." },
  {
    key: "approuverPropres",
    label: "Approuver ses propres résultats",
    detail: "Déconseillé : un résultat doit être approuvé par une autre personne que celle qui l'a saisi.",
  },
  { key: "gererRoles", label: "Gérer les rôles", detail: "Modifier les rôles, les droits et les membres de l'espace R&D." },
];

const perms = (enabled: string[]): RolePermission[] => PERMISSIONS.map((p) => ({ ...p, enabled: enabled.includes(p.key) }));

export function roles(): TeamRole[] {
  return [
    {
      id: "chef",
      name: "Chef de projet",
      description: "Pilote les projets et coordonne les activités.",
      icon: "user",
      permissions: perms(["consulter", "soumettre"]),
      scope: "Projets assignés",
      members: [{ name: "Chef de projet", role: "Chef de projet" }],
    },
    {
      id: "developpement",
      name: "Développement",
      description: "Réalise les études et les essais.",
      icon: "users",
      permissions: perms(["consulter", "saisir", "soumettre"]),
      scope: "Projets assignés",
      members: [PEOPLE_LAB.claireM, PEOPLE_LAB.claireD, PEOPLE_LAB.sophie],
    },
    {
      id: "analyste",
      name: "Analyste laboratoire",
      description: "Réalise les essais et saisit les résultats.",
      icon: "flask",
      permissions: perms(["consulter", "saisir", "soumettre"]),
      scope: "Projets assignés",
      members: [PEOPLE_LAB.marie, PEOPLE_LAB.julien],
    },
    {
      id: "qualite",
      name: "Qualité",
      description: "Revoit et valide les éléments du dossier.",
      icon: "shield",
      permissions: perms(["consulter", "soumettre"]),
      scope: "Tous les projets",
      members: [PEOPLE_LAB.marieL, PEOPLE_LAB.thomas, PEOPLE_LAB.paul],
    },
    {
      id: "production",
      name: "Production",
      description: "Prépare la production et le transfert.",
      icon: "factory",
      permissions: perms(["consulter", "saisir"]),
      scope: "Projets assignés",
      members: [PEOPLE_LAB.julie],
    },
  ];
}

/** People that can be added to a role. */
export const DIRECTORY = [
  PEOPLE_LAB.sophie,
  PEOPLE_LAB.thomas,
  PEOPLE_LAB.claireD,
  PEOPLE_LAB.marc,
  PEOPLE_LAB.marie,
  PEOPLE_LAB.julie,
  PEOPLE_LAB.julien,
  PEOPLE_LAB.paul,
  PEOPLE_LAB.marieL,
  PEOPLE_LAB.claireM,
];

const item = (id: string, label: string, icon: TemplatePhase["activities"][number]["icon"]) => ({ id, label, icon });

function standardPhases(develop: [string, string], confirm: [string, string, string]): TemplatePhase[] {
  return [
    {
      key: "cadrer",
      title: "Cadrer",
      description: "Évaluer la faisabilité et réunir les prérequis.",
      activities: [item("a-faisabilite", "Analyse de faisabilité", "doc"), item("a-prerequis", "Vérification des prérequis", "list")],
      proofs: [item("p-faisabilite", "Rapport de faisabilité", "doc"), item("p-prerequis", "Liste des prérequis complétée", "doc")],
    },
    {
      key: "developper",
      title: "Développer",
      description: "Développer les formules et réaliser les essais.",
      activities: [item("a-formules", develop[0], "flask"), item("a-essais", develop[1], "list")],
      proofs: [item("p-formules", "Dossiers de formules", "doc"), item("p-essais", "Rapports d'essais", "doc")],
    },
    {
      key: "confirmer",
      title: "Confirmer",
      description: "Produire un lot pilote, réaliser les contrôles et suivre la stabilité.",
      activities: [item("a-pilote", confirm[0], "settings"), item("a-controles", confirm[1], "check"), item("a-stabilite", confirm[2], "chart")],
      proofs: [item("p-pilote", "Dossier de lot pilote", "doc"), item("p-controles", "Rapports de contrôles", "doc"), item("p-stabilite", "Résultats de stabilité", "doc")],
    },
    {
      key: "deposer",
      title: "Déposer & transférer",
      description: "Préparer le dossier, réaliser la revue et assurer le transfert.",
      activities: [item("a-dossier", "Préparation du dossier", "doc"), item("a-revue", "Revue", "users"), item("a-transfert", "Transfert", "arrow")],
      proofs: [item("p-dossier", "Dossier final", "doc"), item("p-revue", "Compte-rendu de revue", "doc"), item("p-transfert", "Document de transfert", "doc")],
    },
  ];
}

export function templates(): PathTemplate[] {
  return [
    {
      id: "tpl-seche",
      name: "Forme sèche orale",
      family: "Sèche",
      projectTemplate: "Modèle forme sèche",
      versions: [
        {
          version: 1,
          status: "Actif",
          createdAt: "2026-01-05",
          note: "Version initiale",
          phases: standardPhases(["Développement des formules", "Réalisation des essais"], ["Fabrication du lot pilote", "Contrôles", "Suivi de stabilité"]),
        },
      ],
    },
    {
      id: "tpl-semi-solide",
      name: "Forme semi-solide",
      family: "Semi-solide",
      projectTemplate: "Modèle forme semi-solide",
      versions: [
        {
          version: 1,
          status: "Actif",
          createdAt: "2026-02-10",
          note: "Version initiale",
          phases: standardPhases(["Développement de l'émulsion", "Essais de viscosité et de pH"], ["Fabrication du lot pilote", "Contrôles", "Suivi de stabilité"]),
        },
      ],
    },
    {
      id: "tpl-liquide",
      name: "Forme liquide",
      family: "Liquide",
      projectTemplate: "Modèle forme liquide",
      versions: [
        {
          version: 1,
          status: "Brouillon",
          createdAt: "2026-09-02",
          note: "En préparation",
          phases: standardPhases(["Développement de la solution", "Essais de stérilité et de pH"], ["Fabrication du lot pilote", "Contrôles", "Suivi de stabilité"]),
        },
      ],
    },
  ];
}

export function notificationSettings(): NotificationSetting[] {
  return [
    { id: "ns-decision", label: "Décision à examiner", detail: "Une décision ou un protocole attend votre avis.", app: true, email: true },
    { id: "ns-resultats", label: "Résultats à valider", detail: "Des résultats d'essais sont soumis pour revue.", app: true, email: true },
    { id: "ns-conflit", label: "Conflit de réservation", detail: "Une ressource demandée est déjà réservée.", app: true, email: false },
    { id: "ns-deviation", label: "Déviation déclarée", detail: "Une déviation est déclarée sur un lot de vos projets.", app: true, email: true },
    { id: "ns-stabilite", label: "Échéance de stabilité", detail: "Une échéance d'étude de stabilité approche.", app: true, email: false },
    { id: "ns-reserve", label: "Réserve à lever", detail: "Une réserve de revue vous est affectée.", app: true, email: true },
  ];
}
