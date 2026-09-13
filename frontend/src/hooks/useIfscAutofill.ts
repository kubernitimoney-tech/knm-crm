import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchIfscDetails, type IfscDetails } from '@/lib/ifscApi';
import { IFSC_REGEX, upperAlphanumeric } from '@/lib/indiaValidators';

const LOOKUP_DEBOUNCE_MS = 350;

export function useIfscAutofill() {
  const [isLookingUp, setIsLookingUp] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const lookupIfsc = useCallback(
    (ifscCode: string, onResolved: (details: IfscDetails) => void, onError?: (message: string) => void) => {
      const normalized = upperAlphanumeric(ifscCode, 11);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!IFSC_REGEX.test(normalized)) {
        setIsLookingUp(false);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        const requestId = ++requestIdRef.current;
        setIsLookingUp(true);
        try {
          const details = await fetchIfscDetails(normalized);
          if (requestId === requestIdRef.current) {
            onResolved(details);
          }
        } catch {
          if (requestId === requestIdRef.current) {
            onError?.('Could not find bank details for this IFSC code.');
          }
        } finally {
          if (requestId === requestIdRef.current) {
            setIsLookingUp(false);
          }
        }
      }, LOOKUP_DEBOUNCE_MS);
    },
    [],
  );

  return { lookupIfsc, isLookingUp };
}
