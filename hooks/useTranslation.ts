import { useLanguage } from '../contexts/LanguageContext';
import { yo } from '../translations/yo';

// Import other language translations as they are created
// import { tw } from '../translations/tw';
// import { afm } from '../translations/afm';
// import { ig } from '../translations/ig';

const translations = {
  yo,
  // Add other languages as they are created
  // tw,
  // afm,
  // ig,
};

export const useTranslation = () => {
  const { currentLanguage } = useLanguage();

  const t = (key: string, section: string = 'common'): string => {
    try {
      const translation = translations[currentLanguage.code];
      if (!translation) {
        console.warn(`No translation found for language: ${currentLanguage.code}`);
        return key;
      }

      const keys = key.split('.');
      let value = translation[section];
      
      for (const k of keys) {
        if (value && typeof value === 'object') {
          value = value[k];
        } else {
          return key;
        }
      }

      return typeof value === 'string' ? value : key;
    } catch (error) {
      console.error('Translation error:', error);
      return key;
    }
  };

  return { t, currentLanguage };
}; 