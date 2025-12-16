import React, { createContext, useState, useContext, ReactNode } from 'react';

interface TrackingContextType {
  isTracking: boolean;
  setTrackingStatus: (status: boolean) => void;
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

export const useTracking = () => {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error('useTracking must be used within TrackingProvider');
  }
  return context;
};

interface TrackingProviderProps {
  children: ReactNode;
}

export const TrackingProvider: React.FC<TrackingProviderProps> = ({ children }) => {
  const [isTracking, setIsTracking] = useState(false);

  const setTrackingStatus = (status: boolean) => {
    setIsTracking(status);
  };

  return (
    <TrackingContext.Provider value={{ isTracking, setTrackingStatus }}>
      {children}
    </TrackingContext.Provider>
  );
};

