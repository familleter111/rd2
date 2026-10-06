export type Tone = "info" | "warn" | "danger" | "success" | "neutral";

export type Family = "Sèche" | "Liquide" | "Semi-solide";

/** Visual used for product thumbnails. */
export type ProductKind = "comprime" | "gelule" | "creme" | "solution";

export type StageIcon = "flask" | "chart" | "compass";

export interface Labelled {
  label: string;
  tone: Tone;
}

export interface TeamMember {
  role: string;
  person: string;
}

export type GlobalStatus = "En cours" | "En attente" | "En bonne voie";

export interface Project {
  code: string;
  slug: string;
  name: string;
  kind: ProductKind;
  family: Family;
  form: string;
  /** Short label, e.g. "Forme sèche orale". */
  formLabel: string;
  /** Label used on the portfolio rows. */
  portfolioSubtitle: string;
  description: string;
  dci: string;
  dosage: string;
  countries: string[];
  referenceProduct: string;
  template: string;
  /** Development stage shown as a badge (also used by the "Phase" filter). */
  stage: { label: string; icon: StageIcon };
  phase: string;
  phaseTone: Tone;
  /** Step of the R&D pathway shown on the project cards. */
  track: Labelled;
  objective: { title: string; detail: string };
  nextAction: { date: string; label: string };
  nextStep: string;
  targetDate: string;
  globalStatus: GlobalStatus;
  owner: string;
  team: TeamMember[];
  createdAt: string;
  updatedAt: string;
  /** Current step of the 4-step R&D pathway (1 → 4). */
  journeyStep: 1 | 2 | 3 | 4;
  milestone: { title: string; detail: string; date: string; blocker?: string; owner: string };
  portfolioAction: { label: string; href: string; variant: "primary" | "outline" };
  archived: boolean;
  /** Closure of the project (screen 56): the project is then archived, read-only. */
  closedAt?: string;
  closeReason?: string;
  /** Scoping sheet written during the "Lancer le cadrage" activity. */
  scope?: ProjectScope;
}

export interface ProjectScope {
  objective: string;
  strategy: string;
  markets: string[];
  included: string;
  excluded: string;
  risks: string;
  savedAt: string;
  /** Set when the scoping activity is validated. */
  validatedAt?: string;
}

export type PrerequisiteCategory = "Documents" | "Matières" | "Ressources";

/** Reception of a prerequisite (screen 12): missing → requested / expected → received → verified. */
export type PrerequisiteStatus = "Non disponible" | "En cours de réception" | "Reçu" | "Vérifié";

export type PrerequisiteImportance = "Très importante" | "Importante" | "Normale";

export type PrerequisiteQuality = "Non disponible" | "À vérifier" | "Conforme" | "Non conforme";

export interface PrerequisiteFile {
  name: string;
  size: string;
  pages?: number;
  /** Information checked in the import dialog (screen 13). */
  fields?: { label: string; value: string }[];
}

export interface Prerequisite {
  id: string;
  projectCode: string;
  category: PrerequisiteCategory;
  name: string;
  /** Description shown under the title of the detail panel. */
  detail: string;
  /** Department in charge of the piece ("Responsable"). */
  source: string;
  importance: PrerequisiteImportance;
  quality: PrerequisiteQuality;
  icon: "doc" | "flask" | "sample";
  status: PrerequisiteStatus;
  /** Version or nature of the supporting piece ("v3", "DMF/CEP", "Dossier complet"). */
  reference?: string;
  /** Verification date, or expected reception date. */
  date?: string;
  /** Agreement of "Vérifié" in the list ("Vérifiée", "Vérifiés"). */
  agreement?: "f" | "pl";
  /** The review cannot be prepared while it is not verified (named in the alert). */
  blocking?: boolean;
  requestRef?: string;
  documentId?: string;
  file?: PrerequisiteFile;
  /** Set when a document was imported and checked (screen 13). */
  importedAt?: string;
  defaultJustification?: string;
}

export type RequestType = "Document" | "Matière" | "Réactif";

export interface SupplyRequest {
  ref: string;
  projectCode: string;
  type: RequestType;
  object: string;
  recipient: string;
  supplier: string;
  wishedDate: string;
  justification: string;
  prerequisiteId?: string;
  status: "À traiter" | "En cours" | "Traitée";
  createdAt: string;
}

/** Column of "Mes activités" (the `done` flag always wins over it). */
export type ActivityState = "a-faire" | "en-cours" | "en-revue" | "terminee";

export interface ActivityDocument {
  name: string;
  type: string;
  date: string;
}

export interface ActivityComment {
  id: string;
  author: string;
  text: string;
  at: string;
}

export interface Activity {
  id: string;
  projectCode: string;
  title: string;
  detail: string;
  tags: string[];
  status: Labelled;
  due: string;
  owner: string;
  icon: "doc" | "box" | "flask" | "review";
  done: boolean;
  /* Fields used by "Mes activités" (screens 29–30). */
  state?: ActivityState;
  /** Role of the owner when `owner` is a person ("Responsable production"). */
  ownerRole?: string;
  /** Object the activity is about ("Essai ECH-03", "Équipement HPLC-01"). */
  context?: string;
  description?: string;
  urgent?: boolean;
  priority?: "Normale" | "Haute";
  formula?: string;
  lotCode?: string;
  methodRef?: string;
  analysisId?: string;
  /** Resource the activity asks to book (the activity is closed once it is reserved). */
  reservationFor?: string;
  prerequisiteNote?: { title: string; detail: string };
  documents?: ActivityDocument[];
  comments?: ActivityComment[];
  /**
   * "preparation-lot": steps are derived from the pilot-lot conditions.
   * "cadrage", "plan-galenique", "plan-analytique": steps are derived from the work done in the project.
   */
  kind?: "preparation-lot" | "correction" | "reservation" | "standard" | "cadrage" | "plan-galenique" | "plan-analytique";
  href?: string;
}

export type PriorityGroup = "urgent" | "examiner" | "preparer";

export interface Priority {
  id: string;
  projectCode: string;
  group: PriorityGroup;
  horizon: "today" | "week" | "waiting";
  title: string;
  description: string;
  badge?: Labelled;
  meta: { icon: "doc" | "folder" | "calendar"; label: string }[];
  action: { label: string; href?: string; kind?: "remind" };
  due: string;
  assignee: string;
  done: boolean;
  requiresDecision?: boolean;
  detail: {
    formula: string;
    projectStatus: Labelled;
    prerequisite: { label: string; ok: boolean };
    lot: { label: string; href: string };
    source: { label: string; href: string };
    note: string;
  };
}

export type ReviewStatus = "a-preparer" | "en-cours" | "cloturee";
export type ChecklistState = "done" | "warn" | "todo";

export interface ReviewParticipant {
  role: string;
  part: "Organise" | "Contribue" | "Approuve";
}

export interface Review {
  id: string;
  projectCode: string;
  title: string;
  type: string;
  status: ReviewStatus;
  date: string;
  preparedBy: string;
  participants: ReviewParticipant[];
  badge: Labelled;
  cta: { label: string; href?: string };
  icon: "flask" | "pill" | "chart" | "doc";
  checklist: { id: string; label: string; detail: string; state: ChecklistState }[];
  submittedAt?: string;
  /* Closure of the review: conclusion and minutes. */
  closedAt?: string;
  outcome?: ReviewOutcome;
  summary?: string;
}

export type ReviewOutcome = "Favorable" | "Favorable avec réserves" | "Défavorable";

export interface PendingDecision {
  id: string;
  projectCode: string;
  title: string;
  detail: string;
  status: Labelled;
  href: string;
  icon: "flask" | "doc";
}

export type FormulaStatus =
  | "Référence"
  | "Brouillon"
  | "Essais en cours"
  | "Essais terminés"
  | "À améliorer"
  | "Retenue"
  | "Archivée";

export interface Component {
  id: string;
  name: string;
  role: string;
  qty: string;
  unit: string;
}

export interface Formula {
  id: string;
  projectCode: string;
  code: string;
  revision: string;
  status: FormulaStatus;
  label: string;
  description: string;
  parent?: string;
  createdAt: string;
  createdBy: string;
  composition: Component[];
  process: string[];
  motif?: string;
  sources?: string[];
}

export type LotType = "Essai" | "Pilote" | "Échantillon";
export type LotStatus = "Disponible" | "En cours" | "Planifié";

export interface Lot {
  id: string;
  projectCode: string;
  code: string;
  type: LotType;
  formula: string;
  quantity: number;
  unit: string;
  status: LotStatus;
  createdAt: string;
  owner: string;
  comment: string;
}

export interface Sample {
  id: string;
  projectCode: string;
  lotCode: string;
  code: string;
  type: "Contrôle" | "Stabilité" | "Rétention";
  quantity: number;
  unit: string;
  date: string;
  status: "Prélevé" | "Planifié";
  analyses: number;
}

export type TestStatus = "Conforme" | "Non conforme" | "En attente" | "Non démarré";

export interface TestResult {
  id: string;
  projectCode: string;
  /** Lot code, or "REF" for the reference product. */
  lotCode: string;
  formula: string;
  criterion: string;
  method?: string;
  status: TestStatus;
  result?: string;
  date?: string;
  /** Acceptance criterion ("Q ≥ 80 % en 30 min"). */
  spec?: string;
}

export type DocStatus = "Brouillon" | "Approuvé" | "À revoir" | "En revue";

export type DocCategory =
  | "Références"
  | "Formulation"
  | "Méthodes"
  | "Lots & contrôles"
  | "Stabilité"
  | "CTD";

export interface DocVersion {
  version: number;
  date: string;
  author: string;
  note: string;
  /* Screens 45–47: status, file and review of each version. */
  status?: DocStatus;
  file?: string;
  size?: string;
  motif?: string;
  reviewer?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface DocComment {
  id: string;
  author: string;
  at: string;
  text: string;
}

export interface ProjectDocument {
  id: string;
  projectCode: string;
  category: DocCategory;
  name: string;
  type: string;
  version: number;
  owner: string;
  updatedAt: string;
  status: DocStatus;
  size: string;
  fileType: "PDF" | "DOCX" | "XLSX" | "PPTX";
  lot?: string;
  formula?: string;
  method?: string;
  versions: DocVersion[];
  /* Screens 45–47 */
  /** File of the current version ("Rapport_essais_F2_v2.pdf"). */
  fileName?: string;
  description?: string;
  keywords?: string[];
  createdAt?: string;
  /** Version still in force while a newer one is under review (v2 approved, v3 draft). */
  approvedVersion?: number;
  archived?: boolean;
  archivedAt?: string;
  comments?: DocComment[];
}

export type HistoryObject =
  | "Projet"
  | "Décision"
  | "Formule"
  | "Document"
  | "Lot"
  | "Prérequis"
  | "Revue"
  | "Méthode"
  | "Essai"
  | "Activité"
  | "Réservation"
  | "Déviation"
  | "Stabilité"
  | "Dossier"
  | "Transfert";

export interface HistoryEvent {
  id: string;
  projectCode: string;
  at: string;
  title: string;
  context: string;
  object: HistoryObject;
  objectLabel: string;
  type: "Création" | "Modification" | "Ajout" | "Suppression" | "Soumission" | "Relance" | "Approbation" | "Correction";
  author: string;
  authorRole?: string;
  motif?: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  description?: string;
  href?: string;
  icon: "edit" | "doc" | "flask" | "box" | "check" | "send" | "folder" | "calendar" | "alert" | "chart";
  /* Optional links to the objects of the lab modules (screens 21–41). */
  methodRef?: string;
  analysisId?: string;
  deviationId?: string;
  studyId?: string;
  activityId?: string;
  lotCode?: string;
  /** Object/version chip shown in the method history ("ANA-01 • En revue"). */
  version?: Labelled;
  /** Document concerned and "Avant / Après" cards of a new version (screen 47). */
  docId?: string;
  docBefore?: DocSnapshot;
  docAfter?: DocSnapshot;
}

export interface DocSnapshot {
  label: string;
  status: DocStatus;
  date: string;
}

export type DecisionChoice = "poursuivre" | "retenir" | "revoir";

export type CircuitStatus = "Soumis" | "Avis favorable" | "À examiner" | "En attente" | "Approuvé" | "Correction demandée";

export interface CircuitStep {
  role: string;
  detail: string;
  status: CircuitStatus;
  date?: string;
}

export interface FormulaDecision {
  projectCode: string;
  formula: string;
  choice: DecisionChoice;
  justification: string;
  attachments: string[];
  status: "Brouillon" | "Soumise" | "Approuvée" | "Correction demandée";
  step: 1 | 2 | 3;
  updatedAt: string;
  /** Lot whose results support the decision. */
  lot?: string;
  /** Validation circuit once the decision has been submitted (screen 21). */
  circuit?: CircuitStep[];
  approvedAt?: string;
  correction?: string;
}

/* ------------------------------------------------------------------ */
/* Methods & analyses (screens 22–28)                                  */
/* ------------------------------------------------------------------ */

export interface Person {
  name: string;
  role: string;
}

export type Applicability = "À confirmer" | "Confirmée" | "Non applicable";

export interface MethodReference {
  dossier: string;
  reference: string;
  edition: string;
  title: string;
  description: string;
  sourceDoc?: { name: string; folder: string; date: string };
  applicability: Applicability;
  equipment: string;
  column: string;
  reagents: string;
}

export interface MethodDocument {
  id: string;
  name: string;
  file?: string;
  date?: string;
  status: "Disponible" | "À créer" | "À venir";
}

export type ProtocolStatus = "Brouillon" | "En revue" | "Approuvé";

export interface ProtocolParams {
  equipment: string;
  column: string;
  mobilePhase: string;
  flow: string;
  flowUnit: string;
  wavelength: string;
  wavelengthUnit: string;
  temperature: string;
  temperatureUnit: string;
  injection: string;
  injectionUnit: string;
  duration: string;
  durationUnit: string;
}

export interface ProtocolCriterion {
  id: string;
  label: string;
  value: string;
  unit: string;
}

export interface Reviewer {
  name: string;
  role: string;
  status: "En attente" | "Approuvé";
  date?: string;
}

export interface MethodProtocol {
  version: string;
  status: ProtocolStatus;
  objective: string;
  preparation: string;
  params: ProtocolParams;
  criteria: ProtocolCriterion[];
  extraSteps: string[];
  attachments: string[];
  reviewers: Reviewer[];
  owner: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
}

export interface MethodVersion {
  version: string;
  status: "Brouillon" | "Approuvé" | "Remplacée";
  date: string;
  by: string;
  note: string;
}

export interface Method {
  ref: string;
  name: string;
  /** Technique chip of the catalogue card ("CLHP", "Appareil USP"…). */
  technique: string;
  /** One-line description of the catalogue card. */
  description: string;
  /** Subtitle of the method header ("Quantification du principe actif par CLHP"). */
  subtitle: string;
  analysis: string;
  type: "Méthode analytique" | "Essai pharmacotechnique";
  origin: "Interne" | "Pharmacopée";
  projectCode: string;
  equipment: { code: string; label: string };
  owner: Person;
  /** Status of the methods without a simulated lifecycle. */
  status: Labelled;
  nextAction: { label: string; date?: string };
  /** Entry of the "À traiter" panel of the catalogue. */
  todo?: { kind: "protocole" | "resultats"; due: string };
  /** When true, status and next action are derived from the protocol and analyses (M-01). */
  lifecycle: boolean;
  reference: MethodReference;
  documents: MethodDocument[];
  protocol?: MethodProtocol;
  versions: MethodVersion[];
  archived: boolean;
}

export interface AnalysisRequest {
  ref: string;
  projectCode: string;
  lotCode: string;
  analysis: string;
  method: string;
  due: string;
  requester: string;
  status: Labelled;
  comment?: string;
}

/** Test preparation wizard of a method (screen 25). */
export interface TestPlan {
  methodRef: string;
  projectCode: string;
  lotCode: string;
  formula: string;
  analysis: string;
  repetitions: number;
  samples: string[];
  step: 1 | 2 | 3;
  equipment: string;
  column: string;
  consumables: string[];
  analyst: Person;
  updatedAt: string;
}

export type AnalysisStatus = "Brouillon" | "En revue" | "Correction demandée" | "Validée";

export interface AnalysisResult {
  sample: string;
  description: string;
  value: string;
  comment: string;
  date: string;
}

export interface Analysis {
  id: string;
  methodRef: string;
  projectCode: string;
  lotCode: string;
  formula: string;
  protocolVersion: string;
  protocolApprovedAt: string;
  lotMadeAt: string;
  date: string;
  periodFrom: string;
  periodTo: string;
  status: AnalysisStatus;
  unit: string;
  repetitions: number;
  analyst: Person;
  results: AnalysisResult[];
  attachments: { id: string; name: string; kind: string; date: string }[];
  circuit: CircuitStep[];
  submittedAt?: string;
  correction?: { recipient: string; reason: string; due: string; notify: boolean; at: string };
  comments: ActivityComment[];
}

/* ------------------------------------------------------------------ */
/* Planning (screens 31–34)                                            */
/* ------------------------------------------------------------------ */

export interface Resource {
  id: string;
  name: string;
  /** Short type shown under the name ("HPLC", "Mélangeur", "Personnel"). */
  type: string;
  /** Long label ("Chromatographe HPLC"). */
  label: string;
  team: string;
  category: "Équipement" | "Personnel";
  icon: "hplc" | "mixer" | "person" | "balance" | "oven" | "fridge" | "uv" | "dissolution" | "friability";
  owner: string;
  qualification: { status: "Qualifié" | "À vérifier"; next: string };
  /** Methods this resource is qualified for (empty = any). */
  qualifiedFor?: string[];
}

export type PlanningKind = "activite" | "reservation" | "revue" | "maintenance";

export interface PlanningEvent {
  id: string;
  kind: PlanningKind;
  title: string;
  projectCode?: string;
  lotCode?: string;
  /** Room or equipment shown on the agenda card. */
  place?: string;
  resourceIds: string[];
  date: string;
  start: string;
  end: string;
  status: "Planifiée" | "Confirmée";
  method?: string;
  analyst?: string;
  description?: string;
  activityId?: string;
  /** Label shown in the resource timeline ("CS-01 • Essais"). */
  timelineLabel?: string;
  createdBy: string;
  notify?: boolean;
}

/* ------------------------------------------------------------------ */
/* Pilot lot & deviations (screens 35–39)                              */
/* ------------------------------------------------------------------ */

export type ExecStepStatus = "À venir" | "En cours" | "En pause" | "Terminée";

export interface ExecStep {
  key: string;
  title: string;
  status: ExecStepStatus;
  equipment: string;
  equipmentLabel: string;
  mo: string;
  start: string;
  end: string;
  parameters: string;
  observations: string;
  proofs: { name: string; size: string }[];
  owner: string;
  instruction: string;
}

export type ControlStatus = "En attente" | "À saisir" | "Saisi" | "En revue" | "Validé";

export interface LotControl {
  id: string;
  name: string;
  detail: string;
  status: ControlStatus;
  result: string;
  unit: string;
  date: string;
  method: string;
  methodLabel: string;
  methodVersion: string;
  specification: string;
  attachments: { name: string; size: string }[];
}

export interface PilotLot {
  projectCode: string;
  lotCode: string;
  formula: string;
  status: "Préparation" | "En fabrication" | "Fabriqué";
  plannedDate: string;
  equipment: string;
  responsible: string;
  mo: { code: string; version: string; label: string; status: "Approuvé" | "Brouillon"; approvedAt: string };
  controlMethod: string;
  materials: { name: string; code: string; lot: string; verified: boolean; verifiedAt: string }[];
  steps: ExecStep[];
  startedAt?: string;
  lastSave?: { at: string; by: string };
  controls: LotControl[];
  controlsSubmittedAt?: string;
  /** Deviation saved as a draft from the "Déviations" tab. */
  deviationDraft?: DeviationDraft;
}

export type DeviationStatus = "Brouillon" | "Analyse en cours" | "Actions en cours" | "Efficacité à vérifier" | "Clôturée";

export interface DeviationAction {
  id: string;
  title: string;
  owner: string;
  category: string;
  group: string;
  status: "À faire" | "En cours" | "Terminée";
  due: string;
  description: string;
  steps: string[];
  proofs: string;
  effective?: boolean;
}

export interface Deviation {
  id: string;
  projectCode: string;
  lotCode: string;
  formula: string;
  step: string;
  equipment: string;
  equipmentLabel: string;
  title: string;
  observedAt: string;
  category: string;
  criticality: string;
  description: string;
  immediateAction: string;
  attachments: { name: string; kind: string; size: string }[];
  informed: string[];
  securingAction: boolean;
  status: DeviationStatus;
  createdAt: string;
  createdBy: string;
  analysis: { cause: string; rootCause: string; impact: string; doneAt?: string };
  effectivenessAt?: string;
  closedAt?: string;
  actions: DeviationAction[];
}

export interface DeviationDraft {
  title: string;
  observedAt: string;
  category: string;
  criticality: string;
  description: string;
  immediateAction: string;
  attachments: { name: string; kind: string; size: string }[];
  informed: string[];
  securingAction: boolean;
}

/* ------------------------------------------------------------------ */
/* Stability (screens 40–44)                                           */
/* ------------------------------------------------------------------ */

export type StudyStatus = "À préparer" | "Protocole en cours" | "Protocole soumis" | "Protocole approuvé" | "En cours" | "En revue";

export interface StabilityTest {
  id: string;
  name: string;
  method: string;
  equipment: string;
  description: string;
  selected: boolean;
}

export interface StabilityMilestone {
  id: string;
  code: string;
  months: number;
  status: "À planifier" | "Planifiée" | "Réalisée";
  date?: string;
}

export interface StabilityProtocol {
  /** The schedule (screen 42) can only be activated once the protocol is approved. */
  status: "Brouillon" | "Soumis" | "Approuvé";
  responsible: string;
  formula: string;
  lot: string;
  startDate: string;
  storage: string;
  packaging: string;
  tests: StabilityTest[];
  milestones: StabilityMilestone[];
  documents: { id: string; name: string; date: string }[];
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  /** Set when the schedule is activated: the sampling points become "Planifiée". */
  scheduleActivatedAt?: string;
}

/** Result of one analysis at one sampling point (screen 43). */
export type StabilityResultStatus = "À venir" | "À saisir" | "Brouillon" | "Soumis" | "Validé";

export interface StabilityResult {
  id: string;
  /** Sampling point ("T0", "M3"…). */
  point: string;
  method: string;
  analysis: string;
  storage: string;
  status: StabilityResultStatus;
  value: string;
  unit: string;
  source: string;
  comment: string;
  attachments: { name: string; size: string }[];
  /** Report of a validated result ("Rapport T0"). */
  report?: string;
  updatedAt?: string;
}

export type StabilityAlertLevel = "Faible" | "Moyen" | "Élevé";
export type StabilityAlertStatus = "Ouverte" | "Prise en charge" | "Résolue";

/** Stability alert (screen 44). */
export interface StabilityAlert {
  id: string;
  title: string;
  description: string;
  origin: "Échéancier" | "Résultats" | "Documentation";
  /** State tag next to the origin ("À planifier", "En attente", "À compléter"). */
  tag: string;
  level: StabilityAlertLevel;
  status: StabilityAlertStatus;
  /** Due date; "À confirmer" when empty. */
  due?: string;
  responsible: string;
  date: string;
  /** Activity created from the alert ("Créer une activité"). */
  activityId?: string;
}

export interface StabilityStudy {
  id: string;
  projectCode: string;
  lotCode: string;
  lotLabel: string;
  formula: string;
  dosage: string;
  owner: string;
  status: StudyStatus;
  nextTask: { title: string; detail: string };
  protocol?: StabilityProtocol;
  results: StabilityResult[];
  alerts: StabilityAlert[];
}

export interface Notification {
  id: string;
  title: string;
  detail: string;
  when: string;
  href: string;
  tone: Tone;
  read: boolean;
}

export interface OverviewFilters {
  families: Family[];
  phases: string[];
  owner: string;
  status: string;
  from: string;
  to: string;
  blockingOnly: boolean;
}

export interface SavedView {
  id: string;
  name: string;
  shared: boolean;
  filters: OverviewFilters;
}

export interface ProjectDraft {
  step: 1 | 2 | 3;
  code: string;
  name: string;
  dci: string;
  family: Family;
  form: string;
  dosage: string;
  dosageUnit: string;
  countries: string[];
  referenceProduct: string;
  /** Leaflet or SmPC of the reference product, read by the AI analysis (step 1). */
  referenceDoc?: ReferenceDoc;
  files: { name: string; size: string }[];
  template: string;
  galenic: boolean;
  analytic: boolean;
  studies: string[];
  team: Record<string, string>;
  startDate: string;
  targetDate: string;
  effort: string;
  prerequisites: string[];
  sourceProject?: string;
  /** What the "Détection IA" applied to the form (screens IA-01 → IA-06). */
  ai?: AiPrefill;
}

/** Document of the reference product and what the AI analysis found in it. */
export interface ReferenceDoc {
  name: string;
  size: string;
  /** "Notice", "RCP" or "Document produit". */
  kind: string;
  data: { label: string; value: string }[];
  /** Headings of the document the analysis located. */
  sections: string[];
}

export interface AiPrefill {
  /** Fields filled from the documents ("Issu des documents") or by a confirmed choice. */
  fields: Partial<Record<"name" | "dci" | "family" | "form" | "dosage" | "countries" | "referenceProduct", "documents" | "confirme">>;
  /** Proposed activities, created as drafts with the project. */
  activities: { title: string; detail: string }[];
  /** Pieces not found in the documents, added to the prerequisites of the project. */
  prerequisites: string[];
  dosageReason: string;
  files: string[];
}

/* ------------------------------------------------------------------ */
/* Dossier CTD, reviews, reserves, transfer (screens 48–53)            */
/* ------------------------------------------------------------------ */

export type SectionStatus = "À compléter" | "En revue" | "Approuvée" | "À évaluer";

/** Paragraph of a dossier section ("Composition", "Choix de formule"…). */
export interface DossierPart {
  id: string;
  title: string;
  text: string;
}

/** Evidence supporting a section: a project document or the approved formula decision. */
export interface DossierProof {
  id: string;
  label: string;
  kind: string;
  docId?: string;
  decision?: boolean;
}

/** Link between a proof (and the part of it that is cited) and a paragraph of the section. */
export interface DossierLink {
  id: string;
  proofId: string;
  ref: string;
  partId: string;
}

export type SectionIcon = "settings" | "factory" | "flask" | "chart" | "doc";

export interface DossierSection {
  id: string;
  code: string;
  title: string;
  summary: string;
  icon: SectionIcon;
  status: SectionStatus;
  heading: string;
  intro: string;
  parts: DossierPart[];
  proofs: DossierProof[];
  links: DossierLink[];
  submittedAt?: string;
}

export interface DossierModule {
  n: 1 | 2 | 3 | 4 | 5;
  title: string;
  description: string;
  sections: DossierSection[];
}

/** Element the dossier still waits for ("Rapport de stabilité consolidé", "Synthèse à approuver"). */
export interface DossierRequirement {
  id: string;
  module: number;
  label: string;
  detail: string;
  kind: "document" | "approbation";
  sectionId: string;
  docName: string;
  docType: string;
  docId?: string;
}

export interface DossierExport {
  id: string;
  at: string;
  format: "PDF" | "ZIP";
  fileName: string;
  sections: string[];
  author: string;
}

export interface Dossier {
  projectCode: string;
  formula: string;
  modules: DossierModule[];
  requirements: DossierRequirement[];
  checkedAt?: string;
  exports: DossierExport[];
  /** Review being prepared (screen 50), kept when leaving the page. */
  reviewDraft?: ReviewDraft;
}

export type DossierReviewStatus = "En revue" | "Approuvée" | "Approuvée avec réserves" | "Correction demandée";
export type ReviewDecisionChoice = "approuver" | "reserves" | "correction";

export interface DossierReview {
  id: string;
  projectCode: string;
  type: string;
  date: string;
  participants: string[];
  objet: string;
  documents: string[];
  expected: string;
  justification: string;
  status: DossierReviewStatus;
  submittedAt: string;
  decision?: ReviewDecisionChoice;
  decisionJustification?: string;
  decidedAt?: string;
  circuit: CircuitStep[];
}

export interface ReviewDraft {
  type: string;
  date: string;
  participants: string[];
  objet: string;
  documents: string[];
  expected: string;
  justification: string;
}

export interface Reserve {
  id: string;
  projectCode: string;
  reviewId: string;
  description: string;
  owner: string;
  due: string;
  blocking: boolean;
  status: "Ouverte" | "Levée";
  liftedAt?: string;
  liftComment?: string;
}

export type TransferStatus = "À préparer" | "À réceptionner" | "Complément demandé" | "Réceptionné";

export interface TransferDocument {
  id: string;
  title: string;
  code: string;
  version: string;
  date: string;
  docId?: string;
}

export interface Transfer {
  projectCode: string;
  status: TransferStatus;
  sourceTeam: string;
  targetTeam: string;
  owner: string;
  documents: TransferDocument[];
  transmittedAt?: string;
  receivedAt?: string;
  comment?: string;
  complementRequest?: string;
}

/* ------------------------------------------------------------------ */
/* Configuration (screens 54–55)                                       */
/* ------------------------------------------------------------------ */

export interface RolePermission {
  key: string;
  label: string;
  detail: string;
  enabled: boolean;
}

export interface TeamRole {
  id: string;
  name: string;
  description: string;
  icon: "user" | "users" | "flask" | "shield" | "factory";
  permissions: RolePermission[];
  scope: "Projets assignés" | "Tous les projets";
  members: Person[];
}

export type TemplateIcon = "doc" | "list" | "flask" | "settings" | "check" | "chart" | "users" | "arrow";

export interface TemplateItem {
  id: string;
  label: string;
  icon: TemplateIcon;
}

export interface TemplatePhase {
  key: string;
  title: string;
  description: string;
  activities: TemplateItem[];
  proofs: TemplateItem[];
}

export type TemplateStatus = "Actif" | "Brouillon" | "Archivé";

export interface TemplateVersion {
  version: number;
  status: TemplateStatus;
  createdAt: string;
  note: string;
  phases: TemplatePhase[];
}

export interface PathTemplate {
  id: string;
  name: string;
  family: Family;
  /** Name stored on the projects created from it ("Modèle forme sèche"). */
  projectTemplate: string;
  versions: TemplateVersion[];
}

export interface NotificationSetting {
  id: string;
  label: string;
  detail: string;
  app: boolean;
  email: boolean;
}

export interface ConfigLogEntry {
  id: string;
  at: string;
  author: string;
  text: string;
}
