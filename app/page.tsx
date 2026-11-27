"use client";
import { useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { Generated } from "../lib/content";
import { MaterialPreview } from "../components/MaterialPreview";
import { Sheet } from "../components/WorksheetSheet";

const topics=["Functions and Function Notation","Polynomial Functions","Rational Functions","Exponential and Logarithmic Functions","Trigonometry","Systems of Equations","Linear Algebra","Calculus","Other"];
function esc(t:string) {return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function richHTML(t:string) {
  const sections=t.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);
  return sections.map(s=>{
    if (s.startsWith("$$") && s.endsWith("$$")) return katex.renderToString(s.slice(2,-2),{displayMode:true,throwOnError:true,trust:false});
    if (s.startsWith("$") && s.endsWith("$")) return katex.renderToString(s.slice(1,-1),{throwOnError:true,trust:false});
    return esc(s).replace(/\n/g,"<br/>");
  }).join("");
}
function MathText({value}:{value:string}) {return <span className="math-inline" dangerouslySetInnerHTML={{__html:richHTML(value)}}/>;}
function Equation({tex}:{tex:string}) {return <div className="math-equation" dangerouslySetInnerHTML={{__html:katex.renderToString(tex,{displayMode:true,throwOnError:true,trust:false})}}/>;}

export default function Home() {
  const [textbook,setTextbook]=useState("OpenStax Precalculus 2e");
  const [topic,setTopic]=useState(topics[0]);
  const [problem,setProblem]=useState("");
  const [result,setResult]=useState<Generated|null>(null);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const worksheetRef=useRef<HTMLDivElement>(null);

  async function generate() {
    setBusy("generating");setError("");setResult(null);
    try {
      const response=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({textbook,topic,problem})});
      const data=await response.json();
      if (!response.ok) throw new Error(`${data.error??"Generation failed"} — ${data.stage??"unknown stage"} ${Array.isArray(data.issues)?data.issues.join("; "):data.detail??data.code??""}`);
      setResult(data as Generated);
    } catch(e) {setError(e instanceof Error?e.message:"Generation failed");}
    finally {setBusy("");}
  }
  async function downloadSlides() {
    if(!result) return;
    setBusy("slides");setError("");
    try {const {exportSlides}=await import("../lib/export-slides");await exportSlides(result.slides,result.topic);}
    catch(e) {setError(`PowerPoint export failed: ${e instanceof Error?e.message:String(e)}`);}
    finally {setBusy("");}
  }
  async function downloadWorksheet() {
    if(!worksheetRef.current||!result) return;
    setBusy("pdf");setError("");
    try {
      const {default:html2pdf}=await import("html2pdf.js");
      const slug=result.topic.toLowerCase().replace(/[^a-z0-9]+/g,"-");
      // Fit overlong KaTeX displays before html2canvas captures the worksheet.
      // Avoid hiding/cropping math; allow additional PDF pages when necessary.
      const oversizedMath = worksheetRef.current.querySelectorAll<HTMLElement>(".katex-display");
      oversizedMath.forEach((el) => {
        el.style.fontSize = "1em";
        const maxWidth = el.clientWidth || el.parentElement?.clientWidth || 1;
        const contentWidth = el.scrollWidth;
        if (contentWidth > maxWidth) {
          el.style.fontSize = `${Math.max(0.55, maxWidth / contentWidth)}em`;
        }
      });
      if (worksheetRef.current.scrollWidth > worksheetRef.current.clientWidth + 2) {
        throw new Error("Worksheet has content wider than the PDF page; shorten an oversized equation or table before exporting.");
      }
      const pdfSheet = worksheetRef.current.querySelector<HTMLElement>(".case-sheet");
      if (!pdfSheet) throw new Error("Printable worksheet is unavailable");
      await html2pdf().set({margin:0,filename:`MathGPT-${slug}-case-study.pdf`,image:{type:"jpeg",quality:.99},html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff",windowWidth:816},jsPDF:{unit:"in",format:"letter",orientation:"portrait"},pagebreak:{mode:["css","legacy"],avoid:[".case-heading",".case-question",".case-answer","tr"]}}).from(pdfSheet).save();
    } catch(e) {setError(`Worksheet export failed: ${e instanceof Error?e.message:String(e)}`);}
    finally {setBusy("");}
  }
  const w=result?.worksheet;
  return <main>
    <header><p className="library-nav"><a href="/batch">Batch ZIP upload</a><a href="/library">Saved Library & review ✓ / ✕</a><a href="/login">Admin sign-in</a></p>
      <div className="eyebrow">MathGPT · Learning Studio</div>
      <p><a href="/batch">Batch upload: generate from many source bundles →</a></p>
      <h1>Generate worked-example slides & case-study worksheets</h1>
      <p className="subtitle">PowerPoint lessons in the exact structure of your Chain Rule example, and printable academic case studies based on The Coffee Shop Decision.</p>
    </header>
    <section className="panel">
      <div className="fields">
        <div className="field"><label htmlFor="textbook">Textbook</label><select id="textbook" value={textbook} onChange={e=>setTextbook(e.target.value)}><option>OpenStax Precalculus 2e</option><option>Stewart Precalculus 8th Edition</option><option>Other / teacher-provided</option></select></div>
        <div className="field"><label htmlFor="topic">Topic</label><select id="topic" value={topic} onChange={e=>setTopic(e.target.value)}>{topics.map(t=><option key={t}>{t}</option>)}</select></div>
      </div>
      <div className="field"><label htmlFor="problem">Source problem</label><textarea id="problem" maxLength={12000} value={problem} onChange={e=>setProblem(e.target.value)} placeholder="Paste the complete exercise, including numerical data and subparts..."/><div className="note">Only teacher-provided exercise text is used. The app does not retrieve textbook exercises automatically.</div></div>
      <button onClick={generate} disabled={!!busy||!problem.trim()}>{busy==="generating"?"Generating and checking…":"Generate Lesson & Case Study"}</button>
      {error&&<p className="error" role="alert">{error}</p>}
    </section>
    {result&&<section className="results" aria-label="Generated downloads">
      <article className="panel">
        <div className="result-header"><div><h2>Worked-example PowerPoint</h2><p className="note">Title slide · Sample problem · {result.slides.steps.length} step-by-step slides</p></div><button disabled={!!busy} onClick={downloadSlides}>{busy==="slides"?"Rendering slides…":"Download PowerPoint (.pptx)"}</button></div>
        <MaterialPreview generated={result} />
      </article>
      <article className="panel">
        <div className="result-header"><div><h2>Case-study Worksheet</h2><p className="note">Real-world scenario · Data · {w?.questions.length} questions · Answer key</p></div><button disabled={!!busy} onClick={downloadWorksheet}>{busy==="pdf"?"Rendering PDF…":"Download Worksheet (.pdf)"}</button></div>
        <p className="note">{w?.title} — {w?.topic}</p>
        <p className="note">Formatting modeled on your supplied one-page LaTeX worksheet; longer problems may require an extra page.</p>
      </article>
      <div className="checks"><strong>Checks:</strong> {result.checks.latex} {result.checks.math}</div>
    </section>}
    {w&&<div className="pdf-offscreen" aria-hidden="true"><div ref={worksheetRef}><Sheet w={w} id="single" /></div></div>}
  </main>;
}
