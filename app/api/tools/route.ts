import { getAllTools } from "@/lib/tools";

export async function GET() {
  return Response.json({ tools: getAllTools() }, { status: 200 });
}
