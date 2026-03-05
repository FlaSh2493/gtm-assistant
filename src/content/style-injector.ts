/**
 * Utility to move styles injected by vite-plugin-css-injected-by-js 
 * from the document head into a given Shadow Root.
 */
export const injectStylesIntoShadow = (shadowRoot: ShadowRoot) => {
  // We look for style tags that were recently added to the head
  // by the CSS-in-JS plugin. 
  // Since we can't easily distinguish them from host page styles without attributes,
  // we'll monitor the head for new style additions or just move all styles
  // that look like they belong to us.
  
  const moveStyles = () => {
    const styles = document.head.querySelectorAll('style');
    styles.forEach((style) => {
      // Avoid moving styles that are already in a shadow root or belong to the host page
      // In a more robust implementation, we'd add a unique attribute in the build step.
      // For now, we move them if they contain our specific CSS variables or classes.
      if (style.textContent?.includes('gtm-assistant') || style.textContent?.includes('--framer')) {
        shadowRoot.appendChild(style.cloneNode(true));
        // We leave the original in head just in case, or we could remove it.
      }
    });
  };

  // Initial attempt
  moveStyles();

  // MutationObserver to catch styles injected after init
  const observer = new MutationObserver(() => {
    moveStyles();
  });

  observer.observe(document.head, {
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
};
