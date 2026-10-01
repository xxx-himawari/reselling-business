import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { RecordError } from "../application/records";

// Phase 1 is a loopback-only, single-user app. Prevent cross-site writes.
export function checkLocalRequest(request: Request, write = false) {
  const host = request.headers.get("host") ?? "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host))
    throw new RecordError("Phase 1はローカルアクセス専用です", 403);
  const origin = request.headers.get("origin");
  if (write && origin && origin !== `http://${host}`)
    throw new RecordError("別サイトからの更新は許可されていません", 403);
}
export function errorResponse(error: unknown): Response {
  if (error instanceof SyntaxError)
    return Response.json({ error: "JSONが不正です" }, { status: 400 });
  if (error instanceof ZodError)
    return Response.json(
      { error: "入力内容を確認してください", details: error.issues },
      { status: 400 },
    );
  if (error instanceof RecordError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return Response.json(
        { error: "同じ識別子・プランが既に登録されています" },
        { status: 409 },
      );
    if (["P2003", "P2004"].includes(error.code))
      return Response.json(
        { error: "参照先またはDB制約を確認してください" },
        { status: 422 },
      );
  }
  console.error(
    "record operation failed",
    error instanceof Error ? error.name : "unknown",
  );
  return Response.json(
    { error: "保存・取得に失敗しました。DBの起動状態を確認してください" },
    { status: 500 },
  );
}
