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

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  return {
    formatContactLink,
    generateSlug
  };
}
