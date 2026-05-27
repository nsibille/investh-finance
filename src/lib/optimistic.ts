export type MutationResult = { ok: true } | { ok: false; error: string };

/**
 * Runs a mutation optimistically: applies the UI change immediately, fires the
 * server action, and rolls back + surfaces the error if it fails. The UI never
 * waits on the round-trip before reflecting the change.
 */
export async function runOptimistic<T extends MutationResult>(opts: {
  apply: () => void;
  rollback: () => void;
  run: () => Promise<T>;
  onError?: (error: string) => void;
}): Promise<T> {
  opts.apply();
  const res = await opts.run();
  if (!res.ok) {
    opts.rollback();
    opts.onError?.(res.error);
  }
  return res;
}
