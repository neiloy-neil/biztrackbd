'use client'

import NextLink, { LinkProps as NextLinkProps } from 'next/link'
import { usePathname } from 'next/navigation'
import { forwardRef } from 'react'

export interface AppLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof NextLinkProps>, NextLinkProps {
  href: string
}

export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(
  ({ href, ...props }, ref) => {
    const pathname = usePathname()
    let finalHref = href

    // Only inject prefix if it's an absolute path within our app
    if (typeof href === 'string' && href.startsWith('/')) {
      if (pathname?.startsWith('/app') && !href.startsWith('/app')) {
        finalHref = `/app${href}`
      } else if (pathname?.startsWith('/admin') && !href.startsWith('/admin')) {
        finalHref = `/admin${href}`
      }
    }

    return <NextLink ref={ref} href={finalHref} {...props} />
  }
)
AppLink.displayName = 'AppLink'

export function useNormalizedPathname() {
  const pathname = usePathname()
  if (!pathname) return ''
  if (pathname.startsWith('/app')) return pathname.replace('/app', '') || '/'
  if (pathname.startsWith('/admin')) return pathname.replace('/admin', '') || '/'
  return pathname
}
