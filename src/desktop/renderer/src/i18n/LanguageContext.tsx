import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, type Language, type TranslationSchema } from './translations.js';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: TranslationSchema;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: translations.en,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('loadmoder_lang');
      if (saved === 'en' || saved === 'id') return saved;
    } catch {}
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('loadmoder_lang', lang);
    } catch {}
  };

  const toggleLanguage = () => {
    const next = language === 'en' ? 'id' : 'en';
    setLanguage(next);
  };

  useEffect(() => {
    try {
      localStorage.setItem('loadmoder_lang', language);
    } catch {}
  }, [language]);

  const value = {
    language,
    setLanguage,
    toggleLanguage,
    t: (translations[language] ?? translations.en) as TranslationSchema,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => useContext(LanguageContext);
