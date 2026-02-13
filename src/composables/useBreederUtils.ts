export function useBreederUtils() {
  const formatContactLink = (link: string): string => {
    if (!link) return '';
    
    if (link.startsWith('mailto:')) {
      const subject = 'Inquiry from ctchickens.com';
      const separator = link.includes('?') ? '&' : '?';
      return `${link}${separator}subject=${encodeURIComponent(subject)}`;
    }
    
    return link;
  };

  return {
    formatContactLink
  };
}
