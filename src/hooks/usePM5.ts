import { useContext } from 'react';
import { PM5Context, type PM5ContextValue } from '../contexts/PM5Context';

export function usePM5(): PM5ContextValue {
  const context = useContext(PM5Context);
  if (!context) throw new Error('usePM5 must be used within a PM5Provider');
  return context;
}
