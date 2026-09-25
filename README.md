# Espace R&D — Laboratoires SIMED

Prototype interactif de l'Espace R&D (maquettes 01 → 56) : portefeuille, projets, formules et
décisions, méthodes et essais, activités, planning, lot pilote, déviations, stabilité, documents,
dossier CTD, revues, transfert, configuration et clôture de projet.

Données **de démonstration** uniquement (projets et personnes fictifs), date de référence fixée au
**24 septembre 2026**.

Application **web pour ordinateur** : la barre latérale reste affichée et la page demande 1 200 px de
large au minimum (défilement horizontal en dessous). Il n'y a pas de version mobile.

## Démarrer

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script              | Rôle                                   |
| ------------------- | -------------------------------------- |
| `npm run dev`       | Serveur de développement (Turbopack)   |
| `npm run build`     | Build de production                    |
| `npm run start`     | Sert le build de production            |
| `npm run lint`      | ESLint                                 |
| `npm run typecheck` | Vérification TypeScript                |

> Les scripts appellent les CLI via `node node_modules/...` : le `&` du chemin
> `R & D new vision` casse les raccourcis `.cmd` de npm sous Windows.

## Parcours guidé

Le prototype se parcourt écran par écran, dans l'ordre des maquettes :

- **Cercle bleu numéroté** posé sur l'élément à cliquer (bouton, onglet, entrée de menu, champ) : son
  numéro est l'écran suivant. Le survoler affiche une bulle (écran suivant, et ce qu'il faut faire
  d'abord le cas échéant) ; le cliquer ouvre cet écran. Les boutons concernés passent en bleu plein ;
  un champ ou un bloc entouré de bleu signale un préalable (confirmer l'applicabilité, saisir un résultat…).
- **Cercle en bas à droite** : quand aucun élément de la page ne mène à l'écran suivant (changement de
  projet ou d'étude, variante de maquette : écrans 09, 10, 11, 14, 18, 34, 42, 44, 55), il ouvre l'écran suivant ; avec une
  flèche, il fait défiler la page jusqu'au cercle quand celui-ci est hors de l'écran.
- **Pied de page** : liens vers l'écran précédent et l'écran suivant, référence `NN / 56`.
- **Écran NN / 56** (barre du haut, ou menu **Démonstration** → *Parcours des écrans*) : liste de tous
  les écrans livrés. Choisir un écran remet les données dans l'état exact de sa maquette.
  La même fenêtre permet de masquer les cercles.

Scénario de test détaillé, écran par écran (quoi regarder, quoi faire, blocages à vérifier) :
[`SCENARIO-PARCOURS-01-56.txt`](SCENARIO-PARCOURS-01-56.txt).

Les maquettes racontent une histoire (essais F2 → décision → méthode → lot pilote → déviation → stabilité).
Avancer d'une étape joue la transition correspondante sur les données (`lib/guide.ts`) ; les transitions
sont idempotentes : ce que vous avez fait à la main est conservé.

## Écrans livrés

| Maquette | Écran                                    | Route                                                       |
| -------- | ---------------------------------------- | ----------------------------------------------------------- |
| 01       | Vue d'ensemble — Portefeuille            | `/vue-ensemble`                                             |
| 02       | Mes priorités                            | `/vue-ensemble/priorites`                                   |
| 03       | Revues à préparer                        | `/vue-ensemble/revues`                                      |
| 04       | Filtres et vue enregistrée               | `/vue-ensemble?filtres=1`                                   |
| 05       | Recherche et accès direct                | `/recherche?q=CS-01`                                        |
| 06       | Liste des projets                        | `/projets`                                                  |
| 07       | Créer un projet — Produit                | `/projets/nouveau`                                          |
| 08       | Créer un projet — Parcours & équipe      | `/projets/nouveau?demo=parcours`                            |
| 09       | Créer un projet — Vérification           | `/projets/nouveau?demo=verification` (non maquetté)         |
| 10       | Champs manquants et code déjà utilisé    | `/projets/nouveau?demo=erreurs`                             |
| 11       | Vue d'un projet                          | `/projets/cs-01`                                            |
| 12       | Prérequis du projet (CR-01)              | `/projets/cr-01/prerequis`                                  |
| 13       | Importer et vérifier un document         | `/projets/cr-01/prerequis?prerequis=pr-cr-1&importer=exemple` |
| 14       | Demander un document ou une matière      | `/projets/cr-01/prerequis?demande=pr-cr-2`                  |
| 15       | Documents du projet (dessin de la 45)    | `/projets/cs-01/documents`                                  |
| 16       | Historique et traçabilité (dessin de la 47) | `/projets/cs-01/historique`                              |
| 17       | Versions de formule                      | `/projets/cs-01/formules`                                   |
| 18       | Éditer une nouvelle formule              | `/projets/cs-01/formules/nouvelle?parent=F2`                |
| 19       | Comparaison des formules                 | `/projets/cs-01/formules/comparaison`                       |
| 20       | Décision sur une formule                 | `/projets/cs-01/formules/comparaison?decision=1`            |
| 21       | Décision — examen et approbation         | `/projets/cs-01/formules/comparaison?examen=1`              |
| 22       | Méthodes & essais — catalogue            | `/methodes`                                                 |
| 23       | Méthode — référence                      | `/methodes/m-01`                                            |
| 24       | Méthode — protocole                      | `/methodes/m-01/protocole`                                  |
| 25       | Méthode — préparer les essais            | `/methodes/m-01/essais`                                     |
| 26       | Essai — saisir les résultats             | `/methodes/m-01/analyses/ana-01`                            |
| 27       | Validation — demande de correction       | `/methodes/m-01/validation?correction=1`                    |
| 28       | Méthode — historique et versions         | `/methodes/m-01/historique`                                 |
| 29       | Mes activités — liste et priorités       | `/activites`                                                |
| 30       | Activité — détails et clôture bloquée    | `/activites/act-lp01`                                       |
| 31       | Planning — agenda de l'équipe            | `/planning`                                                 |
| 32       | Planning — ressources et disponibilités  | `/planning?vue=ressources`                                  |
| 33       | Réserver une ressource                   | `/planning/reservation?ressource=HPLC-01&date=2026-10-07…`  |
| 34       | Conflit de réservation                   | `/projets/cs-01/planning?jour=2026-10-07&demande=HPLC-01,10:00,12:00` |
| 35       | Lot pilote — préparation                 | `/projets/cs-01/lots/lp-01`                                 |
| 36       | Lot pilote — exécution du mélange        | `/projets/cs-01/lots/lp-01/execution`                       |
| 37       | Lot pilote — contrôles                   | `/projets/cs-01/lots/lp-01/controles`                       |
| 38       | Déclarer une déviation de lot            | `/projets/cs-01/lots/lp-01/deviations`                      |
| 39       | Déviation — actions et efficacité        | `/projets/cs-01/deviations/dev-01?onglet=actions`           |
| 40       | Stabilité — études                       | `/stabilite`                                                |
| 41       | Stabilité — protocole                    | `/stabilite/st-01`                                          |
| 42       | Stabilité — échéancier                   | `/stabilite/st-01?onglet=echeancier`                        |
| 43       | Stabilité — résultats                    | `/stabilite/st-02?onglet=resultats&point=res-st02-m3`       |
| 44       | Stabilité — alertes                      | `/stabilite?onglet=alertes&alerte=al-1`                     |
| 45       | Documents du projet                      | `/projets/cs-01/documents?doc=doc-cs-rf2`                   |
| 46       | Document — importer une nouvelle version | `/projets/cs-01/documents/doc-cs-rf2?nouvelle-version=exemple` |
| 47       | Projet — historique                      | `/projets/cs-01/historique?evenement=h-doc-cs-rf2-v3`       |
| 48       | Dossiers & revues — structure CTD        | `/dossiers/cs-01`                                           |
| 49       | Dossier CTD — contenu d'une section      | `/dossiers/cs-01/sections/developpement`                    |
| 50       | Préparer une revue de dossier            | `/dossiers/cs-01/revues/nouvelle`                           |
| 51       | Revue — décision et réserves             | `/dossiers/cs-01/revues/rd-01`                              |
| 52       | Exporter le dossier                      | `/dossiers/cs-01/export`                                    |
| 53       | Transfert — préparation et réception     | `/dossiers/cs-01/transfert`                                 |
| 54       | Configuration — rôles et accès           | `/configuration`                                            |
| 55       | Configuration — modèles de parcours      | `/configuration/modeles`                                    |
| 56       | Clôture et archivage du projet           | `/projets/cs-01/cloture?confirmer=1`                        |

Les 56 maquettes sont livrées.

Ouvertes directement (sans passer par le parcours), les pages affichent l'état réel des données :
par exemple le protocole de M-01 n'existe pas tant que l'applicabilité n'est pas confirmée, et le lot
LP-01 ne peut pas démarrer tant que la formule n'est pas approuvée et le mélangeur réservé.

Écrans complémentaires (hors maquettes) : onglet **Essais** d'un projet, **Lots et échantillons**
(maquette 21 de la première série, remplacée dans le nouveau deck), onglets Documents/Historique du lot,
liste des déviations, charge de l'équipe, liste des dossiers (`/dossiers`), liste des revues, réserves
du dossier, configuration des ressources et des notifications. Seul le profil reste « prévu dans une
prochaine étape ».

## Choix d'harmonisation

Les maquettes divergent parfois ; les choix suivants rendent le prototype cohérent :

- Onglets projet : *Vue projet · Prérequis · Formules & lots · Essais · Documents · Planning · Historique*.
  Le lot pilote et la méthode ont chacun leur en-tête et leurs onglets (un seul jeu d'onglets par objet).
- Une seule histoire : les essais F2 (lot d'essai E-02) se terminent, la décision « Retenir F2 » est
  approuvée, ce qui autorise le lot pilote LP-01. Les essais de la méthode M-01 (ANA-01) portent sur les
  échantillons ECH-01 à ECH-03 du **lot E-02** : LP-01 n'est pas encore fabriqué à ce moment de l'histoire.
- Catalogue des méthodes renuméroté selon la maquette 22 (M-01 Dosage PA, M-02 Dissolution,
  M-03 Friabilité…) ; les essais du lot 1 pointent vers ces références.
- Statuts calculés : statut et prochaine action de M-01, conditions préalables de LP-01 (et étapes de
  l'activité « Préparer le lot pilote »), badge « Prêt à démarrer », disponibilités et créneaux
  alternatifs en cas de conflit.
- Règles métier reprises des maquettes : protocole bloqué tant que l'applicabilité n'est pas confirmée ;
  soumission bloquée tant qu'un critère ou un résultat manque ; activité non clôturable tant que le
  mélangeur n'est pas réservé ; étape non terminable sans heure de fin ; déviation non clôturable
  avant vérification de l'efficacité ; protocole de stabilité non soumis sans condition de stockage ;
  échéancier non activable avant l'approbation du protocole ; résultat de stabilité non soumis sans
  valeur, source et pièce justificative ; revue de CR-01 non préparable tant qu'un prérequis n'est pas
  vérifié.
- Les actions de l'utilisateur sont datées du 24/09/2026 ; les créneaux planifiés conservent les dates
  des maquettes (semaine du 5 au 9 octobre).
- Les maquettes du lot 2 nomment des personnes (fictives) : elles sont reprises telles quelles.
- Onglets **Documents** et **Historique** d'un projet : un seul dessin, celui des maquettes 45 et 47 (plus
  récentes). Les écrans 15 et 16 ouvrent ces mêmes onglets en début de projet ; 45 et 47 en fin de projet.
  Les fonctions du premier dessin sont conservées (ajout, renommage, déplacement, suppression d'un
  brouillon, filtres par dossier et par état).
- Versions de document : une nouvelle version reste en brouillon ou en revue ; la dernière version
  approuvée reste « en vigueur » jusqu'à son approbation (bouton de simulation du relecteur).
- Le rapport de stabilité de la maquette 45 est nommé « ST-02 » : dans l'histoire, l'étude ST-01 (lot
  LP-01) n'a pas encore de résultats.
- Dossier CTD : « Préparer une revue » n'est possible que lorsque les éléments manquants sont réglés ;
  le parcours les règle au passage 49 → 50 (« quelques jours plus tard »). Le formulaire de revue ajoute
  un champ **Justification**, exigé par l'état de préparation de la maquette 50.
- Transfert : bloqué tant qu'une réserve bloquante est ouverte ; les documents remis reprennent ceux du
  projet (mode opératoire MO-LP-01 en v1 et non v3).
- Clôture : quatre conditions calculées (décisions, livrables approuvés ou archivés, actions closes,
  transfert réceptionné). Le parcours les remplit à l'écran 56 ; un projet clôturé passe dans
  **Projets → Archivés**, en lecture seule.
- Les exports sont de vrais fichiers générés dans le navigateur (PDF paginé ou archive ZIP).
- Onglet **Prérequis** : un seul dessin, celui de la maquette 12 (cartes Documents / Matières /
  Ressources et panneau de détail). L'écran 13 est la fenêtre d'import ouverte sur le DMF / CEP (le
  fournisseur envoie la v4) ; l'écran 14 est la demande du certificat GMP, ouverte depuis « Demander au
  responsable ». Un document ne passe « Vérifié » qu'avec une pièce ; l'import vérifié met le
  prérequis à jour. L'extraction automatique est simulée (champs du document d'exemple).
- Page **Comparaison** : dessin de la maquette 19 ; les écrans 20 et 21 sont des fenêtres ouvertes sur
  cette page. La F1 reste « À améliorer » (dureté non conforme) au lieu de « Essais terminés » et le lot
  E-02 est daté du 18/09/2026 (date de ses échantillons).
- **Stabilité** : une étape « Approuver (simulation) » du protocole a été ajoutée, la maquette 42 exigeant
  un protocole approuvé avant l'activation de l'échéancier ; l'activation crée les points de résultats.
  L'étude ST-02 est en 25 °C / 60 % HR (maquette 43). Une valeur hors spécification crée une alerte de
  niveau élevé. Titres : « ST-01 • Protocole de stabilité » sur l'onglet Protocole (maquette 41),
  « ST-01 • Lot LP-01 » sur les autres (maquettes 42 et 43).
- CR-01 reste en phase « Faisabilité » (la maquette 12 indique « Développement ») : sa revue de
  faisabilité est justement bloquée par le certificat GMP.

## Données et état

- `src/lib/data.ts` + `src/lib/data-lab.ts` + `src/lib/data-dossier.ts` : jeu de démonstration (`createSeed()`).
- `src/lib/store.ts` : store en mémoire (`useDemo()`, `actions.*`, `labActions.*`). L'état survit à la
  navigation, pas au rechargement. Menu **Démonstration → Réinitialiser les données**.
- `src/lib/prerequisites.ts` : transitions des prérequis (écrans 12 → 14) : détail, ajout, import
  vérifié, retrait de pièce, relance.
- `src/lib/lab.ts` : transitions métier pures des écrans 21 → 44 (décision, méthode, essais, activités,
  réservations, lot pilote, déviations, stabilité : protocole, échéancier, résultats, alertes) ; chacune
  ajoute un événement à l'historique.
- `src/lib/dossier.ts` : transitions des écrans 45 → 56 (versions de documents, dossier CTD, revues,
  réserves, export, transfert, configuration, clôture), liées au store par `dossierActions.*`.
- `src/lib/export-files.ts` : génération des fichiers PDF et ZIP (sans dépendance).
- `src/lib/guide.ts` : étapes du parcours guidé et transitions de l'histoire.
- `src/lib/selectors.ts`, `src/lib/lab-selectors.ts`, `src/lib/dossier-selectors.ts` : règles dérivées.
- `src/lib/format.ts` : formatage FR déterministe (dates, heures, nombres).

## Structure

```
src/
  app/(app)/…              routes (coquille commune : sidebar + barre supérieure)
  components/ui/           primitives (Button, Badge, Field, Tabs, Drawer, Modal, Menu, Toast, Stepper…)
  components/guide/        parcours guidé (cercles bleus, liste des écrans, pied de page)
  components/layout/       sidebar (logo SIMED), topbar
  components/overview/     portefeuille, priorités, revues, filtres
  components/projects/     liste des projets, assistant de création
  components/project/      en-tête projet, prérequis et import, formules, comparaison, décision, lots, documents, historique, planning
  components/methods/      catalogue, référence, protocole, essais, résultats, validation, historique
  components/activities/   mes activités, fiche activité
  components/planning/     agenda, ressources, réservation, conflit
  components/lots/         lot pilote : préparation, exécution, contrôles, déviations
  components/deviations/   fiche déviation
  components/stability/    études, protocole, échéancier, résultats et alertes de stabilité
  components/dossiers/     dossier CTD, section, revues, réserves, export, transfert
  components/config/       rôles et accès, modèles de parcours, ressources, notifications
  lib/                     types, catalogues, données, store, transitions, sélecteurs, formatage
public/brand/              logo SIMED recadré (source : simed.png)
```

## Ajouter un écran

1. Créer la route dans `src/app/(app)/…/page.tsx` (composant serveur qui lit `params` / `searchParams`).
2. Créer la vue client dans `src/components/<module>/` en réutilisant les primitives de `components/ui`.
3. Étendre les types, `createSeed()` et les transitions (`lib/lab.ts`, `lib/dossier.ts`) si l'écran modifie
   les données.
4. Ajouter `<ScreenRef n={NN} label="…" />` en bas de page.
5. Déclarer l'étape dans `GUIDE_STEPS` (`lib/guide.ts`, avec sa fonction `prepare` si besoin) et poser
   `guide={NN}` sur le bouton (ou onglet) de l'écran précédent qui y mène.
