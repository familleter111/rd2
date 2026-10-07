/**
 * Automatic Excel recording.
 *
 * Once a folder of the computer is chosen, every addition, change or removal rewrites the Excel
 * files in it: one workbook per project (all its steps) and one for the workspace. A browser cannot
 * write a file on its own: the folder is granted once through the File System Access API (Chrome,
 * Edge), and the grant is asked again after a restart of the browser.
 */
import { useSyncExternalStore } from "react";
import type { DemoState } from "./data";
import { projectWorkbook, workspaceWorkbook } from "./step-exports";
import { getDemoState, subscribeDemo } from "./store";
import { buildWorkbook, type Sheet } from "./xlsx";

interface DirHandle {
  name: string;
  queryPermission(o: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(o: { mode: "readwrite" }): Promise<PermissionState>;
  getFileHandle(name: string, o: { create: boolean }): Promise<{ createWritable(): Promise<{ write(data: BufferSource): Promise<void>; close(): Promise<void> }> }>;
}

export interface ExcelSyncStatus {
  /** The browser can write into a folder. */
  supported: boolean;
  folder: string | null;
  /** "permission": a folder is known but the browser asks for the grant again. */
  state: "off" | "permission" | "saving" | "saved" | "error";
  savedAt: string | null;
  files: number;
  error: string | null;
}

const supported = typeof window !== "undefined" && "showDirectoryPicker" in window;
const OFF: ExcelSyncStatus = { supported: false, folder: null, state: "off", savedAt: null, files: 0, error: null };
let status: ExcelSyncStatus = { ...OFF, supported };
let dir: DirHandle | null = null;
const listeners = new Set<() => void>();
const set = (patch: Partial<ExcelSyncStatus>) => {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
};

/* The folder handle is kept in IndexedDB: localStorage cannot hold it. */
const DB = "cipa-rd-files";
function idb<T>(run: (store: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore("handles");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = run(open.result.transaction("handles", mode).objectStore("handles"));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    };
  });
}

const fileName = (name: string) => `${name.replace(/[\\/:*?"<>|]/g, "-")}.xlsx`;

/** Workbooks to keep in the folder, by file name. */
function workbooks(s: DemoState): Map<string, Sheet[]> {
  const out = new Map<string, Sheet[]>();
  out.set(fileName("CIPA_RD_Espace"), workspaceWorkbook(s));
  for (const p of s.projects) if (p.cadrage) out.set(fileName(`CIPA_RD_${p.code}`), projectWorkbook(s, p));
  return out;
}

/** Content last written per file: an unchanged workbook is not rewritten. */
const written = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let again = false;

async function flush() {
  if (!dir) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    const all = workbooks(getDemoState());
    const changed = [...all].filter(([name, sheets]) => written.get(name) !== JSON.stringify(sheets));
    if (changed.length) set({ state: "saving", error: null });
    for (const [name, sheets] of changed) {
      const handle = await dir.getFileHandle(name, { create: true });
      const stream = await handle.createWritable();
      await stream.write(buildWorkbook(sheets).buffer as ArrayBuffer);
      await stream.close();
      written.set(name, JSON.stringify(sheets));
    }
    set({ state: "saved", files: all.size, savedAt: changed.length || !status.savedAt ? new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : status.savedAt, error: null });
  } catch (e) {
    const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
    set(denied ? { state: "permission", error: null } : { state: "error", error: "Écriture impossible : fermez le fichier s'il est ouvert dans Excel, puis modifiez une donnée ou cliquez sur « Réessayer »." });
  } finally {
    running = false;
    if (again) {
      again = false;
      void flush();
    }
  }
}

function schedule() {
  if (!dir || status.state === "permission") return;
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), 800);
}

async function activate(handle: DirHandle) {
  dir = handle;
  written.clear();
  set({ folder: handle.name, state: "saving", error: null });
  await flush();
}

export const excelSync = {
  /** Asks for the folder (user gesture) and writes every workbook at once. */
  async choose() {
    if (!supported) return;
    try {
      const handle = (await (window as unknown as { showDirectoryPicker(o: { mode: "readwrite" }): Promise<DirHandle> }).showDirectoryPicker({ mode: "readwrite" })) as DirHandle;
      await idb((store) => store.put(handle, "excel-dir"), "readwrite");
      await activate(handle);
    } catch {
      // Picker closed: nothing changes.
    }
  },
  /** Grants the known folder again (user gesture), after a restart of the browser. */
  async resume() {
    if (!dir) return;
    if ((await dir.requestPermission({ mode: "readwrite" })) === "granted") await activate(dir);
  },
  retry() {
    void flush();
  },
  async stop() {
    dir = null;
    written.clear();
    clearTimeout(timer);
    await idb((store) => store.delete("excel-dir"), "readwrite").catch(() => undefined);
    set({ folder: null, state: "off", savedAt: null, files: 0, error: null });
  },
};

if (supported) {
  subscribeDemo(schedule);
  // Back on the site: the folder chosen earlier is used again when the browser still allows it.
  idb<DirHandle | undefined>((store) => store.get("excel-dir"), "readonly")
    .then(async (handle) => {
      if (!handle) return;
      dir = handle;
      if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") await activate(handle);
      else set({ folder: handle.name, state: "permission" });
    })
    .catch(() => undefined);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useExcelSync() {
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => OFF,
  );
}
