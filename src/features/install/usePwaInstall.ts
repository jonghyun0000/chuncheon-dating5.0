import { useCallback, useEffect, useState } from 'react';

/** Chrome 이 발생시키는 설치 프롬프트 이벤트 (표준 타입에 아직 없어 직접 선언) */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Platform = 'ios' | 'android' | 'desktop';

/** 앱이 홈 화면 아이콘으로 실행되고 있는지 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS 사파리는 표준 대신 navigator.standalone 을 씁니다
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function detectPlatform(ua = navigator.userAgent): Platform {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/**
 * 카카오톡·인스타그램 등 앱 안에 들어 있는 브라우저인지.
 * 이런 화면에는 [홈 화면에 추가] 메뉴가 없어서 먼저 안내가 필요합니다.
 */
export function isInAppBrowser(ua = navigator.userAgent): boolean {
  return /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|NAVER\(inapp|DaumApps|BAND|Snapchat|Line\/|everytimeapp|KAKAOSTORY/i.test(ua);
}

/**
 * 안드로이드 크롬 계열은 beforeinstallprompt 를 잡아두면
 * 안내문을 읽지 않고 버튼 한 번으로 바로 설치할 수 있습니다.
 * (iOS 사파리는 이 이벤트가 없어 수동 안내만 가능합니다)
 */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // 크롬 기본 배너 대신 우리 버튼으로 안내
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable';
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null); // 프롬프트는 한 번만 쓸 수 있습니다
      return outcome;
    } catch {
      return 'unavailable';
    }
  }, [deferred]);

  return { canInstall: deferred !== null, installed, install };
}
