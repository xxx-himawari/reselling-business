import { z } from "zod";
import { db } from "@/infrastructure/db";
import { checkLocalRequest, errorResponse } from "@/infrastructure/http";
import { updateGoal } from "@/application/records";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    checkLocalRequest(request, true);
    const { id } = await context.params;
    return Response.json(
      await updateGoal(db, z.uuid().parse(id), await request.json()),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
