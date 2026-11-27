import {NextResponse} from "next/server";
import {isAdmin,authResponse} from "../../../../../../lib/admin-auth";
import {libraryDB,BUCKET,ensureResult} from "../../../../../../lib/library-db";
export const runtime="nodejs";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!isAdmin(req))return authResponse();
 try{const {id}=await params,db=libraryDB();const batch=ensureResult(await db.from("mg_batches").select("zip_path").eq("id",id).single());const signed=ensureResult(await db.storage.from(BUCKET).createSignedUrl(batch.zip_path,60));return NextResponse.redirect(signed.signedUrl);}
 catch(e){console.error("[MathGPT] zip download",e);return NextResponse.json({error:"ZIP download unavailable"},{status:500});}
}
