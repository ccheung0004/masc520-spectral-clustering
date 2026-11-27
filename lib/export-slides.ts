"use client";
import type { SlideDeck } from "./content";

const NAVY = "1D2861";
const BLUE = "4166D5";
const SLATE = "F2F5FC";
const W = 13.333;
const H = 7.5;

type TextStyle = { fontFace?: string; fontSize?: number; bold?: boolean; color?: string; align?: string; valign?: string; italic?: boolean; fit?: string; [key:string]: unknown };
type Rect = {x:number; y:number; w:number; h:number};

/**
 * PowerPoint exporter with conservative text measurement, continuation slides,
 * image-size constraints and a final geometry check. Does not silently trim
 * generated educational content to fit a fixed-size textbox.
 */
export async function exportSlides(deck: SlideDeck, topic: string, asBlob = false): Promise<Blob | void> {
  const [{default:PptxGenJS}, {toPng}, {default:katex}] = await Promise.all([
    import("pptxgenjs"), import("html-to-image"), import("katex")
  ]);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "MathGPT Learning Studio";
  pptx.subject = topic;
  pptx.title = deck.title;
  pptx.theme = { headFontFace: "Georgia", bodyFontFace: "Arial" };
  const SH = pptx.ShapeType;

  // Canvas measures text in browser pixels. All geometry is specified in inches.
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas text measurement is unavailable");
  const PX_PER_INCH = 96;
  function wrapLines(text: string, fontSize: number, width: number, face = "Arial", bold = false): string[] {
    ctx!.font = `${bold ? "bold " : ""}${fontSize * PX_PER_INCH / 72}px ${face === "Georgia" ? "Georgia" : "Arial"}`;
    const maxWidth = width * PX_PER_INCH * 0.91;
    const result: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      if (!paragraph.trim()) { result.push(""); continue; }
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const maybe = line ? `${line} ${word}` : word;
        if (ctx!.measureText(maybe).width <= maxWidth) { line = maybe; continue; }
        if (line) result.push(line);
        line = "";
        // Long unbroken input must not overflow horizontally.
        for (const char of word) {
          if (ctx!.measureText(line + char).width > maxWidth && line) {
            result.push(line);
            line = char;
          } else line += char;
        }
      }
      if (line) result.push(line);
    }
    return result.length ? result : [""];
  }
  function fits(text:string, rect:Rect, fontSize:number, face="Arial", bold=false):boolean {
    const lines=wrapLines(text,fontSize,rect.w,face,bold);
    // 1.33 adds a conservative safety allowance for PowerPoint font metrics.
    return lines.length * fontSize / 72 * 1.33 <= rect.h * 0.93;
  }
  function safeFont(text:string, rect:Rect, preferred:number, minimum:number, face="Arial", bold=false):number {
    for(let fs=preferred;fs>=minimum;fs-=0.5) if(fits(text,rect,fs,face,bold)) return fs;
    throw new Error(`Text cannot fit at ${minimum}pt; a continuation slide is required: ${text.slice(0,70)}`);
  }
  function partitionText(text:string, rect:Rect, size:number, face="Arial", bold=false):string[] {
    const words=text.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const chunks:string[]=[];
    let current="";
    for(const word of words) {
      const proposed=current ? `${current} ${word}` : word;
      if(fits(proposed,rect,size,face,bold)) { current=proposed; continue; }
      if(current) {chunks.push(current);current="";}
      if(!fits(word,rect,size,face,bold)) throw new Error(`A long unbreakable word is too large: ${word.slice(0,75)}`);
      current=word;
    }
    if(current) chunks.push(current);
    return chunks;
  }
  const textBoxes:{ slideNumber:number; label:string; rect:Rect }[]=[];
  let slideNumber=0;
  function newSlide() { slideNumber++; return pptx.addSlide(); }
  function assertBox(label:string, rect:Rect) {
    if (rect.x < 0 || rect.y < 0 || rect.w <= 0 || rect.h <= 0 || rect.x+rect.w > W+0.002 || rect.y+rect.h > H+0.002) {
      throw new Error(`PowerPoint layout out of slide bounds: ${label}`);
    }
    textBoxes.push({slideNumber,label,rect});
  }
  function addText(slide:any,text:string,rect:Rect,opts:TextStyle={},minSize=11) {
    assertBox("text",rect);
    const face=opts.fontFace ?? "Arial";
    const bold=opts.bold===true;
    const fs=safeFont(text,rect,opts.fontSize??18,minSize,face,bold);
    const {x,y,w,h}=rect;
    
    slide.addText(text, {
  x, y, w, h,
  margin: 0,
  fontFace: face,
  color: NAVY,
  valign: "mid",
  breakLine: false,
  ...opts,
  fontSize: fs,
  fit: "shrink"
});

  }
  async function equationImage(tex:string):Promise<{data:string;ratio:number}> {
    const element=document.createElement("div");
    element.style.cssText="position:fixed;left:0;top:0;display:inline-block;white-space:nowrap;padding:18px;background:#f2f5fc;color:#1d2861;z-index:-9999;pointer-events:none;";
    element.style.fontSize="46px";
    katex.render(tex,element,{throwOnError:true,displayMode:true,trust:false,strict:"warn"});
    document.body.appendChild(element);
    try {
      await document.fonts.ready;
      const ratio=Math.max(.2,element.offsetWidth/Math.max(1,element.offsetHeight));
      const png=await toPng(element,{pixelRatio:2,cacheBust:true,backgroundColor:"#f2f5fc"});
      if (!png.startsWith("data:image/png;base64,") || png.length<500) throw new Error("Equation PNG output invalid");
      return {data:png,ratio};
    } finally { element.remove(); }
  }
  function frame(slide:any) {
    slide.background={color:NAVY};
    slide.addShape(SH.roundRect,{x:.45,y:.43,w:12.45,h:6.63,rectRadius:.12,radius:.15,line:{color:BLUE,width:1.35},fill:{color:"FFFFFF"}});
  }
  function addTop(slide:any,title:string,index:number,total:number,continued=false) {
    slide.addShape(SH.roundRect,{x:.7,y:.73,w:11.96,h:.86,rectRadius:.08,line:{color:NAVY},fill:{color:NAVY}});
    addText(slide,`Step ${index}: ${title}${continued?" (continued)":""}`,
      {x:1.04,y:.78,w:9.35,h:.70},{fontFace:"Georgia",fontSize:23,bold:true,color:"FFFFFF",valign:"mid"},15);
    addText(slide,`Step ${index} of ${total}`,
      {x:10.93,y:.94,w:1.35,h:.32},{fontSize:13,color:"D9E4FF",align:"right"},10);
  }
  async function addEquations(slide:any,equations:string[],area:Rect) {
    const count=equations.length;
    if(!count) return;
    const space=area.h/count;
    const maxHeight=Math.min(1.85,space-.14);
    if (maxHeight <= 0) throw new Error("Not enough vertical room for equations");
    for(let i=0;i<count;i++) {
      const tex=equations[i];
      const cy=area.y+(i+.5)*space;
      try {
        const img=await equationImage(tex);
        const drawW=Math.min(area.w-.34,maxHeight*img.ratio);
        const drawH=drawW/img.ratio;
        if(drawW<=0||drawH<=0||drawH>space) throw new Error("Equation image exceeds slot");
        slide.addImage({data:img.data,x:area.x+(area.w-drawW)/2,y:cy-drawH/2,w:drawW,h:drawH});
      } catch(err) {
        console.warn("[MathGPT] Equation render fallback",err);
        addText(slide,tex,{x:area.x+.15,y:cy-Math.min(.42,space/2),w:area.w-.3,h:Math.min(.84,space)},
          {fontFace:"Arial",fontSize:14,bold:true,align:"center",color:NAVY},9);
      }
    }
  }
  function addBody(slide:any,explanation:string,tipLabel:string,tip:string,footer:string) {
    slide.addShape(SH.roundRect,{x:.80,y:1.83,w:7.27,h:4.73,rectRadius:.10,line:{color:"D7DEED",width:1},fill:{color:SLATE}});
    if(explanation.trim()) addText(slide,explanation,{x:8.52,y:1.97,w:3.82,h:2.35},
      {fontSize:17,valign:"top"},14);
    slide.addShape(SH.roundRect,{x:8.44,y:4.72,w:4.11,h:1.76,rectRadius:.06,line:{color:BLUE,width:1.2,dash:"dash"},fill:{color:"FFFFFF"}});
    addText(slide,tipLabel.toUpperCase(),{x:8.74,y:4.91,w:3.42,h:.35},
      {fontSize:13,bold:true,color:BLUE},10);
    if(tip.trim()) addText(slide,tip,{x:8.74,y:5.31,w:3.39,h:1.0},
      {fontSize:15,valign:"top"},12);
    addText(slide,footer,{x:5.1,y:6.72,w:3.15,h:.30},
      {fontSize:14,italic:true,bold:true,color:BLUE,align:"center"},10);
  }
  // Title slide, with dedicated no-overlap lines.
  {
    const s=newSlide();s.background={color:NAVY};
    addText(s,deck.label.toUpperCase(),{x:.8,y:2.31,w:11.7,h:.48},
      {fontSize:21,bold:true,color:"D5E2FF"},14);
    addText(s,deck.title,{x:.8,y:2.96,w:11.7,h:1.12},
      {fontFace:"Georgia",fontSize:42,bold:true,color:"FFFFFF"},22);
    addText(s,deck.subtitle,{x:.8,y:4.29,w:11.7,h:.72},
      {fontSize:24,color:"EEF2FF"},15);
  }
  // The sample problem needs extra slides if its problem lead/prompt is unusually long.
  {
    const leadChunks=partitionText(deck.sample_lead,{x:1.09,y:2.13,w:11.05,h:.62},17);
    const promptChunks=partitionText(deck.sample_prompt,{x:1.09,y:4.62,w:11.13,h:.85},16);
    const pages=Math.max(leadChunks.length,promptChunks.length);
    for(let j=0;j<pages;j++) {
      const s=newSlide();frame(s);
      addText(s,deck.label.toUpperCase(),{x:1.09,y:.99,w:8,h:.26},{fontSize:12,bold:true},10);
      addText(s,j===0?"Sample Problem":"Sample Problem (continued)",
        {x:1.09,y:1.35,w:10.6,h:.52},{fontFace:"Georgia",fontSize:29,bold:true,color:BLUE},19);
      if(leadChunks[j]) addText(s,leadChunks[j],{x:1.09,y:2.13,w:11.05,h:.62},{fontSize:17},14);
      await addEquations(s,deck.sample_equations,{x:2.8,y:2.92,w:7.7,h:1.52});
      if(promptChunks[j]) addText(s,promptChunks[j],{x:1.09,y:4.62,w:11.13,h:.85},{fontSize:16},13);
      addText(s,j===pages-1?"Continue to Step 1":"Continue to next slide",
        {x:4.76,y:6.69,w:3.8,h:.29},
        {fontSize:14,italic:true,bold:true,color:BLUE,align:"center"},10);
    }
  }
  // Separate continuation slides retain explanations and hints without excessive shrinking.
  for(let i=0;i<deck.steps.length;i++) {
    const step=deck.steps[i];
    const explanationChunks=partitionText(step.explanation,{x:8.52,y:1.97,w:3.82,h:2.35},15);
    const tipChunks=partitionText(step.tip,{x:8.74,y:5.31,w:3.39,h:1},13);
    const pages=Math.max(explanationChunks.length,tipChunks.length);
    for(let page=0;page<pages;page++) {
      const s=newSlide();frame(s);
      addTop(s,step.title,i+1,deck.steps.length,page>0);
      const footer=(page<pages-1) ? "Continue to next slide" :
        (i===deck.steps.length-1 ? "End of worked example" : `Continue to Step ${i+2}`);
      addBody(s,explanationChunks[page]??"",step.tip_label,tipChunks[page]??"",footer);
      await addEquations(s,step.equations,{x:1,y:2.17,w:6.86,h:3.95});
    }
  }
  // All placed text rectangles are guaranteed inside the 16:9 slide bounds.
  if (!textBoxes.length) throw new Error("No slide text was generated");
  const slug=topic.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50);
  if(asBlob) return await pptx.write({outputType:"blob"}) as Blob;
  await pptx.writeFile({fileName:`MathGPT-${slug||"lesson"}-worked-example.pptx`});
}
