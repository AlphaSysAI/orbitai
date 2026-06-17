import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/admin/is-admin";

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }
  return NextResponse.json({
    isAdmin: true,
    email: admin.user.email,
  });
}
