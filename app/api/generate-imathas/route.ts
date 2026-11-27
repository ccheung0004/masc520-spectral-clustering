import {isAdmin,authResponse} from "../../../lib/admin-auth";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isObject, isText } from "../../../lib/content";

export const runtime = "nodejs";

const root = path.join(process.cwd(), "reference");
const getReference = (file: string) => readFile(path.join(root, file), "utf8");

export async function POST(req: Request) {
  if(!isAdmin(req))return authResponse();
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");
    const { primary, problem, verified_answer, lo_mapping, supporting } = await req.json();
    if (![primary, problem, verified_answer].every(isText)) {
      return NextResponse.json({error:"Missing required source bundle files"}, {status:400});
    }
    const [referenceTemplate, policy, rubric] = await Promise.all([
      getReference("FINALIZED_template.txt"),
      getReference("IMATHAS_AUDIT_POLICY_ADDENDUM_v1_0.md"),
      getReference("Audit_criteria.csv"),
    ]);
    const client = new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY, timeout:180000,maxRetries:1});
    const source = JSON.stringify({primary,problem,verified_answer,lo_mapping,supporting:String(supporting??"").slice(0,12000)});
    const instructions = `You are a specialist IMathAS author. Generate a NEW randomized IMathAS problem from the uploaded Stage 1 source bundle.
The original problem's number of subparts, cognitive skill, level, and learning objective must be preserved.
Use the reference template for IMathAS language, but write ORIGINAL content; never copy its sample problem unchanged.
Output ONE JSON object with nonempty string fields: control, question, explanation, audit_notes.
"control" must be an IMathAS common control script using PHP-style IMathAS variables, $answer array, $anstypes array, and $questions arrays when appropriate.
"question" must be the IMathAS question HTML, including $answerbox[0], etc.
"explanation" must be an IMathAS solution explanation compatible with its environment.
"audit_notes" must describe uncertainty and any tests that must be done inside IMathAS.
For numeric/computational/mixed items, design >=10 meaningful seed variants; for purely conceptual-definition items, follow the attached variation exemption: no fixed question, shuffling options alone does not count.
Do not assert that code is certified or runtime-tested.
Return JSON only with standard escaping, no markdown fences.

REFERENCE TEMPLATE (style reference):\n${referenceTemplate.slice(0,7500)}

AUDIT POLICY:\n${policy.slice(0,5000)}

RUBRIC EXCERPT:\n${rubric.slice(0,11000)}`;
    const msg = await client.messages.create({model:process.env.CLAUDE_MODEL || "claude-sonnet-4-6",max_tokens:7000,system:instructions,messages:[{role:"user",content:source}]});
    if (msg.stop_reason === "max_tokens") throw new Error("IMathAS draft was truncated");
    const raw = msg.content.filter(x=>x.type==="text").map(x=>x.text).join("\n").trim();
    let output: Record<string, unknown>;
    try {
      output = JSON.parse(raw.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,""));
    } catch {
      // Never claim success when a response is malformed.
      throw new Error("IMathAS model output was not valid JSON; retry this bundle");
    }
    if (!isObject(output) || !["control","question","explanation","audit_notes"].every(k=>isText(output[k]))) {
      throw new Error("IMathAS draft did not contain required fields");
    }
    if (!String(output.control).includes("$answer") || !String(output.question).includes("$answerbox")) {
      throw new Error("IMathAS answer structure incomplete");
    }
    // A text-only structural check is NOT IMathAS runtime validation.
    return NextResponse.json({
      ...output,
      status:"DRAFT — human and IMathAS live seed testing required",
      checks:["Required IMathAS fields present","Answer variables and boxes present","No live IMathAS execution performed"],
    });
  } catch (error) {
    console.error("[MathGPT] IMATHAS_GENERATION",error);
    return NextResponse.json({error:"IMathAS draft generation failed",detail:error instanceof Error?error.message:"Unknown error"},{status:500});
  }
}
