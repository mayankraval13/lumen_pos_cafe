import React, { createContext, useContext, useState } from 'react';
import { PosSessionWithConfig, Table, Order } from '@workspace/api-client-react';

interface POSContextType {
  activeSession: PosSessionWithConfig | null;
  activeTable: Table | null;
  activeOrder: Order | null;
  setSession: (session: PosSessionWithConfig | null) => void;
  setTable: (table: Table | null) => void;
  setOrder: (order: Order | null) => void;
  clearOrder: () => void;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSession, setSession] = useState<PosSessionWithConfig | null>(null);
  const [activeTable, setTable] = useState<Table | null>(null);
  const [activeOrder, setOrder] = useState<Order | null>(null);

  const clearOrder = () => {
    setOrder(null);
    setTable(null);
  };

  const value = {
    activeSession,
    activeTable,
    activeOrder,
    setSession,
    setTable,
    setOrder,
    clearOrder,
  };

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
};

export const usePOS = () => {
  const context = useContext(POSContext);
  if (context === undefined) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
};
