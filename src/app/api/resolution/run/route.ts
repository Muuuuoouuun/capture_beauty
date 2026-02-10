import { NextResponse } from "next/server";
import { runResolutionSweep } from "@/lib/resolutionEngine";

export async function POST() {
  const result = await runResolutionSweep();
  return NextResponse.json(result);
}
