import { useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';

export default function TrackingManager() {
  const { settings } = useSettings();

  useEffect(() => {
    if (!settings) return;

    // 1. Meta Pixel
    if (settings.tracking_pixel) {
      const pixelId = settings.tracking_pixel.trim();
      if (!document.getElementById('meta-pixel-script')) {
        const script = document.createElement('script');
        script.id = 'meta-pixel-script';
        script.innerHTML = `
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
          fbq('track', 'PageView');
        `;
        document.head.appendChild(script);
      }
    }

    // 2. Google Tag Manager
    if (settings.tracking_gtm) {
      const gtmId = settings.tracking_gtm.trim();
      if (!document.getElementById('gtm-script')) {
        const script = document.createElement('script');
        script.id = 'gtm-script';
        script.innerHTML = `
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${gtmId}');
        `;
        document.head.appendChild(script);
      }
    }

    // 3. Google Ads
    if (settings.tracking_gads) {
      const gadsId = settings.tracking_gads.trim();
      if (!document.getElementById('gads-script')) {
        const script1 = document.createElement('script');
        script1.id = 'gads-script-lib';
        script1.async = true;
        script1.src = `https://www.googletagmanager.com/gtag/js?id=${gadsId}`;
        document.head.appendChild(script1);

        const script2 = document.createElement('script');
        script2.id = 'gads-script';
        script2.innerHTML = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gadsId}');
        `;
        document.head.appendChild(script2);
      }
    }
  }, [settings]);

  return null;
}
