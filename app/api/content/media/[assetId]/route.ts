import { NextResponse } from "next/server";

import { readPublishedMedia } from "../../../../../src/modules/content/media-service";
import { toErrorResponse } from "../../../../../src/platform/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  try {
    const { assetId } = await context.params;
    const { file, bytes } = await readPublishedMedia(assetId);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": file.mimeType,
        "content-length": String(bytes.byteLength),
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
