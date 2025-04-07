import { useEffect, useState, useRef } from 'react';
import { Query, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';

export function useFirestoreListener<T>(query: Query<T, DocumentData>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    setLoading(true);

    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<T, DocumentData>) => {
        if (!isMounted.current) return;

        try {
          const newData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as T[];

          setData(newData);
          setLoading(false);
          setError(null);
          setIsOffline(snapshot.metadata.fromCache);
        } catch (err) {
          if (isMounted.current) {
            setError(err as Error);
            setLoading(false);
          }
        }
      },
      (err: Error) => {
        if (isMounted.current) {
          setError(err);
          setLoading(false);
          setIsOffline(true);
        }
      }
    );

    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  }, [query]);

  return { data, loading, error, isOffline };
} 