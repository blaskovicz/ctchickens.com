export const splitBreederName = (name: string) => {
  if (!name) return { main: '', person: null };
  const match = name.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (match) {
    return { main: match[1], person: match[2] };
  }
  return { main: name, person: null };
};

export const generateSlug = (name: string): string => {
  // RESTORED: Removes the person's name in parentheses for cleaner URLs
  const { main } = splitBreederName(name);
  
  return (main || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const formatDisplayName = (fullName: string | null, isBreeder: boolean = false) => {
  if (!fullName) return 'User';
  if (isBreeder) return splitBreederName(fullName).main;
  
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastPart = parts[parts.length - 1];
  const lastInitial = lastPart ? lastPart.substring(0, 1).toUpperCase() : '';
  return `${first} ${lastInitial}.`;
};

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Label for a chat date divider — "Today"/"Yesterday" for recent days, otherwise
// a short date (with year only if it's not the current one).
export const formatDateDivider = (date: Date): string => {
  const now = new Date();
  if (isSameDay(date, now)) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, sameYear
    ? { month: 'long', day: 'numeric' }
    : { month: 'long', day: 'numeric', year: 'numeric' });
};

export const formatRelativeTime = (timestamp: any) => {
  if (!timestamp) return 'Never';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

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

  return {
    formatContactLink,
    generateSlug,
    splitBreederName,
    formatDisplayName
  };
}
