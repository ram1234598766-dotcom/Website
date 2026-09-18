import { NextRequest, NextResponse } from 'next/server';

export function withTimeout<T>(
  handler: (req: NextRequest) => Promise<NextResponse<T>>,
  timeoutMs = 10000,
): (req: NextRequest) => Promise<NextResponse<T>> {
  return async (req: NextRequest): Promise<NextResponse<T>> => {
    const requestId = req.headers.get('x-request-id') ?? undefined;
    try {
      const result = await Promise.race([
        handler(req),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs),
        ),
      ]);
      return result;
    } catch {
      return NextResponse.json(
        { error: 'Request timeout', requestId },
        { status: 504 },
      ) as NextResponse<T>;
    }
  };
}
