import { NextResponse } from "next/server";
import { makeAdminCookie, validPassword } from "../../../../lib/admin-auth";
export const runtime="nodejs";
export async function POST(req:Request) {
  try {
    const body:unknown=await req.json();
    const password=typeof body==="object"&&body!==null&&"password" in body && typeof body.password==="string"?body.password:"";
    if(!validPassword(password))return NextResponse.json({error:"Incorrect admin password"},{status:401});
    const response=NextResponse.json({ok:true});
    const c=makeAdminCookie();response.cookies.set(c.name,c.value,c.options);
    return response;
  }catch(e){console.error("[MathGPT] login",e);return NextResponse.json({error:"Login configuration error"},{status:503});}
}
