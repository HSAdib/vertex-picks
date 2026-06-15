import { useContext } from 'react';
import { StoreContext } from './StoreContextValue';

export const useStore = () => useContext(StoreContext);
