"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export default function Login(){
 const [password,setPassword]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);const router=useRouter();
 async function login(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{const r=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password})});const d=await r.json();if(!r.ok)throw Error(d.error||"Sign-in failed");router.push("/library");router.refresh();}catch(e){setError(e instanceof Error?e.message:"Sign-in failed");}finally{setBusy(false);}}
 return <main><section className="panel" style={{maxWidth:490,margin:"64px auto"}}><div className="eyebrow">MathGPT Admin</div><h1>Sign in</h1><p className="note">Use your private admin password. All generation and saved-library routes require this login.</p><form onSubmit={login}><div className="field"><label htmlFor="password">Admin password</label><input type="password" id="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></div><button disabled={busy}>{busy?"Signing in…":"Sign in"}</button>{error&&<p className="error">{error}</p>}</form></section></main>;
}
