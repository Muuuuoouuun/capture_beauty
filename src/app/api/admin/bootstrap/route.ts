import { NextResponse } from "next/server";
import { Tier } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-bootstrap-secret");
  if (!secret || secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
    return NextResponse.json({ error: "Invalid bootstrap secret" }, { status: 401 });
  }

  const body = await req.json();
  const email = String(body.email ?? "admin@oracleguild.local").trim().toLowerCase();
  const name = String(body.name ?? "Guild Administrator").trim();

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, tier: Tier.ADMIN, reputationPoints: Math.max(Number(body.reputationPoints ?? 2500), 2500) },
    create: {
      email,
      name,
      tier: Tier.ADMIN,
      reputationPoints: Math.max(Number(body.reputationPoints ?? 2500), 2500)
    }
  });

  return NextResponse.json({ user, created: true });
}
