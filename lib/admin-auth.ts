import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "mathgpt_admin";
const MAX_AGE = 7 * 24 * 60 * 60;

function secret(): string {
  const s = process.env.MATHGPT_ADMIN_PASSWORD;
  if (!s || s.length < 12) throw new Error("Set MATHGPT_ADMIN_PASSWORD (12+ characters) in Render");
  return s;
}
function sign(timestamp: string) {
  return createHmac("sha256", secret()).update(`mathgpt:v1:${timestamp}`).digest("hex");
}
export function makeAdminCookie() {
  const ts = Math.floor(Date.now() / 1000).toString();
  return {name:COOKIE, value:`${ts}.${sign(ts)}`, options:{httpOnly:true, secure:process.env.NODE_ENV==="production", sameSite:"lax" as const, path:"/", maxAge:MAX_AGE}};
}
export function validPassword(value: string) {
  const target = Buffer.from(secret(),"utf8");
  const provided = Buffer.from(value,"utf8");
  return target.length === provided.length && timingSafeEqual(target,provided);
}
export function isAdmin(req: Request) {
  try {
    const cookie = req.headers.get("cookie") ?? "";
    const raw = cookie.split(";").map(s=>s.trim()).find(s=>s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
    if (!raw) return false;
    const [ts,signature,extra] = decodeURIComponent(raw).split(".");
    if (!ts || !signature || extra || !/^\d+$/.test(ts) || !/^[a-f0-9]{64}$/.test(signature)) return false;
    const age = Math.floor(Date.now()/1000) - Number(ts);
    if (age < 0 || age > MAX_AGE) return false;
    return timingSafeEqual(Buffer.from(signature),Buffer.from(sign(ts)));
  } catch { return false; }
}
export function authResponse() {return Response.json({error:"Please sign in to the MathGPT admin dashboard."},{status:401});}
