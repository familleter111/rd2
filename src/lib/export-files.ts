/**
 * Minimal client-side file builders for the dossier export (screen 52):
 * a paginated text PDF (Helvetica, WinAnsi) and a stored (uncompressed) ZIP archive.
 * No dependency: both formats are written byte by byte.
 */

export interface PdfLine {
  text: string;
  size?: number;
  bold?: boolean;
  /** Extra space before the line, in points. */
  gap?: number;
}

/* Characters outside Latin-1 that WinAnsiEncoding maps to 0x80–0x9F. */
const WIN_ANSI: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "„": 0x84,
  "…": 0x85,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "Œ": 0x8c,
  "œ": 0x9c,
};

function winAnsi(text: string) {
  let out = "";
  for (const ch of text.replace(/ | /g, " ")) {
    const code = ch.charCodeAt(0);
    if (code < 256) out += ch;
    else if (WIN_ANSI[ch]) out += String.fromCharCode(WIN_ANSI[ch]);
    else out += "?";
  }
  return out.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text: string, maxChars: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current ? `${current} ${w}` : w).length > maxChars && current) {
      lines.push(current);
      current = w;
    } else current = current ? `${current} ${w}` : w;
  }
  lines.push(current);
  return lines;
}

const toBytes = (binary: string) => Uint8Array.from(binary, (c) => c.charCodeAt(0));

/** Builds an A4 PDF from lines of text (automatic wrapping and pagination). */
export function buildPdf(lines: PdfLine[]): Blob {
  const W = 595;
  const H = 842;
  const M = 56;
  const pages: string[] = [];
  let ops: string[] = [];
  let y = H - M;
  for (const line of lines) {
    const size = line.size ?? 11;
    const leading = size * 1.45;
    const chunks = line.text ? wrap(line.text, Math.floor((W - 2 * M) / (size * 0.5))) : [""];
    y -= line.gap ?? 0;
    for (const chunk of chunks) {
      if (y - leading < M) {
        pages.push(ops.join("\n"));
        ops = [];
        y = H - M;
      }
      y -= leading;
      if (chunk) ops.push(`BT /${line.bold ? "F2" : "F1"} ${size} Tf ${M} ${y.toFixed(1)} Td (${winAnsi(chunk)}) Tj ET`);
    }
  }
  pages.push(ops.join("\n"));

  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 5 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((content, i) => {
    const pageId = pageIds[i];
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objects[pageId + 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([toBytes(out)], { type: "application/pdf" });
}

/* ------------------------------------------------------------------ */
/* ZIP (stored entries)                                                */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Builds a ZIP archive (no compression) from text or binary files. */
export function buildZip(files: { name: string; content: string | Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  // DOS date/time of the demo date (24/09/2026 12:00).
  const time = (12 << 11) | (0 << 5);
  const date = ((2026 - 1980) << 9) | (9 << 5) | 24;
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = enc.encode(file.name);
    const data = typeof file.content === "string" ? enc.encode(file.content) : file.content;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), name, data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint16(12, time, true);
    dir.setUint16(14, date, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + data.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type: "application/zip" });
}

/** Triggers the download of a generated file. */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
