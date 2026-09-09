// src/services/scale/useScale.ts
import { useState, useEffect, useCallback } from 'react';
import { scaleService, ScaleState, ScaleConfig } from './scaleService';

export function useScale(autoInit: boolean = true) {
  const [scaleState, setScaleState] = useState<ScaleState>(scaleService.getState());

  useEffect(() => {
    // Subscribe to state updates
    const unsubscribe = scaleService.subscribe((newState) => {
      setScaleState(newState);
    });

    // Auto-init on mount if requested
    if (autoInit) {
      scaleService.init();
    }

    return () => {
      unsubscribe();
    };
  }, [autoInit]);

  const connect = useCallback((forcePrompt: boolean = false) => {
    return scaleService.connect(forcePrompt);
  }, []);

  const disconnect = useCallback(() => {
    return scaleService.disconnect();
  }, []);

  const requestWeight = useCallback(() => {
    return scaleService.requestWeight();
  }, []);

  const setConfig = useCallback((config: Partial<ScaleConfig>) => {
    scaleService.setConfig(config);
  }, []);

  return {
    ...scaleState,
    connect,
    disconnect,
    requestWeight,
    setConfig,
  };
}
