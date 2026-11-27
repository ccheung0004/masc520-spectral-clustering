import {NextResponse} from "next/server";
import {isAdmin,authResponse} from "../../../../../lib/admin-auth";
import {libraryDB,BUCKET,ensureResult} from "../../../../../lib/library-db";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!isAdmin(req))return authResponse();
 try{
  const {id}=await params,db=libraryDB();
  const item=ensureResult(await db.from("mg_items").select("*").eq("id",id).single());
  const versions=ensureResult(await db.from("mg_versions").select("*").eq("item_id",id).order("version_no",{ascending:false}).limit(100));
  const source=ensureResult(await db.storage.from(BUCKET).download(item.source_path));
  return NextResponse.json({item,versions,source:JSON.parse(await source.text())});
 }catch(e){console.error("[MathGPT] item detail",e);return NextResponse.json({error:e instanceof Error?e.message:"Item not found"},{status:500});}
}
