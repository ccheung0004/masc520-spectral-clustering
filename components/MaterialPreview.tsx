"use client";
import { useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { Generated } from "../lib/content";
import { Sheet } from "./WorksheetSheet";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function richHtml(value: string) {
  return value.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g).map(part => {
    try {
      if (part.startsWith("$$") && part.endsWith("$$"))
        return katex.renderToString(part.slice(2, -2), {displayMode:true,throwOnError:true,trust:false});
      if (part.startsWith("$") && part.endsWith("$"))
        return katex.renderToString(part.slice(1, -1), {throwOnError:true,trust:false});
    } catch { /* Keep invalid expression visible for correction. */ }
    return escapeHtml(part).replace(/\n/g, "<br/>");
  }).join("");
}
function Rich({value}: {value:string}) {
  return <span dangerouslySetInnerHTML={{__html:richHtml(value)}} />;
}
function Equation({tex}: {tex:string}) {
  let html = "";
  try { html=katex.renderToString(tex,{displayMode:true,throwOnError:true,trust:false}); }
  catch { return <pre className="preview-invalid-math">{tex}</pre>; }
  return <div className="preview-equation" dangerouslySetInnerHTML={{__html:html}} />;
}

export function MaterialPreview({generated}:{generated:Generated}) {
  const [tab,setTab]=useState<"slides"|"worksheet">("slides");
  const [slideIndex,setSlideIndex]=useState(0);
  const [showAnswer,setShowAnswer]=useState(true);
  const deck=generated.slides;
  const total=deck.steps.length+2;
  const index=Math.max(0,Math.min(slideIndex,total-1));
  const step=index>=2?deck.steps[index-2]:undefined;
  return <section className="material-preview" aria-label="Complete generated material preview">
    <div className="preview-tabs" role="tablist" aria-label="Material type">
      <button type="button" className={tab==="slides"?"selected":""} onClick={()=>setTab("slides")} role="tab" aria-selected={tab==="slides"}>PowerPoint · {total} slides</button>
      <button type="button" className={tab==="worksheet"?"selected":""} onClick={()=>setTab("worksheet")} role="tab" aria-selected={tab==="worksheet"}>Full worksheet</button>
    </div>
    {tab==="slides" ? <div>
      <div className="preview-navigation">
        <button type="button" className="copy" onClick={()=>setSlideIndex(i=>Math.max(i-1,0))} disabled={index===0}>← Previous</button>
        <label className="preview-slide-select">Slide <select value={index} onChange={e=>setSlideIndex(Number(e.target.value))} aria-label="Choose slide">
          <option value={0}>1 · Title</option><option value={1}>2 · Sample problem</option>
          {deck.steps.map((s,i)=><option value={i+2} key={i}>{i+3} · {s.title}</option>)}
        </select> of {total}</label>
        <button type="button" className="copy" onClick={()=>setSlideIndex(i=>Math.min(i+1,total-1))} disabled={index===total-1}>Next →</button>
      </div>
      <div className="preview-slide-viewport">
        <div className={"preview-slide-canvas "+(index===0?"preview-title-slide":"")}>
          {index===0 ? <div className="preview-slide-cover">
            <div className="preview-cover-label">{deck.label.toUpperCase()}</div>
            <h3>{deck.title}</h3><p>{deck.subtitle}</p>
          </div> : <div className="preview-slide-paper">
            {index===1 ? <div className="preview-sample">
              <div className="preview-eyebrow">{deck.label.toUpperCase()}</div>
              <h3>Sample Problem</h3><p><Rich value={deck.sample_lead}/></p>
              <div className="preview-sample-equations">{deck.sample_equations.map((eq,i)=><Equation key={i} tex={eq}/>)}</div>
              <p><Rich value={deck.sample_prompt}/></p>
              <div className="preview-slide-footer">Continue to Step 1</div>
            </div> : step && <>
              <div className="preview-slide-heading"><h3>Step {index-1}: {step.title}</h3><span>Step {index-1} of {deck.steps.length}</span></div>
              <div className="preview-slide-columns">
                <div className="preview-slide-math">{step.equations.map((eq,i)=><Equation key={i} tex={eq}/>)}</div>
                <div className="preview-slide-explain"><p><Rich value={step.explanation}/></p>
                  <aside className="preview-slide-tip"><strong>{step.tip_label}</strong><p><Rich value={step.tip}/></p></aside>
                </div>
              </div>
              <div className="preview-slide-footer">{index===total-1?"End of worked example":`Continue to Step ${index}`}</div>
            </>}
          </div>}
        </div>
      </div>
      <p className="preview-note">Complete slide content preview. The exported PowerPoint may split long steps across continuation slides to prevent overlap.</p>
    </div> : <div>
      <div className="preview-navigation"><strong>Worksheet · {generated.worksheet.questions.length} questions</strong>
        <label className="preview-answer-toggle"><input type="checkbox" checked={showAnswer} onChange={e=>setShowAnswer(e.target.checked)}/> Show answer key</label>
      </div>
      <div className={"preview-worksheet-viewport "+(!showAnswer?"preview-hide-answers":"")}>
        <Sheet w={generated.worksheet} id="visible" />
      </div>
      <p className="preview-note">Full worksheet content, including the scenario, data, every question and the answer key. The page scrolls when needed.</p>
    </div>}
  </section>;
}
