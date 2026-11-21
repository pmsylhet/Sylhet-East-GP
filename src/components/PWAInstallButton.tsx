import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  HardDriveDownload,
  Monitor,
  Share2,
  Smartphone,
  Terminal,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import {
  getPlatformInstallSteps,
  resolvePwaBuilderUrl,
  resolveShareableAppUrl,
  type PlatformTarget,
} from '../utils/appDownload.ts';

interface PWAInstallButtonProps {
  siteCount?: number;
  onExportOfflineZip?: () => Promise<{ filename: string; data: Uint8Array }>;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  siteCount = 2296,
  onExportOfflineZip,
}) => {
  const { isInstallable, isInstalled, platformTarget, isInIframe, swStatus, install } =
    usePWAInstall();

  const [showModal, setShowModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformTarget>(platformTarget);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedApkCmd, setCopiedApkCmd] = useState(false);
  const [isBuildingZip, setIsBuildingZip] = useState(false);
  const [zipExported, setZipExported] = useState(false);
  const [zipError, setZipError] = useState('');

  useEffect(() => {
    setSelectedPlatform(platformTarget);
  }, [platformTarget]);

  const shareableUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return resolveShareableAppUrl(window.location.href);
  }, []);

  const bubblewrapCommand = useMemo(() => {
    const base = shareableUrl || 'https://YOUR-APP-URL';
    return `npx @bubblewrap/cli init --manifest ${base}/manifest.webmanifest && npx @bubblewrap/cli build`;
  }, [shareableUrl]);

  const pwaBuilderUrl = useMemo(() => resolvePwaBuilderUrl(shareableUrl), [shareableUrl]);

  useEffect(() => {
    if (!showModal || !shareableUrl) return;
    let cancelled = false;
    void QRCode.toDataURL(shareableUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [showModal, shareableUrl]);

  useEffect(() => {
    if (!showModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showModal]);

  if (isInstalled) {
    return null;
  }

  const guide = getPlatformInstallSteps(selectedPlatform, isInIframe);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopyLink = async () => {
    if (!shareableUrl) return;
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard blocked in restricted browser contexts
    }
  };

  const handleCopyApkCommand = async () => {
    try {
      await navigator.clipboard.writeText(bubblewrapCommand);
      setCopiedApkCmd(true);
      setTimeout(() => setCopiedApkCmd(false), 2000);
    } catch {
      // Clipboard blocked in restricted browser contexts
    }
  };

  const handleShareLink = async () => {
    if (!canNativeShare || !shareableUrl) return;
    try {
      await navigator.share({
        title: 'VoltGuard Power & Site Monitor',
        text: 'Install VoltGuard on Android 8.0+, iOS, or Desktop for offline battery monitoring & telecom site search.',
        url: shareableUrl,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  const handleDownloadOfflineZip = async () => {
    if (!onExportOfflineZip || isBuildingZip) return;
    setIsBuildingZip(true);
    setZipError('');
    try {
      const { filename, data } = await onExportOfflineZip();
      const blob = new Blob([new Uint8Array(data)], { type: 'application/zip' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setZipExported(true);
      setTimeout(() => setZipExported(false), 2500);
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Unable to build offline ZIP package.');
    } finally {
      setIsBuildingZip(false);
    }
  };

  const handleHeaderAction = () => {
    if (isInstallable) {
      void install().then((accepted) => {
        if (!accepted) {
          setShowModal(true);
        }
      });
      return;
    }
    setShowModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleHeaderAction}
        aria-label={isInstallable ? 'Install VoltGuard app' : 'Download VoltGuard app'}
        className={`inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40 sm:px-3.5 ${
          isInstallable
            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
            : 'border border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60'
        }`}
      >
        <Download className="h-4 w-4 shrink-0" />
        <span className="sm:hidden">{isInstallable ? 'Install' : 'Get App'}</span>
        <span className="hidden sm:inline">{isInstallable ? 'Install App' : 'Download App'}</span>
      </button>

      {showModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="download-app-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowModal(false);
              }
            }}
          >
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src="/pwa-192x192.png"
                    alt="VoltGuard app icon"
                    className="h-12 w-12 rounded-xl border border-slate-200 object-cover dark:border-slate-700"
                  />
                  <div>
                    <h2
                      id="download-app-title"
                      className="font-display text-base font-bold text-slate-900 dark:text-white sm:text-lg"
                    >
                      Download VoltGuard App
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Standalone PWA · Android 8.0+ WebAPK, iOS &amp; Desktop
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  aria-label="Close download app dialog"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* One-tap native install or direct standalone link */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                {isInstallable ? (
                  <div className="space-y-2.5">
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      Your browser supports one-tap installation. VoltGuard will run in its own standalone window with offline site access.
                    </p>
                    <button
                      type="button"
                      onClick={() => void install()}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      <Download className="h-4 w-4" />
                      <span>Install VoltGuard Now</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {isInIframe
                        ? 'You are viewing VoltGuard inside an embedded preview. Open the direct app link in Chrome or Safari to trigger native home screen installation.'
                        : 'Open or share the install link below on your Android 8.0+ phone, iPhone, or desktop Chrome/Edge browser to install VoltGuard.'}
                    </p>
                    {shareableUrl && (
                      <a
                        href={shareableUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>Open Direct App Link</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Send to Phone: QR Code + Copy / Share */}
              {shareableUrl && (
                <div className="mt-4 flex flex-col items-center gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR code to download VoltGuard on your phone"
                      className="h-28 w-28 shrink-0 rounded-xl border border-slate-200 bg-white p-1.5"
                    />
                  ) : (
                    <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-950">
                      QR Ready
                    </div>
                  )}

                  <div className="w-full min-w-0 flex-1 space-y-2.5">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Scan on Android 8.0+ or iPhone
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {shareableUrl}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopyLink()}
                        className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        {copiedLink ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Link Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>

                      {canNativeShare && (
                        <button
                          type="button"
                          onClick={() => void handleShareLink()}
                          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          <span>Share</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Platform-Specific Install Steps */}
              <div className="mt-4">
                <div
                  role="tablist"
                  aria-label="Installation instructions by platform"
                  className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
                >
                  {(
                    [
                      { id: 'android', label: 'Android 8.0+', icon: <Smartphone className="h-3.5 w-3.5" /> },
                      { id: 'ios', label: 'iPhone / iPad', icon: <Smartphone className="h-3.5 w-3.5" /> },
                      { id: 'desktop', label: 'Desktop', icon: <Monitor className="h-3.5 w-3.5" /> },
                    ] as const
                  ).map((tab) => {
                    const active = selectedPlatform === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setSelectedPlatform(tab.id)}
                        className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition ${
                          active
                            ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                        }`}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{guide.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {guide.subtitle}
                  </p>
                  <ol className="mt-3 space-y-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {guide.steps.map((step, index) => (
                      <li key={step} className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-mono text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>

                  {selectedPlatform === 'android' && (
                    <div className="mt-3.5 space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                          <Terminal className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Generate &amp; Save .APK to Local Drive</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={pwaBuilderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-slate-900 px-2.5 text-[11px] font-semibold text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>PWABuilder APK</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => void handleCopyApkCommand()}
                            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            {copiedApkCmd ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy CLI</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                        Use PWABuilder (cloud, no SDK needed) to package and download the signed .apk to your drive, or run <span className="font-mono">android-apk/build-apk.bat</span> / <span className="font-mono">build-apk.sh</span> from the ZIP below.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Offline Cache & Portable ZIP Package Download */}
              <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                      <CheckCircle2
                        className={`h-4 w-4 shrink-0 ${
                          swStatus === 'ready'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400'
                        }`}
                      />
                      <span>
                        {swStatus === 'ready'
                          ? 'Offline Cache Active'
                          : swStatus === 'checking'
                            ? 'Preparing Offline Cache…'
                            : 'Offline Package Available'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {siteCount.toLocaleString()} sites, offline HTML viewer, CSV &amp; TWA APK kit
                    </p>
                  </div>

                  {onExportOfflineZip && (
                    <button
                      type="button"
                      disabled={isBuildingZip}
                      onClick={() => void handleDownloadOfflineZip()}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {zipExported ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>ZIP Saved</span>
                        </>
                      ) : (
                        <>
                          <HardDriveDownload className="h-3.5 w-3.5" />
                          <span>{isBuildingZip ? 'Building ZIP…' : 'Download Offline ZIP'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {zipError && (
                  <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                    {zipError}
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
