import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { parseNativeAppUrl } from '../services/nativeNavigation';

export function NativeAppBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    const open = (url?: string) => {
      const route = url ? parseNativeAppUrl(url) : null;
      if (active && route) {
        console.info(`[native-app] route ${route}`);
        navigate(route);
      }
    };
    const handleBack = (canGoBack: boolean) => {
      console.info(`[native-app] back ${canGoBack ? 'history' : 'exit'}`);
      if (canGoBack) window.history.back();
      else void App.exitApp();
    };
    const handles = [
      App.addListener('appUrlOpen', event => open(event.url)),
      App.addListener('backButton', event => handleBack(event.canGoBack)),
    ];
    void App.getLaunchUrl().then(result => open(result?.url));
    return () => {
      active = false;
      void Promise.all(handles).then(items => items.forEach(item => void item.remove()));
    };
  }, [navigate]);
  return null;
}
