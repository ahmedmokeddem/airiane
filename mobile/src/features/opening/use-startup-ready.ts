import { useEffect, useState } from 'react';
import { openingTiming } from './timing';
/** A broken font must not strand authentication under the native splash. */
export function useStartupReady(fontsSettled: boolean) {
  const [deadline, setDeadline] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDeadline(true), openingTiming.readyDeadline);
    return () => clearTimeout(timer);
  }, []);
  return fontsSettled || deadline;
}
