export type SlideStep = {
  title: string;
  equations: string[]; // Raw TeX with no surrounding delimiters
  explanation: string;
  tip_label: string;
  tip: string;
};
export type SlideDeck = {
  title: string;
  subtitle: string;
  label: string;
  sample_lead: string;
  sample_equations: string[];
  sample_prompt: string;
  steps: SlideStep[];
};
export type CaseStudy = {
  subject: string;
  title: string;
  topic: string;
  story: string;
  table: { headers: string[]; rows: string[][] } | null;
  facts: string[];
  decision: string;
  questions: { title: string; prompt: string }[];
  answers: string[];
};
export type Generated = {
  slides: SlideDeck;
  worksheet: CaseStudy;
  topic: string;
  textbook: string;
  checks: { latex: string; math: string; audit_notes: string[] };
};

export function isObject(o: unknown): o is Record<string, unknown> {
  return !!o && typeof o === "object" && !Array.isArray(o);
}
export function isText(t: unknown): t is string { return typeof t === "string" && t.trim().length > 0; }
export function parseObject(text: string): Record<string, unknown> {
  const str = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed: unknown = JSON.parse(str);
  if (!isObject(parsed)) throw new Error("Expected a JSON object");
  return parsed;
}
export function readDeck(raw: unknown): SlideDeck {
  if (!isObject(raw)) throw new Error("Slide deck missing");
  const { title, subtitle, label, sample_lead, sample_equations, sample_prompt, steps } = raw;
  if (![title, subtitle, label, sample_lead, sample_prompt].every(isText)) throw new Error("Slide deck title/problem fields missing");
  if (!Array.isArray(sample_equations) || sample_equations.length < 1 || sample_equations.length > 3 || !sample_equations.every(isText)) throw new Error("Slide sample equations invalid");
  if (!Array.isArray(steps) || steps.length < 3 || steps.length > 8) throw new Error("Expected 3 to 8 solution steps");
  for (const s of steps) {
    if (!isObject(s) || ![s.title,s.explanation,s.tip_label,s.tip].every(isText) || !Array.isArray(s.equations) || !s.equations.length || s.equations.length > 3 || !s.equations.every(isText)) throw new Error("Slide step content invalid");
  }
  return raw as unknown as SlideDeck;
}
export function readCase(raw: unknown): CaseStudy {
  if (!isObject(raw)) throw new Error("Worksheet content missing");
  const {subject,title,topic,story,table,facts,decision,questions,answers}=raw;
  if (![subject,title,topic,story,decision].every(isText)) throw new Error("Worksheet headings or story missing");
  if (!Array.isArray(facts) || facts.length > 6 || !facts.every(isText)) throw new Error("Worksheet facts invalid");
  if (table !== null) {
    if (!isObject(table)) throw new Error("Worksheet data table invalid");
    const headers = table.headers;
    const rows = table.rows;
    if (
      !Array.isArray(headers) ||
      headers.length < 2 || headers.length > 5 ||
      !headers.every(isText) ||
      !Array.isArray(rows) || rows.length > 6 ||
      !rows.every((row: unknown) =>
        Array.isArray(row) &&
        row.length === headers.length &&
        row.every(isText)
      )
    ) {
      throw new Error("Worksheet data table invalid");
    }
  }
  if (!Array.isArray(questions) || questions.length < 3 || questions.length > 5 || !questions.every(q=>isObject(q) && isText(q.title) && isText(q.prompt))) throw new Error("Worksheet questions invalid");
  if (!Array.isArray(answers) || answers.length !== questions.length || !answers.every(isText)) throw new Error("Worksheet answer-key count mismatch");
  return raw as unknown as CaseStudy;
}


/**
 * Claude sometimes writes analysis before its final audit JSON. Prefer a fenced
 * JSON block, otherwise scan for complete balanced JSON objects. Only accept
 * an object with the audit schema; never treat unparseable text as approval.
 */
export function parseAuditObject(text: string): Record<string, unknown> {
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  for (const match of fenced.reverse()) {
    try {
      const value: unknown = JSON.parse(match[1]);
      if (isObject(value) && typeof value.ok === "boolean" && Array.isArray(value.issues)) return value;
    } catch { /* Keep looking for a valid audit object. */ }
  }
  try {
    const value = parseObject(text);
    if (typeof value.ok === "boolean" && Array.isArray(value.issues)) return value;
  } catch { /* Scan below for a complete standalone JSON object. */ }
  const candidates: Record<string, unknown>[] = [];
  for (let start = 0; start < text.length; start++) {
    if (text[start] !== "{") continue;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let end = start; end < text.length; end++) {
      const char = text[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
      } else {
        if (char === '"') quoted = true;
        else if (char === "{") depth++;
        else if (char === "}") {
          depth--;
          if (depth === 0) {
            try {
              const value: unknown = JSON.parse(text.slice(start, end + 1));
              if (isObject(value) && typeof value.ok === "boolean" && Array.isArray(value.issues)) candidates.push(value);
            } catch { /* Ignore invalid JSON fragments. */ }
            break;
          }
        }
      }
    }
  }
  if (candidates.length) return candidates[candidates.length - 1];
  throw new Error("Audit did not return readable JSON; no materials were released");
}
