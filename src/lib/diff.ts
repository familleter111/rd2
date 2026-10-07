/** Word-level comparison of two texts: what stayed, what was removed and what was added. */
export interface DiffPart {
  text: string;
  kind: "same" | "del" | "add";
}

const tokens = (t: string) => t.match(/\s+|[^\s]+/g) ?? [];

export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokens(before);
  const b = tokens(after);
  // Longest common subsequence of the tokens.
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const parts: DiffPart[] = [];
  const push = (text: string, kind: DiffPart["kind"]) => {
    const last = parts[parts.length - 1];
    if (last?.kind === kind) last.text += text;
    else parts.push({ text, kind });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) push(a[i++], (j++, "same"));
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) push(a[i++], "del");
    else push(b[j++], "add");
  }
  while (i < a.length) push(a[i++], "del");
  while (j < b.length) push(b[j++], "add");
  return parts;
}
