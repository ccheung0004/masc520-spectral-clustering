"use client";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { CaseStudy } from "../lib/content";
const escapeHtml=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
function mathHtml(text:string) {
  const chunks=text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);
  return chunks.map(part=> {
    if(part.startsWith("$$")&&part.endsWith("$$")) return katex.renderToString(part.slice(2,-2),{displayMode:true,throwOnError:true,trust:false});
    if(part.startsWith("$")&&part.endsWith("$")) return katex.renderToString(part.slice(1,-1),{throwOnError:true,trust:false});
    return escapeHtml(part).replace(/\n/g,"<br/>");
  }).join("");
}
function MathText({value}:{value:string}) {return <span dangerouslySetInnerHTML={{__html:mathHtml(value)}}/>;}
export function Sheet({w,id}:{w:CaseStudy;id:string}) {
  return <div className="case-sheet" data-bundle-sheet={id}>
    <div className="case-heading"><span className="case-title">{w.title}</span><span className="case-topic">{w.topic}</span></div>
    <p className="case-story"><MathText value={w.story}/></p>
    {w.table&&<><p className="case-strong">Data / Records:</p><table className="case-table"><thead><tr>{w.table.headers.map((h,i)=><th key={i}><MathText value={h}/></th>)}</tr></thead><tbody>{w.table.rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}><MathText value={v}/></td>)}</tr>)}</tbody></table></>}
    {w.facts.length>0&&<><p className="case-strong">Known information:</p><ul>{w.facts.map((f,i)=><li key={i}><MathText value={f}/></li>)}</ul></>}
    <p className="case-decision"><MathText value={w.decision}/></p>
    <h3>Questions</h3>
    {w.questions.map((q,i)=><div className="case-question" key={i}><b>{i+1}) {q.title}</b><div><MathText value={q.prompt}/></div></div>)}
    <h3>Answer Key</h3>
    {w.answers.map((a,i)=><div className="case-answer" key={i}><i>{i+1})</i> <MathText value={a}/></div>)}
  </div>;
}
