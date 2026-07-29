import React, { createContext, useContext } from 'react';

interface HeaderContextType {
  onOpenSidebar?: () => void;
  onOpenSearch?: () => void;
  notificationCenter?: React.ReactNode;
}

const HeaderContext = createContext<HeaderContextType>({});

export const HeaderProvider: React.FC<{
  children: React.ReactNode;
  value: HeaderContextType;
}> = ({ children, value }) => {
  const memoValue = React.useMemo(
    () => value,
    [value.onOpenSidebar, value.onOpenSearch, value.notificationCenter]
  );
  return <HeaderContext.Provider value={memoValue}>{children}</HeaderContext.Provider>;
};

export const useHeaderControls = () => useContext(HeaderContext);
