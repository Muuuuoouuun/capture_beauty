import { getToolById } from "@/lib/tools";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const tool = getToolById(params.id);
  if (!tool) {
    return Response.json({ message: "Tool not found." }, { status: 404 });
  }
  return Response.json({ tool }, { status: 200 });
}
