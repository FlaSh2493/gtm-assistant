/**
 * Resolves a raw input string into a valid URL.
 * Detects if the input is a domain/localhost or a search query.
 */
export const resolveUrl = (input: string): string => {
  const query = input.trim();
  if (!query) return '';

  // URL detection pattern
  const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/i;
  const isDomain = urlPattern.test(query) || query.toLowerCase().startsWith('localhost') || query.includes(':');
  const hasProtocol = query.toLowerCase().startsWith('http://') || query.toLowerCase().startsWith('https://');

  if (hasProtocol) {
    return query;
  } else if (isDomain && !query.includes(' ')) {
    return `https://${query}`;
  } else {
    // Treat as search query fallback
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }
};
