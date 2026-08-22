import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, Check, Share } from 'lucide-react';
import { Language } from '../utils/i18n';

interface PWAInstallBannerProps {
  lang: Language;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ lang }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    const isRunningStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(isRunningStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  if (isStandalone || dismissed) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white px-4 py-3 shadow-lg border-b border-blue-500/30 flex items-center justify-between gap-3 text-xs sm:text-sm print:hidden">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center text-amber-300 font-bold flex-shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold block text-white">
              {lang === 'ar' ? '📱 ثبّت تطبيق ElettroOre على هاتفك' : '📱 Installa ElettroOre sul tuo Smartphone'}
            </span>
            <span className="text-blue-200 text-[11px] block">
              {lang === 'ar' ? 'افتحه كأي تطبيق بدون متصفح لسهولة الختم اليومي' : 'Accesso rapido dalla schermata Home senza barra del browser'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleInstallClick}
            className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'تثبيت التطبيق' : 'Installa App'}</span>
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-blue-300 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
          <div className="bg-white text-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold flex items-center gap-2 text-slate-900">
                <Smartphone className="w-5 h-5 text-blue-600" />
                <span>{lang === 'ar' ? 'تثبيت التطبيق على الآيفون' : 'Installa su iPhone / iOS'}</span>
              </h3>
              <button onClick={() => setShowIOSModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-600 font-medium">
              <p className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-xs">1</span>
                <span>
                  {lang === 'ar'
                    ? 'اضغط على زر المشاركة (Share) ⎋ في شريط سفاري بالأسفل.'
                    : 'Tocca il pulsante Condividi ⎋ nella barra in basso di Safari.'}
                </span>
              </p>
              <p className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-xs">2</span>
                <span>
                  {lang === 'ar'
                    ? 'انزل لأسفل واختر (Aggiungi alla schermata Home ➕) أو (إضافة إلى الصفحة الرئيسية).'
                    : 'Scorri verso il basso e tocca "Aggiungi alla schermata Home ➕".'}
                </span>
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow cursor-pointer"
              >
                {lang === 'ar' ? 'فهمت ذلك' : 'Ho Capito'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
