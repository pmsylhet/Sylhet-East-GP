import { useEffect, useState } from 'react';
import { detectPlatformTarget, type PlatformTarget } from '../utils/appDownload.ts';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type ServiceWorkerStatus = 'checking' | 'ready' | 'unsupported';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [platformTarget, setPlatformTarget] = useState<PlatformTarget>('desktop');
  const [isInIframe, setIsInIframe] = useState(false);
  const [swStatus, setSwStatus] = useState<ServiceWorkerStatus>('checking');

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent;
    const detected = detectPlatformTarget(userAgent);
    setPlatformTarget(detected);
    setIsIOS(detected === 'ios');

    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    if ('serviceWorker' in navigator) {
      let active = true;
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          if (!active) return;
          if (reg) {
            setSwStatus('ready');
          } else {
            return navigator.serviceWorker.ready.then(() => {
              if (active) setSwStatus('ready');
            });
          }
        })
        .catch(() => {
          if (active) setSwStatus('unsupported');
        });
      return () => {
        active = false;
      };
    } else {
      setSwStatus('unsupported');
    }
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    platformTarget,
    isInIframe,
    swStatus,
    install,
  };
}
