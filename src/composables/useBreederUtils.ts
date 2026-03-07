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
    // First, split the name to remove the person's name in parentheses
    const { main } = splitBreederName(name);
    
    return (main || '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const splitBreederName = (name: string) => {
    if (!name) return { main: '', person: null };
    const match = name.match(/^(.*?)\s*\((.*?)\)\s*$/);
    if (match) {
      return { main: match[1], person: match[2] };
    }
    return { main: name, person: null };
  };

  return {
    formatContactLink,
    generateSlug,
    splitBreederName
  };
}
