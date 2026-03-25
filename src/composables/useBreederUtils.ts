export function useBreederUtils() {
  const formatContactLink = (link: string): string => {
    if (!link) return '';
    
    let formattedLink = link;
    
    // Detect raw emails (contains @ but no protocol prefix like mailto: or https:)
    if (formattedLink.includes('@') && !formattedLink.includes(':')) {
      formattedLink = `mailto:${formattedLink}`;
    }
    
    if (formattedLink.startsWith('mailto:')) {
      const subject = 'Inquiry from ctchickens.com';
      const separator = formattedLink.includes('?') ? '&' : '?';
      return `${formattedLink}${separator}subject=${encodeURIComponent(subject)}`;
    }
    
    return formattedLink;
  };

  const generateSlug = (name: string): string => {
    // RESTORED: Removes the person's name in parentheses for cleaner URLs
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
