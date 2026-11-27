"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import type {Generated,CaseStudy} from "../../lib/content";
import {Sheet} from "../../components/WorksheetSheet";
import {MaterialPreview} from "../../components/MaterialPreview";
import katex from "katex";
import "katex/dist/katex.min.css";

type Batch={id:string;label:string;created_at:string};
type Item={id:string;batch_id:string;folder_name:string;topic:string;created_at:string};
type VersionSummary={id:string;item_id:string;version_no:number;review_status:"pending"|"approved"|"rejected";status:"generated"|"failed";created_at:string};
type Version=VersionSummary&{generated:Generated|null;imathas:Record<string,unknown>|null;error_message:string|null;imathas_error:string|null};
type Source={primary:string;problem:string;verified_answer:string;lo_mapping:Record<string,unknown>;supporting:string};
type Detail={item:Item;versions:Version[];source:Source};
type ItemRow={item:Item;latest:VersionSummary|undefined};
async function jsonFetch<T>(url:string,opts?:RequestInit):Promise<T>{const r=await fetch(url,opts);const d=await r.json();if(r.status===401){window.location.assign("/login");throw Error("Please sign in");}if(!r.ok)throw Error(d.error??d.detail??`HTTP ${r.status}`);return d as T;}
const jsonOptions=(value:unknown):RequestInit=>({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(value)});
function safeName(value:string){return value.replace(/[^\da-z_-]/gi,"-").slice(0,64)||"problem";}
function mathPreview(tex:string){try{return katex.renderToString(tex,{displayMode:true,throwOnError:true,trust:false});}catch{return tex.replace(/</g,"&lt;").replace(/>/g,"&gt;");}}
function textPreview(t:string){return t.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g).map(x=>{if(x.startsWith("$$")&&x.endsWith("$$"))return mathPreview(x.slice(2,-2));if(x.startsWith("$")&&x.endsWith("$"))try{return katex.renderToString(x.slice(1,-1),{throwOnError:true,trust:false});}catch{}return x.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");}).join("");}
export default function LibraryClient(){
 const [batches,setBatches]=useState<Batch[]>([]),[items,setItems]=useState<Item[]>([]),[versions,setVersions]=useState<VersionSummary[]>([]);
 const [selected,setSelected]=useState<string>(""),[detail,setDetail]=useState<Detail|null>(null),[selectedVersion,setSelectedVersion]=useState<string>("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [filter,setFilter]=useState("all"),[includeImathas,setIncludeImathas]=useState(true);
 const router=useRouter();
 async function refresh(){const response=await jsonFetch<{batches:Batch[];items:Item[];versions:VersionSummary[]}>("/api/library");setBatches(response.batches);setItems(response.items);setVersions(response.versions);}
 useEffect(()=>{refresh().catch(e=>setError(String(e))).finally(()=>setLoading(false));},[]);
 async function openItem(id:string){setBusy("open");setError("");try{const d=await jsonFetch<Detail>(`/api/library/items/${id}`);setDetail(d);setSelected(id);setSelectedVersion(d.versions[0]?.id??"");}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy("");}}
 const current=detail?.versions.find(v=>v.id===selectedVersion)||detail?.versions[0];
 const rows:ItemRow[]=items.map(item=>({item,latest:versions.find(v=>v.item_id===item.id)})).filter(({latest})=>filter==="all"||(filter==="unreviewed"?(!latest||latest.review_status==="pending"):latest?.review_status===filter));
 async function review(decision:"approved"|"rejected"){
  if(!detail||!current||!current.generated)return;
  setBusy(decision);setError("");setNotice("");
  try{
   await jsonFetch(`/api/library/items/${detail.item.id}/review`,jsonOptions({versionId:current.id,decision}));
   if(decision==="approved")setNotice(`Version ${current.version_no} approved. Its results are retained in your library.`);
   if(decision==="rejected"){
    setNotice(`Version ${current.version_no} rejected; regenerating from the saved source files…`);
    const source=detail.source;
    let generated:Generated|undefined,imathas:Record<string,unknown>|undefined,error="",imathasError="";
    try{
      generated=await jsonFetch<Generated>("/api/generate",jsonOptions({textbook:typeof source.lo_mapping?.package_id==="string"?source.lo_mapping.package_id:"Uploaded source bundle",topic:detail.item.topic,problem:source.problem,sourceBundle:source}));
    }catch(e){error=e instanceof Error?e.message:String(e);}
    if(includeImathas){try{imathas=await jsonFetch<Record<string,unknown>>("/api/generate-imathas",jsonOptions(source));}catch(e){imathasError=e instanceof Error?e.message:String(e);}}
    await jsonFetch(`/api/library/items/${detail.item.id}/versions`,jsonOptions({generated,imathas,error,imathasError}));
    setNotice(generated?"New version generated and saved as PENDING. Review it before approval.":"Regeneration failed; failure saved in version history. You can retry from the saved source.");
   }
   await refresh();await openItem(detail.item.id);
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy("");}
 }
 async function retry(){
  if(!detail)return;
  setBusy("retry");setError("");
  try{
   const s=detail.source;
   let generated:Generated|undefined,imathas:Record<string,unknown>|undefined,error="",imathasError="";
   try{generated=await jsonFetch<Generated>("/api/generate",jsonOptions({textbook:"Uploaded source bundle",topic:detail.item.topic,problem:s.problem,sourceBundle:s}));}catch(e){error=e instanceof Error?e.message:String(e);}
   if(includeImathas){try{imathas=await jsonFetch<Record<string,unknown>>("/api/generate-imathas",jsonOptions(s));}catch(e){imathasError=e instanceof Error?e.message:String(e);}}
   await jsonFetch(`/api/library/items/${detail.item.id}/versions`,jsonOptions({generated,imathas,error,imathasError}));
   setNotice("New attempt saved; review the newest version.");await refresh();await openItem(detail.item.id);
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy("");}
 }
 async function slides(){if(!current?.generated)return;setBusy("pptx");setError("");try{const {exportSlides}=await import("../../lib/export-slides");await exportSlides(current.generated.slides,current.generated.topic);}catch(e){setError(`PowerPoint export: ${String(e)}`);}finally{setBusy("");}}
 async function worksheet(){if(!current?.generated)return;setBusy("pdf");setError("");try{
   const element=document.querySelector("[data-library-sheet]") as HTMLElement|null;
   if(!element)throw Error("Worksheet HTML not available");
   const {default:html2pdf}=await import("html2pdf.js");
   await html2pdf().set({margin:0,filename:`MathGPT-${safeName(detail?.item.folder_name??"worksheet")}-v${current.version_no}.pdf`,image:{type:"jpeg",quality:.99},html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff",windowWidth:816},jsPDF:{unit:"in",format:"letter",orientation:"portrait"},pagebreak:{mode:["css","legacy"],avoid:[".case-heading",".case-question",".case-answer","tr"]}}).from(element).save();
  }catch(e){setError(`Worksheet export: ${String(e)}`);}finally{setBusy("");}}
 async function logout(){await fetch("/api/auth/logout",{method:"POST"});router.push("/login");router.refresh();}
 const byBatch=new Map(batches.map(b=>[b.id,rows.filter(r=>r.item.batch_id===b.id)]));
 return <main><header><div className="eyebrow">MathGPT · Saved Library</div><h1>Generated materials & audit review</h1><p className="subtitle">Keep your source ZIPs and every output version. Approve with ✓ or reject with ✕ to generate a new version from the same source.</p><nav className="library-nav"><a href="/batch">+ Upload another ZIP</a><a href="/">Single problem</a><button type="button" className="copy" onClick={()=>void logout()}>Sign out</button></nav></header>
  {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="library-notice" role="status">{notice}</p>}
  <section className="panel"><div className="result-header"><h2>Saved uploads ({batches.length})</h2><label>Filter <select style={{width:170}} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All</option><option value="unreviewed">Pending / not generated</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label></div>
  {loading?<p>Loading saved library…</p>:batches.length===0?<p>No saved ZIPs yet. <a href="/batch">Upload your first batch</a>.</p>:batches.map(batch=><div className="library-batch" key={batch.id}><div className="result-header"><div><strong>{batch.label}</strong><div className="note">Uploaded {new Date(batch.created_at).toLocaleString()} · {items.filter(i=>i.batch_id===batch.id).length} problems</div></div><a href={`/api/library/batches/${batch.id}/download`}>Download original ZIP</a></div>{(byBatch.get(batch.id)||[]).map(({item,latest})=><button type="button" key={item.id} className={`library-item ${selected===item.id?"selected":""}`} onClick={()=>void openItem(item.id)} disabled={!!busy}><span><strong>{item.folder_name}</strong><small>{item.topic}</small></span><span className="library-state">{latest?`${latest.status==="failed"?"Failed":latest.review_status} · v${latest.version_no}`:"Not generated"}</span></button>)}</div>)}
  </section>
  {detail&&<section className="panel" style={{marginTop:18}}><h2>Review: {detail.item.folder_name}</h2><p className="note">{detail.item.topic}</p><div className="field"><label htmlFor="version">Saved version</label><select id="version" value={selectedVersion} onChange={e=>setSelectedVersion(e.target.value)}>{detail.versions.map(v=><option key={v.id} value={v.id}>Version {v.version_no} · {v.review_status} · {v.status} · {new Date(v.created_at).toLocaleString()}</option>)}</select></div>
   <label className="library-check"><input type="checkbox" checked={includeImathas} onChange={e=>setIncludeImathas(e.target.checked)} disabled={!!busy}/> Regenerate IMathAS draft as well</label>
   {current?.generated?<><div className="library-actions"><button disabled={!!busy} onClick={()=>void slides()}>Download PowerPoint</button><button disabled={!!busy} onClick={()=>void worksheet()}>Download Worksheet PDF</button><button disabled={!!busy} className="library-approve" onClick={()=>void review("approved")}>✓ Approve</button><button disabled={!!busy} className="library-reject" onClick={()=>void review("rejected")}>✕ Reject & Regenerate</button></div><p className="note">Current review: <strong>{current.review_status}</strong>. Approval is your decision, separate from the model's LaTeX/mathematics check. Regeneration keeps old versions.</p><MaterialPreview key={current.id} generated={current.generated}/><details><summary>Automated checks & output metadata</summary><p><strong>Slides:</strong> {current.generated.slides.steps.length} worked steps</p><p><strong>Worksheet:</strong> {current.generated.worksheet.questions.length} questions</p><p><strong>Automated checks:</strong> {current.generated.checks.latex} {current.generated.checks.math}</p>{current.imathas&&<p>IMathAS draft saved (requires live platform testing).</p>}</details></>:<><p className="error">{current?.error_message||"No successful generation yet"}</p><button disabled={!!busy} onClick={()=>void retry()}>Retry generation from saved source</button></>}
   {busy&&<p className="note" role="status">{busy==="rejected"?"Regenerating and auditing; keep this tab open…":`${busy} in progress…`}</p>}
   {current?.generated&&<div className="pdf-offscreen" aria-hidden="true"><div data-library-sheet><Sheet w={current.generated.worksheet} id="library"/></div></div>}
  </section>}
  <p className="note" style={{marginTop:22}}>The source ZIP and output versions persist in Supabase. Regeneration runs while this tab is open; a durable background worker is a future production enhancement. IMathAS drafts are not live-system certified.</p>
 </main>;
}
