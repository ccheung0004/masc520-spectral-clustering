import {NextResponse} from "next/server";
import {isAdmin,authResponse} from "../../../../../../lib/admin-auth";
import {libraryDB,ensureResult} from "../../../../../../lib/library-db";
export const runtime="nodejs";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!isAdmin(req))return authResponse();
 try{
  const {id}=await params,body=await req.json();
  if(!["approved","rejected"].includes(body.decision)||typeof body.versionId!=="string")return NextResponse.json({error:"Invalid review action"},{status:400});
  const db=libraryDB();
  const version=ensureResult(await db.from("mg_versions").select("id,status").eq("id",body.versionId).eq("item_id",id).single());
  if(version.status!=="generated")return NextResponse.json({error:"Failed generations cannot be approved/rejected"},{status:409});
  const update=ensureResult(await db.from("mg_versions").update({review_status:body.decision,reviewed_at:new Date().toISOString()}).eq("id",version.id).select("id,review_status").single());
  return NextResponse.json({review:update});
 }catch(e){console.error("[MathGPT] review",e);return NextResponse.json({error:e instanceof Error?e.message:"Review failed"},{status:500});}
}
