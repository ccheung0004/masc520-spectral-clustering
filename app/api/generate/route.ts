import {isAdmin,authResponse} from "../../../lib/admin-auth";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseObject, parseAuditObject, readCase, readDeck, isText } from "../../../lib/content";
import { validateDeckLatex, validateWorksheetLatex } from "../../../lib/latex";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if(!isAdmin(req))return authResponse();
  let stage = "INPUT";
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");
    const { textbook, topic, problem, sourceBundle } = await req.json();
    const bundled = sourceBundle && typeof sourceBundle === "object" &&
      isText(sourceBundle.primary) && isText(sourceBundle.problem) && isText(sourceBundle.verified_answer);
    const givenProblem = bundled ? sourceBundle.problem : problem;
    if (!isText(textbook) || !isText(topic) || !isText(givenProblem) || givenProblem.length > 12000) {
      return NextResponse.json({ error:"Enter a textbook, topic and complete problem (under 12,000 characters)." }, {status:400});
    }
    const claude = new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY,timeout:180000,maxRetries:1});
    const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
    async function run(system:string,input:string,max_tokens=8192) {
      const msg = await claude.messages.create({model,max_tokens,system,messages:[{role:"user",content:input}]});
      if (msg.stop_reason === "max_tokens") throw new Error("Generation was truncated; try a shorter exercise");
      const text = msg.content.filter(b=>b.type==="text").map(b=>b.text).join("\n").trim();
      if (!text) throw new Error("Empty response from Claude");
      return text;
    }
    const read = (f:string)=>readFile(path.join(process.cwd(),"prompts",f),"utf8");
    stage = "LOAD_PROMPTS";
    const [p1,p2,p3] = await Promise.all([read("stage1.md"),read("stage2.md"),read("stage3.md")]);
    stage = "STAGE_1";
    console.log("[MathGPT]",stage);
    // User-provided Stage 1 bundles are authoritative. Do not regenerate their reference answer.
    const source = bundled ? [
      `Textbook/course: ${textbook}`,
      `Topic: ${topic}`,
      `=== primary.md ===\n${sourceBundle.primary}`,
      `=== problem.txt ===\n${sourceBundle.problem}`,
      `=== verified_answer.txt ===\n${sourceBundle.verified_answer}`,
      `=== lo_mapping.json ===\n${JSON.stringify(sourceBundle.lo_mapping ?? {})}`,
      `=== readable supporting context ===\n${String(sourceBundle.supporting ?? "").slice(0, 16000)}`,
      "The uploaded reference solution is the baseline for verification. Preserve the assessed skill and avoid reusing the original source question verbatim in new practice."
    ].join("\n\n") : await run(p1,`Textbook: ${textbook}\nTopic: ${topic}\nTeacher-provided problem:\n${givenProblem}\nDo not invent missing source information.`);
    const deckContract = `Return ONLY a JSON object with keys title, subtitle, label, sample_lead, sample_equations (1-2 RAW LaTeX math strings with NO $), sample_prompt, steps (ARRAY of 3-8 objects, each with title, equations (1-3 RAW LaTeX math strings without $), explanation, tip_label, tip). Ensure the last step verifies its answer. All text values are strings. Do not return backticks, markdown or explanations. Escape LaTeX backslashes as double backslashes inside JSON ("\\\\frac", "\\\\sqrt"). No $ delimiters around raw equation fields.`;
    const caseContract = `Return ONLY a JSON object with keys: subject, title, topic, story, table (either null or {headers: string[], rows: string[][]}), facts (string[]), decision (string), questions ([{title:string,prompt:string}] with 3-5 questions), answers (string[] EXACT same count). Include concrete internally consistent numbers, a narrative, and worked solutions. Output only JSON, no fences. In text fields, wrap mathematical expressions in $...$, escape LaTeX backslashes as double backslashes in JSON. Keep the title to at most 55 characters, do not put the course name (such as Precalculus) in the title, and use the actual topic field for the topic. Keep story, questions, and answers concise. Fit one US Letter page when feasible, but never sacrifice mathematical completeness; longer content may span additional pages.`;
    async function validated<T>(prompt:string, contract:string, convert:(v:unknown)=>T, validate:(v:T)=>void, stageName:string):Promise<T> {
      let feedback = "";
      for (let attempt=1;attempt<=2;attempt++) {
        const response=await run(prompt+"\n\n"+contract+feedback,source,8192);
        try { const obj=convert(parseObject(response)); validate(obj); return obj; }
        catch (e) {
          const error = e instanceof Error?e.message:String(e);
          console.warn(`[MathGPT] ${stageName} attempt ${attempt} schema/LaTeX failure:`,error);
          feedback = `\nPREVIOUS OUTPUT FAILED VALIDATION: ${error}. Correct ALL invalid LaTeX commands and structural errors. Return JSON only.`;
          if (attempt===2) throw new Error(`${stageName} validation failed: ${error}`);
        }
      }
      throw new Error("Unreachable");
    }
    // Generate both artifacts from the same verified source packet.
    // If the auditor flags a concrete error, regenerate BOTH artifacts with
    // explicit correction instructions and revalidate their schemas and LaTeX.
    let slides: ReturnType<typeof readDeck> | undefined;
    let worksheet: ReturnType<typeof readCase> | undefined;
    let notes: string[] = [];
    let passedAudit = false;
    let correctionFeedback = "";

    for (let round = 0; round < 3; round++) {
      stage = "STAGE_2";
      console.log("[MathGPT]", stage, "round", round + 1);
      slides = await validated(
        p2 + correctionFeedback,
        deckContract,
        readDeck,
        validateDeckLatex,
        "slides"
      );

      stage = "STAGE_3";
      console.log("[MathGPT]", stage, "round", round + 1);
      worksheet = await validated(
        p3 + correctionFeedback,
        caseContract,
        readCase,
        validateWorksheetLatex,
        "worksheet"
      );

      stage = "MATH_AUDIT";
      console.log("[MathGPT]", stage, "round", round + 1);
      const auditRaw = await run(
        `You are an independent mathematics auditor. Recompute every computation from the source, and check each slide step, worksheet prompt, answer, interpretation, and real-world statement. Check whether mathematical conclusions, including claims about spacing, symmetry, units, rounding, and the number of solutions, are valid. Return ONLY one JSON object, with NO analysis, preamble, markdown, code fences, or trailing commentary. Exactly this schema: {"ok":boolean,"issues":string[]}. When any concrete error exists, set ok=false and explain it precisely in issues. Do not accept unchecked or unjustified conclusions. If uncertain, set ok=false.`,
        JSON.stringify({source,slides,worksheet}),
        4096
      );
      const audit = parseAuditObject(auditRaw);
      if (typeof audit.ok !== "boolean" || !Array.isArray(audit.issues) || !audit.issues.every(x => typeof x === "string")) {
        throw new Error("Audit returned invalid schema: expected {ok:boolean, issues:string[]}");
      }
      notes = audit.issues.filter(isText).slice(0, 10);
      if (audit.ok === true && notes.length === 0) {
        passedAudit = true;
        break;
      }
      console.warn("[MathGPT] Audit flagged round", round + 1, notes);
      if (round < 2) {
        correctionFeedback = `\n\nMATHEMATICAL CORRECTION REQUIRED. An independent audit rejected the previous generated materials for these reasons: ${JSON.stringify(notes)}. Regenerate fully corrected content from the ORIGINAL Stage 1 source. Every mathematical assertion, worked solution, calculation, interval claim, and answer must be correct. Do not repeat the flagged errors. Maintain the required schema and return ONLY JSON.`;
      }
    }

    if (!passedAudit || !slides || !worksheet) {
      return NextResponse.json(
        {error:"Mathematical audit found issues that could not be resolved automatically; downloads blocked.", stage:"MATH_AUDIT", code:"MATH_REVIEW", issues:notes},
        {status:422}
      );
    }
    return NextResponse.json({ slides, worksheet, textbook, topic, checks:{latex:"All math markup passed strict KaTeX syntax validation.",math:"Independent AI audit passed; teacher review still recommended.",audit_notes:notes} });
  } catch (e:unknown) {
    const err=e as {status?:number;message?:string;error?:{type?:string}};
    console.error("[MathGPT] Failed",{stage,status:err.status,reason:err.message});
    return NextResponse.json({error:"Generation failed",stage,code:err.error?.type??"UNKNOWN",detail:stage === "STAGE_2" || stage === "STAGE_3" ? err.message : undefined},{status:500});
  }
}
