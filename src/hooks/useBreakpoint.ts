import { useEffect, useState } from 'react'

const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const

/**
 * Retorna true quando a viewport é menor que o breakpoint dado.
 * useBreakpoint('md') → true em mobile (< 768px), false em desktop.
 */
export function useBreakpoint(bp: keyof typeof BREAKPOINTS): boolean {
  const query = `(max-width: ${BREAKPOINTS[bp] - 1}px)`
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}
