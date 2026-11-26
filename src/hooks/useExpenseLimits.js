import { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage, getExpenseLimits, getStoredUser, updateExpenseLimits } from '../services/api.js';
import { subscribeExpenseLimits } from '../services/expenseLimitEvents.js';

export default function useExpenseLimits() {
  const [record, setRecord] = useState({ limits: {}, revision: 0, syncPending: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const applyRecord = useCallback((next) => {
    setRecord((current) => next.revision >= current.revision ? next : current);
  }, []);

  useEffect(() => {
    let active = true;
    const userId = getStoredUser()?.id;
    const unsubscribe = subscribeExpenseLimits(({ userId: eventUserId, record }) => {
      if (!active || String(eventUserId) !== String(userId)) return;
      applyRecord(record);
    });
    getExpenseLimits()
      .then((nextRecord) => {
        if (!active) return;
        applyRecord(nextRecord);
      })
      .catch((cause) => { if (active) setError(getApiErrorMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [applyRecord]);

  const saveLimits = useCallback(async (nextLimits) => {
    setError('');
    try {
      const saved = await updateExpenseLimits(nextLimits);
      applyRecord(saved);
      return saved;
    } catch (cause) {
      setError(getApiErrorMessage(cause));
      throw cause;
    }
  }, [applyRecord]);

  return { limits: record.limits, syncPending: record.syncPending, loading, error, saveLimits };
}
