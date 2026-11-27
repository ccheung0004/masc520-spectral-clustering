import katex from "katex";

/** Check raw LaTeX math code, and balanced $..$ / $$..$$ inline math. */
export function checkMath(expression: string, label: string) {
  try {
    katex.renderToString(expression, { throwOnError: true, strict: "warn", trust: false });
  } catch (error) {
    throw new Error(`Invalid LaTeX in ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
export function checkRichText(value: string, label: string) {
  let i = 0;
  while (i < value.length) {
    if (value[i] === "\\" && value[i + 1] === "$" ) { i += 2; continue; }
    if (value[i] !== "$" ) { i++; continue; }
    const delimiter = value[i+1] === "$" ? "$$" : "$";
    const start = i + delimiter.length;
    let end = start;
    while (end < value.length) {
      if (value[end] === "\\" && value[end+1] === "$") {end += 2; continue;}
      if (value.startsWith(delimiter, end)) break;
      end++;
    }
    if (end >= value.length) throw new Error(`Unclosed ${delimiter} math in ${label}`);
    if (!value.slice(start,end).trim()) throw new Error(`Empty math in ${label}`);
    checkMath(value.slice(start,end), label);
    i = end + delimiter.length;
  }
}
export function validateDeckLatex(s: {sample_equations:string[];steps:{equations:string[];title:string;explanation:string;tip:string}[]; title:string;subtitle:string;sample_lead:string;sample_prompt:string}) {
  for (const [i,e] of s.sample_equations.entries()) checkMath(e,`sample equation ${i+1}`);
  for (const [i,step] of s.steps.entries()) {
    step.equations.forEach((e,j) => checkMath(e,`slide ${i+1} equation ${j+1}`));
    for(const key of ["title","explanation","tip"] as const) checkRichText(step[key],`slide ${i+1} ${key}`);
  }
  [s.title,s.subtitle,s.sample_lead,s.sample_prompt].forEach((v,i)=>checkRichText(v,`slide intro ${i}`));
}
export function validateWorksheetLatex(w: {subject:string;title:string;topic:string;story:string;decision:string;facts:string[];table:null|{headers:string[];rows:string[][]};questions:{title:string;prompt:string}[];answers:string[]}) {
  [w.subject,w.title,w.topic,w.story,w.decision,...w.facts].forEach((v,i)=>checkRichText(v,`worksheet intro ${i}`));
  w.table?.headers.forEach((v,i)=>checkRichText(v,`worksheet header ${i}`));
  w.table?.rows.forEach((row,i)=>row.forEach((v,j)=>checkRichText(v,`worksheet table ${i}/${j}`)));
  w.questions.forEach((q,i)=>{checkRichText(q.title,`question ${i+1} title`);checkRichText(q.prompt,`question ${i+1} prompt`);checkRichText(w.answers[i],`answer ${i+1}`);});
}
