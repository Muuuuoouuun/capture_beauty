import { toolSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = toolSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ message: "Invalid payload.", errors: result.error.flatten() }, { status: 400 });
  }

  return Response.json(
    {
      tool: {
        id: crypto.randomUUID(),
        ...result.data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    },
    { status: 201 }
  );
}
