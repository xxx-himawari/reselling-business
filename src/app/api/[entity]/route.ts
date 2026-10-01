import { db } from "@/infrastructure/db";
import { checkLocalRequest, errorResponse } from "@/infrastructure/http";
import {
  createRecord,
  listRecords,
  entities,
  Entity,
  RecordError,
} from "@/application/records";
export const dynamic = "force-dynamic";
async function entityFor(context: { params: Promise<{ entity: string }> }) {
  const { entity } = await context.params;
  if (!(entities as readonly string[]).includes(entity))
    throw new RecordError("対象がありません", 404);
  return entity as Entity;
}
export async function GET(
  request: Request,
  context: { params: Promise<{ entity: string }> },
) {
  try {
    checkLocalRequest(request);
    return Response.json(await listRecords(db, await entityFor(context)));
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(
  request: Request,
  context: { params: Promise<{ entity: string }> },
) {
  try {
    checkLocalRequest(request, true);
    return Response.json(
      await createRecord(db, await entityFor(context), await request.json()),
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
