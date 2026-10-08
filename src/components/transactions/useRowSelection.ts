"use client";

import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Sélection multiple de lignes (clés stables). La sélection est recoupée avec
 * les clés visibles : une ligne filtrée ou paginée hors vue sort d'elle-même
 * de la sélection. Maj+clic étend la sélection depuis la dernière ligne cochée.
 */
export function useRowSelection(visibleKeys: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const lastKey = useRef<string | null>(null);

  const visibleSet = useMemo(() => new Set(visibleKeys), [visibleKeys]);
  const selectedKeys = useMemo(
    () => visibleKeys.filter((k) => selected.has(k)),
    [visibleKeys, selected],
  );

  const toggle = useCallback(
    (key: string, shift = false) => {
      setSelected((prev) => {
        const next = new Set(prev);
        const anchor = lastKey.current;
        if (shift && anchor && anchor !== key && visibleSet.has(anchor)) {
          const a = visibleKeys.indexOf(anchor);
          const b = visibleKeys.indexOf(key);
          const [from, to] = a < b ? [a, b] : [b, a];
          const on = !prev.has(key);
          for (let i = from; i <= to; i += 1) {
            if (on) next.add(visibleKeys[i]);
            else next.delete(visibleKeys[i]);
          }
        } else if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
      lastKey.current = key;
    },
    [visibleKeys, visibleSet],
  );

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const allOn = visibleKeys.length > 0 && visibleKeys.every((k) => prev.has(k));
      return allOn ? new Set() : new Set(visibleKeys);
    });
  }, [visibleKeys]);

  const clear = useCallback(() => {
    setSelected(new Set());
    lastKey.current = null;
  }, []);

  return {
    selectedKeys,
    isSelected: (key: string) => selected.has(key),
    toggle,
    toggleAll,
    clear,
  };
}
