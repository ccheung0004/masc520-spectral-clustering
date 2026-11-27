import { createClient } from "@supabase/supabase-js";
export const BUCKET = "mathgpt-private";
export function libraryDB() {
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Render");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function ensureResult<T>(data:T|null,error:{message:string}|null):T {
  if(error)throw new Error(`Storage error: ${error.message}`);
  if(data===null)throw new Error("Storage returned no data");
  return data;
}
