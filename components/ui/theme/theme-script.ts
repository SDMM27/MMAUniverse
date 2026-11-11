// Inlined in <head> before first paint so the page never flashes the wrong
// theme. Same storage key as @sdmm/design's initTheme ("sd-theme"), but dark
// is the default when nothing is stored: MMA Universe is a "fight night"
// site first, unlike the design system's follow-the-OS default.
// Also sets the browser chrome color and the `.js` class (enables .sd-reveal).
export const THEME_STORAGE_KEY = 'sd-theme';

export const THEME_COLORS = { dark: '#0b0a09', light: '#f6f3ec' } as const;

export const themeScript = `(function(){var d=document.documentElement,t="dark";try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");if(s==="light"||s==="dark")t=s}catch(e){}d.setAttribute("data-theme",t);d.classList.add("js");var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"${THEME_COLORS.dark}":"${THEME_COLORS.light}")})();`;
