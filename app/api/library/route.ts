import {NextResponse} from "next/server";
import {isAdmin,authResponse} from "../../../lib/admin-auth";
import {libraryDB,ensureResult} from "../../../lib/library-db";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(req:Request){
 if(!isAdmin(req))return authResponse();
 try{
  const db=libraryDB();
  const [b,i,v]=await Promise.all([
    db.from("mg_batches").select("id,label,created_at").order("created_at",{ascending:false}).limit(200),
    db.from("mg_items").select("id,batch_id,folder_name,topic,created_at").order("created_at",{ascending:false}).limit(4000),
    db.from("mg_versions").select("id,item_id,version_no,review_status,status,created_at").order("created_at",{ascending:false}).limit(10000)
  ]);
  return NextResponse.json({batches:ensureResult(b),items:ensureResult(i),versions:ensureResult(v)});
 }catch(e){console.error("[MathGPT] library list",e);return NextResponse.json({error:e instanceof Error?e.message:"Library error"},{status:500});}
}
