import { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage, getExpenseLimits, updateExpenseLimits } from '../services/api.js';

export default function useExpenseLimits() {
  const [limits, setLimits] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getExpenseLimits()
      .then((result) => { if (active) setLimits(result); })
      .catch((cause) => { if (active) setError(getApiErrorMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const saveLimits = useCallback(async (nextLimits) => {
    setError('');
    try {
      const saved = await updateExpenseLimits(nextLimits);
      setLimits(saved);
      return saved;
    } catch (cause) {
      setError(getApiErrorMessage(cause));
      throw cause;
    }
  }, []);

  return { limits, loading, error, saveLimits };
}
