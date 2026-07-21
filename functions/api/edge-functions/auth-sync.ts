export async function onRequestPost(context: any) {
  const auth = context.request.headers.get('authorization');

  if (!auth || !auth.startsWith('Bearer ')) {
    return Response.json(
      { error: 'Unauthorized', message: 'Missing or invalid authentication token' },
      { status: 401 }
    );
  }

  return Response.json({
    success: true,
    message: 'Server-side validation passed',
  });
}
