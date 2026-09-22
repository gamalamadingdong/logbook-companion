import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { parseNativeAppUrl } from '../services/nativeNavigation';
import { supabase } from '../services/supabase';
import { toast } from 'sonner';

export function NativeAppBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    let stateObserved = false;
    const reportFailure = () => {
      console.error('[native-app] Native authentication lifecycle failed.');
      if (active) toast.error('Mobile session handling failed. Reopen the app or sign in again.');
    };
    const open = (url?: string) => {
      const route = url ? parseNativeAppUrl(url) : null;
      if (active && route) {
        navigate(route);
      } else if (active && url) {
        toast.error('This app link is not supported.');
      }
    };
    const handleBack = (canGoBack: boolean) => {
      if (!active) return;
      if (canGoBack) window.history.back();
      else void App.exitApp().catch(reportFailure);
    };
    const refresh = (isActive: boolean) => {
      if (!active) return;
      void (isActive ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh()).catch(reportFailure);
    };
    const handles = [
      App.addListener('appUrlOpen', event => open(event.url)),
      App.addListener('backButton', event => handleBack(event.canGoBack)),
      App.addListener('appStateChange', event => {
        stateObserved = true;
        refresh(event.isActive);
      }),
    ];
    void App.getState().then(state => { if (!stateObserved) refresh(state.isActive); }).catch(reportFailure);
    void App.getLaunchUrl().then(result => open(result?.url)).catch(reportFailure);
    void Promise.all(handles).catch(reportFailure);
    return () => {
      active = false;
      void supabase.auth.stopAutoRefresh().catch(reportFailure);
      void Promise.allSettled(handles).then(items => Promise.all(items.flatMap(item =>
        item.status === 'fulfilled' ? [item.value.remove()] : [],
      ))).catch(reportFailure);
    };
  }, [navigate]);
  return null;
}
