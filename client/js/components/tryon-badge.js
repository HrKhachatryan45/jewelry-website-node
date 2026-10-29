export function tryOnIcon(className = '') {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/>
      <circle cx="12" cy="10" r="3"/>
      <path d="M7.5 18a4.5 4.5 0 0 1 9 0"/>
    </svg>`;
}

export function tryOnBadge(modelUrl, position = 'top-3 right-3') {
  if (!modelUrl) return '';
  return `
    <span
      class="absolute ${position} z-10 inline-flex h-10 w-10 items-center justify-center rounded-md border border-emerald-500 bg-white/95 text-emerald-600 shadow-sm"
      role="img"
      aria-label="Virtual try-on available"
      title="Virtual try-on available"
    >
      ${tryOnIcon()}
    </span>`;
}
