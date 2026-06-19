import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
}

export function useSEO({
  title,
  description,
  keywords,
  canonicalUrl,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = 'website',
}: SEOProps) {
  useEffect(() => {
    // 1. Update Title
    document.title = title;

    // Helper function to update or create meta tag
    const updateMetaTag = (attributeName: string, attributeValue: string, content: string) => {
      let element = document.querySelector(`meta[${attributeName}="${attributeValue}"]`);
      if (element) {
        element.setAttribute('content', content);
      } else {
        element = document.createElement('meta');
        element.setAttribute(attributeName, attributeValue);
        element.setAttribute('content', content);
        document.head.appendChild(element);
      }
    };

    // Helper function to update or create link tag
    const updateLinkTag = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`);
      if (element) {
        element.setAttribute('href', href);
      } else {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        element.setAttribute('href', href);
        document.head.appendChild(element);
      }
    };

    // 2. Update Standard Meta Tags
    updateMetaTag('name', 'description', description);
    if (keywords) {
      updateMetaTag('name', 'keywords', keywords);
    }
    
    // 3. Update Open Graph Meta Tags
    updateMetaTag('property', 'og:title', ogTitle || title);
    updateMetaTag('property', 'og:description', ogDescription || description);
    updateMetaTag('property', 'og:type', ogType);
    if (ogImage) {
      updateMetaTag('property', 'og:image', ogImage);
    }
    if (canonicalUrl) {
      updateMetaTag('property', 'og:url', canonicalUrl);
      updateLinkTag('canonical', canonicalUrl);
    }

    // 4. Update Twitter Card Meta Tags
    updateMetaTag('name', 'twitter:title', ogTitle || title);
    updateMetaTag('name', 'twitter:description', ogDescription || description);
    if (ogImage) {
      updateMetaTag('name', 'twitter:image', ogImage);
    }
  }, [title, description, keywords, canonicalUrl, ogTitle, ogDescription, ogImage, ogType]);
}
