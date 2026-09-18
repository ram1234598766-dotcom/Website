/**
 * Race router for Omni-AI: runs WebModel and server-side Gemini
 * concurrently; whichever answers first wins. Neither provider's
 * failure is shown to the user if the other succeeds.
 *
 * Strategy: Promise.any on two tagged promises — the first to settle
 * (fulfill or reject) determines the winner. The loser's result is
 * discarded silently. If both reject, Promise.any throws an
 * AggregateError that the caller surfaces as a single combined message.
 */

export type RaceWinner = 'webmodel' | 'gemini';

export interface RaceResult {
  winner: RaceWinner;
  text: string;
}

/**
 * Run WebModel and Gemini in a race; first successful answer wins.
 *
 * @param webmodelFn - factory that starts the in-browser WebModel query (rejects on failure)
 * @param geminiFn - factory that starts the server-side Gemini fallback (rejects on failure)
 * @returns the winner identity and response text from whichever provider answered first
 */
export async function raceQuery(
  webmodelFn: () => Promise<string>,
  geminiFn: () => Promise<string>,
  timeoutMs = 120_000,
): Promise<RaceResult> {
  let cancelled = false;
  const cancelLoser = () => { cancelled = true; };
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
    cancelLoser();
  }, timeoutMs);
  const webmodelPromise = webmodelFn().then((text) => ({ winner: 'webmodel' as RaceWinner, text }));
  const geminiPromise = geminiFn().then((text) => ({ winner: 'gemini' as RaceWinner, text }));
  webmodelPromise.catch(() => { if (!cancelled) cancelLoser(); });
  geminiPromise.catch(() => { if (!cancelled) cancelLoser(); });
  try {
    const result = await Promise.any<RaceResult>([webmodelPromise, geminiPromise]);
    return result;
  } catch (err: any) {
    const aggregate = new AggregateError(
      err.errors ?? [err],
      'All providers failed or timed out',
    );
    throw aggregate;
  } finally {
    clearTimeout(timeout);
    cancelLoser();
  }
}
