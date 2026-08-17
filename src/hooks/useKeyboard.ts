'use client'

import { useState, useEffect } from 'react'

export function useKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return

    const initialHeight = window.innerHeight

    const handleResize = () => {
      // If the window height is significantly smaller than the initial height,
      // the virtual keyboard is likely open (especially on Android).
      if (window.innerHeight < initialHeight * 0.8) {
        setIsKeyboardOpen(true)
      } else {
        setIsKeyboardOpen(false)
      }
    }

    // Modern API (Visual Viewport) is more reliable if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
    } else {
      window.addEventListener('resize', handleResize)
    }

    // Also listen to focusin/focusout as a fallback
    const handleFocusIn = (e: Event) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Delay slightly to let the resize event fire first if it's going to
        setTimeout(() => setIsKeyboardOpen(true), 300)
      }
    }
    
    const handleFocusOut = () => {
      setIsKeyboardOpen(false)
    }

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize)
      } else {
        window.removeEventListener('resize', handleResize)
      }
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [])

  return isKeyboardOpen
}
