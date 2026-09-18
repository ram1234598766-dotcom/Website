import { NextRequest, NextResponse } from 'next/server';
import { handleApiRequest, serverEnv } from '@/src/lib/server/api-router';
import { withTimeout } from '@/src/lib/server/timeout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const _postHandler = async (req: NextRequest): Promise<NextResponse> => {
  return handleApiRequest(req, serverEnv()) as Promise<NextResponse>;
};

export const POST = withTimeout(_postHandler, 30000);

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return handleApiRequest(request, serverEnv()) as Promise<NextResponse>;
}