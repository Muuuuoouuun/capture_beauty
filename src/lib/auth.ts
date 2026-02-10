import { Tier } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getActingUser(req: Request) {
  const userId = req.headers.get("x-user-id") ?? "seed-observer";
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function requireAdmin(req: Request) {
  const user = await getActingUser(req);
  if (!user || user.tier !== Tier.ADMIN) {
    return { ok: false as const, status: 403, message: "Admin access required" };
  }

  return { ok: true as const, user };
}
