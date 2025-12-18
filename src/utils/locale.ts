export const getPreferredLocale = (): 'fr' | 'en' => {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale?.toLowerCase() || '';
    if (locale.startsWith('fr')) return 'fr';
    return 'en';
  } catch {
    return 'fr';
  }
};
