'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: {
        sitekey: string;
        callback?: (token: string) => void;
        'error-callback'?: () => void;
        'timeout-callback'?: () => void;
        'expired-callback'?: () => void;
        theme?: 'light' | 'dark' | 'auto';
        size?: 'normal' | 'compact';
        language?: string;
      }) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onError?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
}

export default function TurnstileWidget({
  onSuccess,
  onError,
  theme = 'light',
  size = 'normal',
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    if (!siteKey) {
      console.error('NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set');
      return;
    }

    // Turnstile 스크립트가 로드될 때까지 대기
    const checkAndRender = () => {
      if (window.turnstile && containerRef.current && !widgetIdRef.current) {
        try {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              onSuccess(token);
            },
            'error-callback': () => {
              onError?.();
            },
            'timeout-callback': () => {
              onError?.();
            },
            'expired-callback': () => {
              onError?.();
            },
            theme,
            size,
            language: 'ko',
          });
        } catch (error) {
          console.error('Failed to render Turnstile widget:', error);
        }
      }
    };

    // 즉시 체크
    checkAndRender();

    // 스크립트가 아직 로드되지 않았으면 interval로 대기
    const interval = setInterval(checkAndRender, 100);

    // 5초 후 포기
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (!widgetIdRef.current) {
        console.error('Turnstile script failed to load within 5 seconds');
        onError?.();
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);

      // 위젯 정리
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (error) {
          console.error('Failed to remove Turnstile widget:', error);
        }
      }
      widgetIdRef.current = null;
    };
  }, [onSuccess, onError, theme, size]);

  return (
    <div className="flex justify-center my-4">
      <div ref={containerRef} className="cf-turnstile" />
    </div>
  );
}
