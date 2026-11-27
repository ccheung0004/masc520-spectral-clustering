import {NextResponse} from "next/server";
import {isAdmin,authResponse} from "../../../../../../lib/admin-auth";
import {libraryDB,ensureResult} from "../../../../../../lib/library-db";
export const runtime="nodejs";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!isAdmin(req))return authResponse();
 try{
  const {id}=await params,db=libraryDB(),body=await req.json();
  ensureResult(await db.from("mg_items").select("id").eq("id",id).single());
  const {data:previous,error:fetchError}=await db.from("mg_versions").select("version_no").eq("item_id",id).order("version_no",{ascending:false}).limit(1);
  if(fetchError)throw fetchError;
  const version_no=(previous?.[0]?.version_no??0)+1;
  if(body.generated && (typeof body.generated!=="object"||!body.generated.slides||!body.generated.worksheet))return NextResponse.json({error:"Invalid generated content"},{status:400});
  if(!body.generated&&!body.error)return NextResponse.json({error:"Provide generated content or a failure reason"},{status:400});
  const version=ensureResult(await db.from("mg_versions").insert({item_id:id,version_no,generated:body.generated??null,imathas:body.imathas??null,error_message:body.error??null,imathas_error:body.imathasError??null,status:body.generated?"generated":"failed",review_status:"pending"}).select("id,version_no,status,review_status").single());
  return NextResponse.json({version});
 }catch(e){console.error("[MathGPT] save version",e);return NextResponse.json({error:e instanceof Error?e.message:"Save failed"},{status:500});}
}
