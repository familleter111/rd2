"use client";

import { FolderOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { excelSync, useExcelSync } from "@/lib/excel-sync";

const LOOK = {
  off: { tone: "neutral", label: "Excel auto : désactivé" },
  permission: { tone: "warn", label: "Excel auto : à réautoriser" },
  saving: { tone: "info", label: "Excel auto : enregistrement…" },
  saved: { tone: "success", label: "Excel auto : à jour" },
  error: { tone: "danger", label: "Excel auto : erreur" },
} as const;

/** Automatic Excel recording: folder, state and last write. Opened from the workspace menu. */
export function ExcelSyncDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sync = useExcelSync();
  const look = LOOK[sync.state];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enregistrement Excel automatique"
      subtitle="À chaque ajout, modification ou suppression, les fichiers Excel du dossier choisi sont réécrits."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Fermer
        </Button>
      }
    >
      <div>
    {!sync.supported ? (
      <p className="mt-2 text-sm text-ink-600">Ce navigateur ne permet pas d&apos;écrire dans un dossier. Utilisez Chrome ou Edge, ou le bouton « Enregistrer dans Excel » de chaque page.</p>
    ) : sync.state === "off" ? (
      <>
        <p className="mt-2 text-sm text-ink-600">Choisissez un dossier de votre ordinateur : à chaque ajout, modification ou suppression, les fichiers Excel y sont réécrits — un classeur par projet (toutes ses étapes) et un classeur de l&apos;espace.</p>
        <Button className="mt-3" icon={<FolderOpen className="h-4 w-4" />} onClick={() => void excelSync.choose()}>
          Choisir le dossier
        </Button>
      </>
    ) : (
      <>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Dossier</dt>
            <dd className="truncate font-semibold text-ink-900">{sync.folder}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">État</dt>
            <dd className="font-semibold text-ink-900">{look.label.replace("Excel auto : ", "")}</dd>
          </div>
          {sync.savedAt && (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Dernière écriture</dt>
              <dd className="font-semibold text-ink-900">
                {sync.savedAt} · {sync.files} fichier{sync.files > 1 ? "s" : ""}
              </dd>
            </div>
          )}
        </dl>
        {sync.state === "permission" && <p className="mt-3 rounded-lg bg-warn-50 px-3 py-2 text-sm text-ink-800">Le navigateur redemande l&apos;autorisation d&apos;écrire dans ce dossier après un redémarrage. Vos données restent enregistrées dans le site.</p>}
        {sync.error && <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{sync.error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {sync.state === "permission" && (
            <Button icon={<FolderOpen className="h-4 w-4" />} onClick={() => void excelSync.resume()}>
              Réautoriser le dossier
            </Button>
          )}
          {sync.state === "error" && (
            <Button icon={<RefreshCw className="h-4 w-4" />} onClick={() => excelSync.retry()}>
              Réessayer
            </Button>
          )}
          <Button variant="outline" onClick={() => void excelSync.choose()}>
            Changer de dossier
          </Button>
          <Button variant="ghost" onClick={() => void excelSync.stop()}>
            Désactiver
          </Button>
        </div>
      </>
    )}
      </div>
    </Modal>
  );
}
