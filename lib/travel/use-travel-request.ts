'use client';

import {useCallback, useEffect, useRef} from 'react';

/** Abort obsolete work and reject stale results, including pending GPS callbacks. */
export function useTravelRequest(context: string) {
  const latest = useRef(context);
  latest.current = context;
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => {controller.current?.abort();}, [context]);
  return useCallback(() => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    return {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(25000)]),
      current: () => !request.signal.aborted && controller.current === request && latest.current === context
    };
  }, [context]);
}
