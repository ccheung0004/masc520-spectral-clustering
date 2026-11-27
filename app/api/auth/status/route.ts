import {isAdmin} from "../../../../lib/admin-auth";
export async function GET(req:Request){return Response.json({authenticated:isAdmin(req)});}
