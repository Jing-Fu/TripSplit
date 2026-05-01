import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteObject, isReceiptStorageKeyForUser } from "@/lib/storage";

export async function DELETE(request: Request) {
  const { user, error } = await requireUser(request);
  if (error || !user) return error;

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? "";

  if (!isReceiptStorageKeyForUser(key, user.id)) {
    return NextResponse.json({ error: "不支援刪除此檔案" }, { status: 400 });
  }

  await deleteObject(key);

  return NextResponse.json({ success: true });
}
