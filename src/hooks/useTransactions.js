import { useCallback, useEffect, useState } from 'react';
import useAuth from './useAuth.js';
import { getStoredUser, getTransactions } from '../services/api.js';
import { subscribeTransactions } from '../services/transactionEvents.js';
import { getErrorMessage } from '../utils/errors.js';

export default function useTransactions() {
  const { user } = useAuth();
  const userId = String(user?.id ?? '');
  const [ownerId, setOwnerId] = useState(userId);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const current = await getTransactions();
      if (String(getStoredUser()?.id ?? '') === userId) {
        setOwnerId(userId);
        setTransactions(current);
        setError('');
      }
      return current;
    } catch (cause) {
      if (String(getStoredUser()?.id ?? '') === userId) {
        setOwnerId(userId);
        setError(getErrorMessage(cause, 'Data transaksi gagal dimuat.'));
      }
      throw cause;
    } finally {
      if (String(getStoredUser()?.id ?? '') === userId) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      setOwnerId('');
      setLoading(false);
      return undefined;
    }
    let active = true;
    let eventVersion = 0;
    setOwnerId(userId);
    setTransactions([]);
    setError('');
    setLoading(true);
    const unsubscribe = subscribeTransactions(({ userId: eventUserId, transactions: updated }) => {
      if (String(eventUserId) !== userId) return;
      eventVersion += 1;
      setOwnerId(userId);
      setTransactions(updated);
      setError('');
      setLoading(false);
    });
    const startingVersion = eventVersion;
    getTransactions()
      .then((current) => {
        if (active && eventVersion === startingVersion) {
          setOwnerId(userId);
          setTransactions(current);
        }
      })
      .catch((cause) => {
        if (active) {
          setOwnerId(userId);
          setError(getErrorMessage(cause, 'Data transaksi gagal dimuat.'));
        }
      })
      .finally(() => {
        if (active) {
          setOwnerId(userId);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  const ownsState = ownerId === userId;
  return {
    transactions: ownsState ? transactions : [],
    loading: ownsState ? loading : Boolean(userId),
    error: ownsState ? error : '',
    setError,
    reload,
  };
}
