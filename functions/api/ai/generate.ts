export async function onRequestPost(context: any) {
  try {
    const { prompt, messages } = await context.request.json();

    const apiKey =
      (context.env && context.env.GEMINI_API_KEY) ||
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: 'GEMINI_API_KEY not configured on server' },
        { status: 500 }
      );
    }

    let contents: { role: string; parts: { text: string }[] }[];
    if (messages && Array.isArray(messages)) {
      contents = messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));
    } else {
      contents = [{ role: 'user', parts: [{ text: prompt }] }];
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json(
        { error: text || `Gemini request failed (${res.status})` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text)
        .join('') || 'No response generated.';

    return Response.json({ text });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
