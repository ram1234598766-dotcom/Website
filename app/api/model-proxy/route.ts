import { handleApiRequest, serverEnv } from '@/src/lib/server/api-router';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return handleApiRequest(request, serverEnv());
}

export async function POST(request: Request): Promise<Response> {
  return handleApiRequest(request, serverEnv());
}

export async function OPTIONS(request: Request): Promise<Response> {
  return handleApiRequest(request, serverEnv());
}