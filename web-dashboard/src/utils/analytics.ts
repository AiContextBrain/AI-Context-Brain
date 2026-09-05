// Helper to check if window and document exist (client-side safety)
const isClient = typeof window !== 'undefined' && typeof document !== 'undefined';

export interface AnalyticsConfig {
  gaId?: string;
  clarityId?: string;
  enabled: boolean;
}

const STORAGE_KEY = 'ai_context_analytics_settings';
const CONSENT_KEY = 'ai_context_analytics_consent';

/**
 * Retrieves the current analytics configuration from localStorage if available,
 * falling back to environment variables.
 */
export function getAnalyticsConfig(): AnalyticsConfig {
  if (!isClient) return { enabled: false };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to parse analytics settings from localStorage', e);
  }

  // Fallbacks to environment variables
  const gaId = (import.meta as any).env?.NEXT_PUBLIC_GA_ID || '';
  const clarityId = (import.meta as any).env?.NEXT_PUBLIC_CLARITY_ID || '';
  const enabled = !!(gaId || clarityId);

  return { gaId, clarityId, enabled };
}

/**
 * Saves the analytics configuration to localStorage.
 */
export function saveAnalyticsConfig(config: AnalyticsConfig) {
  if (!isClient) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save analytics settings to localStorage', e);
  }
}

export async function loadAnalyticsConfig(): Promise<AnalyticsConfig> {
  if (!isClient) return { enabled: false };
  const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || 'https://api.aicontextbrain.me';
  try {
    const response = await fetch(`${apiBase}/public-config/analytics`, { headers: { Accept: 'application/json' } });
    if (response.ok) {
      const data = await response.json();
      const config = {
        enabled: data.enabled === true,
        gaId: typeof data.gaId === 'string' ? data.gaId : '',
        clarityId: typeof data.clarityId === 'string' ? data.clarityId : '',
      };
      saveAnalyticsConfig(config);
      return config;
    }
  } catch (error) {
    console.warn('Analytics configuration could not be loaded from the API.', error);
  }
  return getAnalyticsConfig();
}

export function getAnalyticsConsent(): 'granted' | 'denied' | null {
  if (!isClient) return null;
  const value = localStorage.getItem(CONSENT_KEY);
  return value === 'granted' || value === 'denied' ? value : null;
}

export function setAnalyticsConsent(value: 'granted' | 'denied') {
  if (!isClient) return;
  localStorage.setItem(CONSENT_KEY, value);
}

let gaInitialized = false;
let clarityInitialized = false;

/**
 * Dynamically initializes the analytics scripts if tracking is enabled.
 */
export function initAnalytics(configOverride?: AnalyticsConfig) {
  if (!isClient) return;

  const config = configOverride ?? getAnalyticsConfig();
  if (!config.enabled || getAnalyticsConsent() !== 'granted') {
    // If not enabled or parameters are empty, remove script tags if they were previously added
    const existingGa = document.getElementById('google-analytics-script');
    const existingClarity = document.getElementById('microsoft-clarity-script');
    if (existingGa) existingGa.remove();
    if (existingClarity) existingClarity.remove();
    gaInitialized = false;
    clarityInitialized = false;
    return;
  }

  // Initialize Google Analytics 4
  if (config.gaId && !gaInitialized) {
    try {
      const scriptId = 'google-analytics-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${config.gaId}`;
        script.onerror = () => {
          script.remove();
          console.info('[Analytics] Google Analytics script load blocked by client extension or network.');
        };
        document.head.appendChild(script);

        // Define gtag function
        (window as any).dataLayer = (window as any).dataLayer || [];
        (window as any).gtag = function () {
          (window as any).dataLayer.push(arguments);
        };
        (window as any).gtag('js', new Date());
        (window as any).gtag('config', config.gaId, {
          page_path: window.location.pathname + window.location.search,
        });
        gaInitialized = true;
      }
    } catch (err) {
      console.error('Failed to initialize Google Analytics 4:', err);
    }
  }

  // Initialize Microsoft Clarity
  if (config.clarityId && !clarityInitialized) {
    try {
      const scriptId = 'microsoft-clarity-script';
      if (!document.getElementById(scriptId)) {
        (window as any).clarity = (window as any).clarity || function () {
          ((window as any).clarity.q = (window as any).clarity.q || []).push(arguments);
        };
        const script = document.createElement('script');
        script.id = scriptId;
        script.async = true;
        script.src = `https://www.clarity.ms/tag/${config.clarityId}`;
        script.onerror = () => {
          script.remove();
          console.info('[Analytics] Microsoft Clarity script load blocked by client extension or network.');
        };
        document.head.appendChild(script);
        clarityInitialized = true;
      }
    } catch (err) {
      console.error('Failed to initialize Microsoft Clarity:', err);
    }
  }
}

/**
 * Tracks a custom event.
 */
export function trackEvent(name: string, params?: Record<string, any>) {
  if (!isClient) return;
  const config = getAnalyticsConfig();
  if (!config.enabled || getAnalyticsConsent() !== 'granted') return;

  // Track in Google Analytics 4
  if (config.gaId && (window as any).gtag) {
    try {
      (window as any).gtag('event', name, params);
    } catch (err) {
      console.error('Error tracking GA event:', err);
    }
  }

  // Track in Microsoft Clarity
  if (config.clarityId && (window as any).clarity) {
    try {
      (window as any).clarity('event', name, params);
    } catch (err) {
      console.error('Error tracking Clarity event:', err);
    }
  }
}

/**
 * Tracks a page view event.
 */
export function trackPageView(path: string) {
  if (!isClient) return;
  const config = getAnalyticsConfig();
  if (!config.enabled || getAnalyticsConsent() !== 'granted') return;

  if (config.gaId && (window as any).gtag) {
    try {
      (window as any).gtag('config', config.gaId, {
        page_path: path,
      });
    } catch (err) {
      console.error('Error tracking page view:', err);
    }
  }
}
