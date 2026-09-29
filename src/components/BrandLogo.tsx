import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LOCAL_LOGO_KEY = 'rupam_official_brand_logo_exact_v1';
const DEFAULT_LOGO_ENDPOINT = '/api/brand-logo/image';

interface BrandLogoContextValue {
  logoSrc: string;
  hasCustomExactFile: boolean;
  isUploadingLogo: boolean;
  uploadExactLogoFile: (file: File) => Promise<boolean>;
  refreshLogo: () => Promise<void>;
}

const BrandLogoContext = createContext<BrandLogoContextValue>({
  logoSrc: DEFAULT_LOGO_ENDPOINT,
  hasCustomExactFile: false,
  isUploadingLogo: false,
  uploadExactLogoFile: async () => false,
  refreshLogo: async () => {},
});

export const useBrandLogo = () => useContext(BrandLogoContext);

function syncBrowserFavicon(href: string) {
  if (typeof document === 'undefined') return;
  const ids = ['site-favicon', 'site-shortcut-icon', 'site-apple-icon'];
  ids.forEach((id) => {
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = id === 'site-apple-icon' ? 'apple-touch-icon' : 'icon';
      document.head.appendChild(link);
    }
    link.href = href;
  });
}

export const BrandLogoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logoSrc, setLogoSrc] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_LOGO_KEY);
      if (saved && saved.startsWith('data:image/')) {
        return saved;
      }
    } catch {
      // ignore localStorage read errors
    }
    return DEFAULT_LOGO_ENDPOINT;
  });

  const [hasCustomExactFile, setHasCustomExactFile] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_LOGO_KEY);
      return Boolean(saved && saved.startsWith('data:image/'));
    } catch {
      return false;
    }
  });

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const refreshLogo = useCallback(async () => {
    try {
      const res = await fetch('/api/brand-logo');
      if (res.ok) {
        const data = await res.json();
        if (data.hasExactPng && data.logoUrl) {
          const versionedUrl = `${data.logoUrl}?v=${data.updatedAt || Date.now()}`;
          setLogoSrc(versionedUrl);
          setHasCustomExactFile(true);
          syncBrowserFavicon(versionedUrl);
          return;
        }
      }
    } catch {
      // ignore network error and fallback to local or default endpoint
    }

    try {
      const saved = localStorage.getItem(LOCAL_LOGO_KEY);
      if (saved && saved.startsWith('data:image/')) {
        setLogoSrc(saved);
        setHasCustomExactFile(true);
        syncBrowserFavicon(saved);
        // Also push to server so `/api/brand-logo/image` has it
        fetch('/api/brand-logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: saved }),
        }).catch(() => {});
        return;
      }
    } catch {
      // ignore
    }

    syncBrowserFavicon(DEFAULT_LOGO_ENDPOINT);
  }, []);

  useEffect(() => {
    refreshLogo();
  }, [refreshLogo]);

  const uploadExactLogoFile = useCallback(async (file: File): Promise<boolean> => {
    if (!file || !file.type.startsWith('image/')) return false;
    setIsUploadingLogo(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Failed to read logo file'));
        };
        reader.onerror = () => reject(new Error('Failed to read logo file'));
        reader.readAsDataURL(file);
      });

      try {
        localStorage.setItem(LOCAL_LOGO_KEY, dataUrl);
      } catch {
        // ignore storage quota errors
      }

      setLogoSrc(dataUrl);
      setHasCustomExactFile(true);
      syncBrowserFavicon(dataUrl);

      await fetch('/api/brand-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });

      return true;
    } catch {
      return false;
    } finally {
      setIsUploadingLogo(false);
    }
  }, []);

  return (
    <BrandLogoContext.Provider
      value={{
        logoSrc,
        hasCustomExactFile,
        isUploadingLogo,
        uploadExactLogoFile,
        refreshLogo,
      }}
    >
      {children}
    </BrandLogoContext.Provider>
  );
};

export type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero';

interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
  imgClassName?: string;
  alt?: string;
}

const SIZE_CLASSES: Record<BrandLogoSize, string> = {
  xs: 'h-7 w-auto',
  sm: 'h-9 w-auto',
  md: 'h-11 w-auto',
  lg: 'h-14 w-auto',
  xl: 'h-20 w-auto',
  '2xl': 'h-28 w-auto',
  hero: 'w-full h-full max-h-[460px]',
};

/**
 * Single consistent official website logo component used across the entire site:
 * Header/Navbar, Mobile Menu, Hero Section, Footer, Admin Dashboard, Login Page,
 * Loading/Splash Screen, Contact Section, and all Modals/Popups.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = '',
  imgClassName = '',
  alt = 'Rafiul Islam Rupam Official Logo',
}) => {
  const { logoSrc } = useBrandLogo();

  return (
    <div className={`inline-flex items-center justify-center shrink-0 select-none ${className}`}>
      <img
        src={logoSrc}
        alt={alt}
        draggable={false}
        className={`${SIZE_CLASSES[size]} object-contain ${imgClassName}`}
      />
    </div>
  );
};
