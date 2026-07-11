import { useCallback } from 'react';
import { t, TranslationKey, TranslationParams } from './ru';

export function useTranslation() {
  const translate = useCallback((key: TranslationKey, params?: TranslationParams) => t(key, params), []);
  return { t: translate };
}
