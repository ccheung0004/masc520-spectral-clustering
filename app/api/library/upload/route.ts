import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {isAdmin,authResponse} from "../../../../lib/admin-auth";
import {libraryDB,BUCKET,ensureResult} from "../../../../lib/library-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Source={id:string;primary:string;problem:string;verified_answer:string;lo_mapping?:Record<string,unknown>;supporting?:string};
function sourceOK(s:unknown):s is Source{
 if(!s||typeof s!=="object")return false;
 const v=s as Record<string,unknown>;
 return [v.id,v.primary,v.problem,v.verified_answer].every(x=>typeof x==="string"&&x.trim().length>0) &&
 [v.primary,v.problem,v.verified_answer].every(x=>(x as string).length<=150000)&&
 typeof v.id==="string"&&v.id.length<=180&&(!v.supporting||typeof v.supporting==="string"&&v.supporting.length<=16000);
}
export async function POST(req:Request){
 if(!isAdmin(req))return authResponse();
 try{
  const form=await req.formData(),zip=form.get("zip"),raw=form.get("bundles");
  if(!(zip instanceof File)||!zip.name.toLowerCase().endsWith(".zip")||zip.size>60*1024*1024||typeof raw!=="string")return NextResponse.json({error:"Upload one ZIP (max 60 MB) with a bundle manifest."},{status:400});
  const list:unknown=JSON.parse(raw);
  if(!Array.isArray(list)||!list.length||list.length>40||!list.every(sourceOK))return NextResponse.json({error:"Invalid bundle list (1–40 bundles required)."},{status:400});
  const bundles=list as Source[];
  if(new Set(bundles.map(b=>b.id)).size!==bundles.length)return NextResponse.json({error:"Duplicate problem folder identifiers"},{status:400});
  const db=libraryDB(),id=randomUUID(),zipPath=`${id}/source.zip`;
  const zipData=Buffer.from(await zip.arrayBuffer());
  ensureResult(await db.storage.from(BUCKET).upload(zipPath,zipData,{contentType:"application/zip",upsert:false}).then(r=>({data:r.data,error:r.error})));
  try{
    ensureResult(await db.from("mg_batches").insert({id,label:zip.name.slice(0,160),zip_path:zipPath}).select("id").single());
    const saved=[];
    for(const b of bundles){
      const itemId=randomUUID(),sourcePath=`${id}/items/${itemId}.json`;
      const source={primary:b.primary,problem:b.problem,verified_answer:b.verified_answer,lo_mapping:b.lo_mapping??{},supporting:b.supporting??""};
      ensureResult(await db.storage.from(BUCKET).upload(sourcePath,Buffer.from(JSON.stringify(source)),{contentType:"application/json",upsert:false}));
      const topic=(typeof b.lo_mapping?.target_lo==="string"?b.lo_mapping.target_lo:typeof b.lo_mapping?.learning_objective==="string"?b.lo_mapping.learning_objective:b.id).slice(0,250);
      ensureResult(await db.from("mg_items").insert({id:itemId,batch_id:id,folder_name:b.id,topic,source_path:sourcePath}).select("id").single());
      saved.push({folder:b.id,id:itemId,topic});
    }
    return NextResponse.json({batchId:id,items:saved});
  }catch(error){
    await db.from("mg_batches").delete().eq("id",id);
    const listed=await db.storage.from(BUCKET).list(`${id}/items`);
    const sourcePaths=(listed.data??[]).map(f=>`${id}/items/${f.name}`);
    await db.storage.from(BUCKET).remove([zipPath,...sourcePaths]);
    throw error;
  }
 }catch(e){console.error("[MathGPT] library upload",e);return NextResponse.json({error:e instanceof Error?e.message:"Upload failed"},{status:500});}
}
