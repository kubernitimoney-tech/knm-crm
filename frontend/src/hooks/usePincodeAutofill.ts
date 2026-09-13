import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPincodeDetails, type PincodeDetails } from '@/lib/pincodeApi';
import { digitsOnly } from '@/lib/indiaValidators';

const LOOKUP_DEBOUNCE_MS = 350;

export function usePincodeAutofill() {
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

  const lookupPincode = useCallback(
    (pincode: string, onResolved: (details: PincodeDetails) => void, onError?: (message: string) => void) => {
      const normalized = digitsOnly(pincode, 6);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (normalized.length !== 6) {
        setIsLookingUp(false);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        const requestId = ++requestIdRef.current;
        setIsLookingUp(true);
        try {
          const details = await fetchPincodeDetails(normalized);
          if (requestId === requestIdRef.current) {
            onResolved(details);
          }
        } catch {
          if (requestId === requestIdRef.current) {
            onError?.('Could not find details for this PIN code.');
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

  return { lookupPincode, isLookingUp };
}
