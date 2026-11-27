"use client";
import { useState } from "react";
import type { Generated } from "../../lib/content";
import { Sheet } from "../../components/WorksheetSheet";
import { MaterialPreview } from "../../components/MaterialPreview";

type Bundle = {
  id:string;
  primary:string;
  problem:string;
  verified_answer:string;
  lo_mapping:Record<string,unknown>;
  supporting:string;
  extras:string[];
  originalFiles:{filename:string;data:Uint8Array}[];
};
type Result = {id:string;generated?:Generated;imathas?:{
  control:string;question:string;explanation:string;audit_notes:string;status:string;checks:string[]
};error?:string;imathasError?:string};

const safeId=(v:string)=>v.replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,90);
function readableTopic(b:Bundle) {
  const target=b.lo_mapping.target_lo;
  const objective=b.lo_mapping.learning_objective;
  return typeof target==="string" && target.trim() ? target.slice(0,180) : typeof objective==="string" && objective.trim() ? objective.slice(0,180) : b.id.replace(/[_-]/g," ");
}
async function parseZip(file:File):Promise<{bundles:Bundle[];skipped:string[]}> {
  const JSZip=(await import("jszip")).default;
  if(file.size > 60*1024*1024) throw new Error("ZIP exceeds 60 MB. Split it into smaller batches.");
  const zip=await JSZip.loadAsync(file);
  const groups=new Map<string,{file:string;entry:{async(type:"uint8array"):Promise<Uint8Array>}}[]>();
  const skipped:string[]=[];
  let total = 0;
  for(const [name,entry] of Object.entries(zip.files)) {
    if(entry.dir || name.startsWith("__MACOSX/") || name.includes("/._")) continue;
    if(name.startsWith("/") || name.split("/").includes("..")) { skipped.push(`Unsafe path ignored: ${name}`);continue; }
    total++;
    if(total>500) throw new Error("Too many files; split into smaller batches (max 500 entries).");
    const bits=name.split("/").filter(Boolean);
    if(bits.length<2) { skipped.push(`Top-level shared file retained outside bundles: ${name}`); continue; }
    const group=bits.slice(0,-1).join("/");
    const list=groups.get(group)||[];list.push({file:bits[bits.length-1],entry});groups.set(group,list);
  }
  const bundles:Bundle[]=[];
  for(const [folder,entries] of groups) {
    const byName=new Map(entries.map(e=>[e.file.toLowerCase(),e]));
    const primary=byName.get("primary.md");
    const question=byName.get("problem.txt")??byName.get("question.txt");
    const answer=byName.get("verified_answer.txt");
    if (!primary || !question || !answer) {skipped.push(`${folder}: missing primary.md, problem.txt/question.txt or verified_answer.txt`);continue;}
    const loaded:{filename:string;data:Uint8Array}[]=[];
    const decoded=new Map<string,string>();
    let folderBytes=0;
    for(const {file:filename,entry} of entries) {
      const bytes=await entry.async("uint8array");folderBytes+=bytes.byteLength;
      if(folderBytes>12*1024*1024) throw new Error(`${folder}: files exceed the 12 MB per-problem limit`);
      loaded.push({filename,data:bytes});
      if(/\.(txt|md|json|csv)$/i.test(filename) || filename==="FINALIZED_template") {
        decoded.set(filename.toLowerCase(),new TextDecoder().decode(bytes));
      }
    }
    let lo_mapping:Record<string,unknown>={};
    if(decoded.has("lo_mapping.json")) {
      try {const raw=JSON.parse(decoded.get("lo_mapping.json")!);if(raw && typeof raw==="object" && !Array.isArray(raw)) lo_mapping=raw;}
      catch {skipped.push(`${folder}: invalid lo_mapping.json (continuing without mapping)`);}
    }
    const other=entries.filter(e=>!["primary.md","problem.txt","question.txt","verified_answer.txt","lo_mapping.json"].includes(e.file.toLowerCase()));
    const supporting=other.filter(e=>decoded.has(e.file.toLowerCase())).map(e=>`=== ${e.file} ===\n${decoded.get(e.file.toLowerCase())}`).join("\n\n").slice(0,16000);
    bundles.push({id:folder,primary:decoded.get("primary.md")??"",problem:decoded.get(question.file.toLowerCase())??"",verified_answer:decoded.get("verified_answer.txt")??"",lo_mapping,supporting,extras:other.map(e=>e.file),originalFiles:loaded});
  }
  if(bundles.length>40) throw new Error("Maximum 40 problem bundles per batch. Split into smaller ZIPs.");
  if(!bundles.length) throw new Error("No valid problem folders. Each must contain primary.md, problem.txt (or question.txt), and verified_answer.txt.");
  return {bundles,skipped};
}
async function postJSON<T>(url:string,body:unknown):Promise<T> {
  const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await res.json();
  if(!res.ok) throw new Error(`${data.stage??"API"}: ${data.detail??data.error??data.code??`HTTP ${res.status}`}`);
  return data as T;
}

export default function BatchClient() {
  const [zipFile,setZipFile]=useState<File|null>(null);
  const [savedIds,setSavedIds]=useState<Record<string,string>>({});
  const [savedBatchId,setSavedBatchId]=useState("");
  const [bundles,setBundles]=useState<Bundle[]>([]);
  const [skipped,setSkipped]=useState<string[]>([]);
  const [results,setResults]=useState<Result[]>([]);
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState("");
  const [error,setError]=useState("");
  const [includeImathas,setIncludeImathas]=useState(true);
  const [previewId,setPreviewId]=useState("");
  async function selectZip(file?:File) {
    setError("");setResults([]);setBundles([]);setSkipped([]);setSavedIds({});setSavedBatchId("");setZipFile(file??null);
    if(!file)return;
    try {const parsed=await parseZip(file);setBundles(parsed.bundles);setSkipped(parsed.skipped);}
    catch(e){setError(e instanceof Error?e.message:"Invalid ZIP");}
  }
  async function saveBatch():Promise<Record<string,string>> {
    if(!zipFile || !bundles.length)throw new Error("Select a valid ZIP first");
    setProgress("Saving source ZIP and extracted problem bundles to private storage…");
    const form=new FormData();
    form.append("zip",zipFile);
    form.append("bundles",JSON.stringify(bundles.map(b=>({id:b.id,primary:b.primary,problem:b.problem,verified_answer:b.verified_answer,lo_mapping:b.lo_mapping,supporting:b.supporting}))));
    const res=await fetch("/api/library/upload",{method:"POST",body:form});
    const data=await res.json();
    if(res.status===401) {window.location.assign("/login");throw new Error("Sign in to save uploaded ZIPs");}
    if(!res.ok)throw new Error(data.error??"Saving ZIP failed");
    const mapping=Object.fromEntries((data.items as {folder:string;id:string}[]).map(item=>[item.folder,item.id]));
    setSavedIds(mapping);setSavedBatchId(data.batchId);
    return mapping;
  }
  async function saveOnly() {
    setBusy(true);setError("");
    try{await saveBatch();setProgress("Saved to your library. You can generate now or return later.");}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function generateBatch() {
    if(!bundles.length)return;
    setBusy(true);setError("");setResults([]);
    let mapping=savedIds;
    try{if(!savedBatchId)mapping=await saveBatch();}catch(e){setError(e instanceof Error?e.message:String(e));setBusy(false);return;}
    const all:Result[]=[];
    for(let i=0;i<bundles.length;i++) {
      const b=bundles[i];
      setProgress(`Generating ${i+1} / ${bundles.length}: ${b.id}`);
      const item:Result={id:b.id};
      try {
        item.generated=await postJSON<Generated>("/api/generate",{
          textbook:typeof b.lo_mapping.package_id==="string"?b.lo_mapping.package_id:"Uploaded source bundle",
          topic:readableTopic(b),problem:b.problem,
          sourceBundle:{primary:b.primary,problem:b.problem,verified_answer:b.verified_answer,lo_mapping:b.lo_mapping,supporting:b.supporting}
        });
      } catch(e) {item.error=e instanceof Error?e.message:String(e);}
      if(includeImathas) {
        try {
          item.imathas=await postJSON<NonNullable<Result["imathas"]>>("/api/generate-imathas",b);
        } catch(e) {item.imathasError=e instanceof Error?e.message:String(e);}
      }
      if(mapping[b.id]) {
        try {
          await postJSON(`/api/library/items/${mapping[b.id]}/versions`,{
            generated:item.generated,imathas:item.imathas,error:item.error,imathasError:item.imathasError
          });
        } catch(e){item.error=[item.error,`Saving history failed: ${e instanceof Error?e.message:String(e)}`].filter(Boolean).join("; ");}
      }
      all.push(item);setResults([...all]);
    }
    setProgress(`Finished ${all.length} bundle${all.length===1?"":"s"}.`);setBusy(false);
  }
  async function downloadAll() {
    setBusy(true);setError("");
    try {
      const [{default:JSZip},{exportSlides},{default:html2pdf}]=await Promise.all([
        import("jszip"),import("../../lib/export-slides"),import("html2pdf.js")
      ]);
      const archive=new JSZip();
      const report:string[][]=[["problem","slides","worksheet","imathas","error"]];
      for(let i=0;i<bundles.length;i++) {
        const b=bundles[i],res=results.find(r=>r.id===b.id);
        if(!res)continue;
        setProgress(`Packaging ${i+1} / ${bundles.length}: ${b.id}`);
        const dir=archive.folder(safeId(b.id))!;
        const originals=dir.folder("source_bundle")!;
        b.originalFiles.forEach(f=>originals.file(f.filename,f.data));
        if(res.generated) {
          dir.file("generation.json",JSON.stringify(res.generated,null,2));
          try {
            const pptx=await exportSlides(res.generated.slides,res.generated.topic,true);
            if(!pptx) throw new Error("Empty PowerPoint");
            dir.file("worked_example.pptx",pptx);
            const sheet=Array.from(document.querySelectorAll<HTMLElement>("[data-bundle-sheet]")).find(el=>el.dataset.bundleSheet===b.id);
            if(!sheet)throw new Error("Worksheet render missing");
            const spans=sheet.querySelectorAll<HTMLElement>(".katex-display");
            spans.forEach(el=>{el.style.fontSize="1em";if(el.scrollWidth>el.clientWidth && el.clientWidth>0)el.style.fontSize=`${Math.max(.55,el.clientWidth/el.scrollWidth)}em`;});
            if(sheet.scrollWidth > sheet.clientWidth+2) throw new Error("Worksheet content exceeds page width; PDF blocked");
            const pdf=await html2pdf().set({margin:0,filename:"worksheet.pdf",image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff",windowWidth:816},jsPDF:{unit:"in",format:"letter",orientation:"portrait"},pagebreak:{mode:["css","legacy"],avoid:[".case-heading",".case-question",".case-answer","tr"]}}).from(sheet).outputPdf("blob");
            dir.file("case_study_worksheet.pdf",pdf);
          } catch(e) {
            dir.file("EXPORT_ERROR.txt",e instanceof Error?e.message:String(e));
          }
        }
        if(res.imathas) {
          const im=res.imathas;
          dir.file("imathas_draft.txt",`common control\n\`\`\`php\n${im.control}\n\`\`\`\n\nquestion\n\`\`\`html\n${im.question}\n\`\`\`\n\nexplanation\n\`\`\`\n${im.explanation}\n\`\`\`\n`);
          dir.file("IMATHAS_AUDIT_REPORT.md",`# Preliminary IMathAS audit\n\n**Status: DRAFT — NOT LIVE VERIFIED**\n\n${im.audit_notes}\n\n## Checks performed\n${im.checks.map(s=>`- ${s}`).join("\n")}\n\n## Mandatory human checks\n- Test multiple seeds, including edge values, in live IMathAS\n- Confirm answer acceptance and incorrect answer rejection\n- Check TeX and plotting in the target platform\n- Check alignment, originality and copyright restrictions\n- Apply the uploaded audit rubric and policy addendum before publishing\n`);
        }
        if(res.error || res.imathasError)dir.file("GENERATION_ERRORS.txt",[res.error&&`Slides/worksheet: ${res.error}`,res.imathasError&&`IMathAS: ${res.imathasError}`].filter(Boolean).join("\n"));
        report.push([b.id,res.generated?"generated":"failed",res.generated?"generated":"failed",res.imathas?"draft":"not generated",[res.error,res.imathasError].filter(Boolean).join(" | ")]);
      }
      archive.file("batch_summary.csv",report.map(r=>r.map(s=>`"${String(s).replace(/"/g,'""')}"`).join(",")).join("\n"));
      archive.file("README.txt","MathGPT batch export. One folder per source bundle. PPTX and PDF generated from AI-audited material. IMathAS drafts are NOT platform-tested; run seed/answer validation and human review before publishing. Uploaded PDF/image references are included in source_bundle but are not automatically extracted by the current website.\n");
      const zipBlob=await archive.generateAsync({type:"blob"});
      const url=URL.createObjectURL(zipBlob);const a=document.createElement("a");a.href=url;a.download="MathGPT-batch-results.zip";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      setProgress("Batch ZIP downloaded.");
    }catch(e){setError(`ZIP export failed: ${e instanceof Error?e.message:String(e)}`);}
    finally {setBusy(false);}
  }
  const successes=results.filter(r=>r.generated).length;
  return <main>
    <header><div className="eyebrow">MathGPT · Batch Studio</div><h1>Upload, save and generate problem bundles</h1><p className="subtitle">Upload one ZIP with multiple problem folders. Each valid folder produces a PowerPoint, worksheet PDF, optional IMathAS draft, and verification metadata.</p><p><a href="/">← Single-problem generator</a></p></header>
    <section className="panel"><h2>1. Upload your source ZIP</h2><p className="note">Each folder needs <code>primary.md</code>, <code>problem.txt</code> (or <code>question.txt</code>), and <code>verified_answer.txt</code>. Add <code>lo_mapping.json</code> and supporting files if available.</p>
      <input type="file" accept=".zip,application/zip" disabled={busy} onChange={e=>void selectZip(e.target.files?.[0])}/>
      <div className="library-nav"><button disabled={busy||!bundles.length||!!savedBatchId} onClick={()=>void saveOnly()}>{savedBatchId?"✓ ZIP saved in library":"Save ZIP to library"}</button><a href="/library">View past uploads & reviews</a></div>
      {bundles.length>0&&<><p><b>{bundles.length} valid bundle(s) found.</b></p><div className="batch-scroll">{bundles.map(b=><div key={b.id} className="batch-row"><strong>{b.id}</strong><small>{readableTopic(b)} · {b.extras.length} supporting files</small></div>)}</div></>}
      {skipped.length>0&&<details><summary>{skipped.length} skipped files / folder warnings</summary><ul>{skipped.map((s,i)=><li key={i}>{s}</li>)}</ul></details>}
    </section>
    <section className="panel" style={{marginTop:18}}><h2>2. Generate and audit</h2><label style={{display:"flex",alignItems:"center",gap:8,marginBottom:15}}><input type="checkbox" checked={includeImathas} disabled={busy} style={{width:18}} onChange={e=>setIncludeImathas(e.target.checked)}/>Include IMathAS drafts and preliminary audit reports</label>
      <button disabled={busy || !bundles.length} onClick={()=>void generateBatch()}>{busy?"Working…":`Generate ${bundles.length} bundle(s)`}</button>
      {progress&&<p role="status" className="note">{progress}</p>}
      {savedBatchId&&<p className="note">Source ZIP safely stored. All new attempts will be saved as versions. <a href="/library">Go to Saved Library</a> to approve or regenerate.</p>}
      {results.length>0&&<><p>{successes} of {results.length} PowerPoint/worksheet generations succeeded.</p><div className="batch-scroll">{results.map(r=><div className="batch-row" key={r.id}><strong>{r.id}</strong><small>{r.generated?"✓ Slides + worksheet generated":"✕ Slides/worksheet failed"} · {r.imathas?"IMathAS draft ready":r.imathasError?"IMathAS failed":"No IMathAS"}</small>{r.generated&&<button className="copy" type="button" onClick={()=>setPreviewId(prev=>prev===r.id?"":r.id)}>{previewId===r.id?"Hide full preview":"Preview all slides & worksheet"}</button>}{previewId===r.id&&r.generated&&<MaterialPreview key={r.id} generated={r.generated} />}{(r.error||r.imathasError)&&<small className="error">{r.error||r.imathasError}</small>}</div>)}</div></>}
      <button disabled={busy||!results.length} onClick={()=>void downloadAll()} style={{marginTop:15}}>Download combined ZIP</button>
      {error&&<p className="error" role="alert">{error}</p>}
    </section>
    <p className="note" style={{marginTop:20}}>Only text-based supporting files are passed to the model. PDF and image references are retained in the exported source folders but not yet interpreted automatically. IMathAS output remains a draft until tested in the actual IMathAS environment. Each bundle runs sequentially to avoid losing the whole batch when a single item fails.</p>
    <div className="pdf-offscreen" aria-hidden="true">{results.map(r=>r.generated?<Sheet key={r.id} id={r.id} w={r.generated.worksheet}/>:null)}</div>
  </main>;
}
