import React, { createContext, useState, useContext } from 'react';

const TrackingContext = createContext();

export const useTracking = () => {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error('useTracking must be used within TrackingProvider');
  }
  return context;
};

export const TrackingProvider = ({ children }) => {
  const [isTracking, setIsTracking] = useState(false);

  const setTrackingStatus = (status) => {
    setIsTracking(status);
  };

  return (
    <TrackingContext.Provider value={{ isTracking, setTrackingStatus }}>
      {children}
    </TrackingContext.Provider>
  );
};



