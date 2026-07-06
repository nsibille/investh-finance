export type MutationResult = { ok: true } | { ok: false; error: string };

/**
 * Runs a mutation optimistically: applies the UI change immediately, fires the
 * server action, and rolls back + surfaces the error if it fails. The UI never
 * waits on the round-trip before reflecting the change.
 *
 * Un Server Action peut soit renvoyer `{ ok: false }`, soit **lever une
 * exception** (rejet du POST par Next, erreur réseau, throw non géré). Sans
 * try/catch, ce second cas laissait l'UI optimiste en place sans rollback ni
 * message : l'utilisateur croyait avoir sauvegardé alors que rien n'était
 * persisté. On rattrape donc aussi les exceptions et on les traite comme un
 * échec normal (rollback + message d'erreur).
 */
export async function runOptimistic<T extends MutationResult>(opts: {
  apply: () => void;
  rollback: () => void;
  run: () => Promise<T>;
  onError?: (error: string) => void;
}): Promise<T | { ok: false; error: string }> {
  opts.apply();
  try {
    const res = await opts.run();
    if (!res.ok) {
      opts.rollback();
      opts.onError?.(res.error);
    }
    return res;
  } catch (e) {
    opts.rollback();
    const error =
      e instanceof Error && e.message
        ? e.message
        : "Échec de l'enregistrement (l'action serveur n'a pas abouti).";
    opts.onError?.(error);
    return { ok: false, error };
  }
}
