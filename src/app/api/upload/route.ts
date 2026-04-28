import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getStorage } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "請選擇檔案" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "只支援圖片檔案" }, { status: 415 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "檔案不能超過 10MB" }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${uuidv4()}.${ext}`;

    const url = await getStorage().writeFile(`uploads/${filename}`, buffer);

    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "收據上傳失敗，請稍後再試" }, { status: 500 });
  }
}
