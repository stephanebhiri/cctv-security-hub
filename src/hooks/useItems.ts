import { useState, useEffect, useCallback, useRef } from 'react';
import { Item, ItemsService } from '../services/ItemsService';

export const useItems = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemsService = useRef(new ItemsService());

  const fetchItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    
    try {
      const fetchedItems = await itemsService.current.getItems();
      setItems(fetchedItems);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch items';
      setError(errorMessage);
      if (!silent) {
        console.error('Items fetch error:', err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems(); // Initial load
  }, [fetchItems]);

  return { 
    items, 
    loading, 
    error, 
    refetch: fetchItems 
  };
};