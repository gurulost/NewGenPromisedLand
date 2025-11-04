// Minimal polyfill for window.getComputedStyle for axe running inside jsdom
if (typeof window !== 'undefined' && !window.getComputedStyle) {
  (window as any).getComputedStyle = (elt: Element | null) => {
    const style = (elt as HTMLElement | null)?.style || {};
    return {
      getPropertyValue: (prop: string) => {
        const camel = prop.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
        const inline = (style as any)[camel] || (style as any)[prop];
        if (inline) return inline;

        switch (prop) {
          case 'background-color': return 'rgba(0, 0, 0, 0)';
          case 'color': return 'rgb(0, 0, 0)';
          case 'display': return 'block';
          case 'visibility': return 'visible';
          case 'opacity': return '1';
          default: return '';
        }
      }
    };
  };
}
