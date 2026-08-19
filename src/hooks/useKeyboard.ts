'use client'

import { useState, useEffect } from 'react'

export function useKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // visualViewport is the most reliable way to detect keyboard on modern mobile browsers
    if (window.visualViewport) {
      const initialHeight = window.visualViewport.height
      
      const handleResize = () => {
        // If current height is less than 85% of initial, keyboard is likely open
        if (window.visualViewport && window.visualViewport.height < initialHeight * 0.85) {
          setIsKeyboardOpen(true)
        } else {
          setIsKeyboardOpen(false)
        }
      }

      window.visualViewport.addEventListener('resize', handleResize)
      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize)
      }
    } else {
      // Fallback for older browsers
      const initialHeight = window.innerHeight
      const handleResize = () => {
        if (window.innerHeight < initialHeight * 0.85) setIsKeyboardOpen(true)
        else setIsKeyboardOpen(false)
      }
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [])

  return isKeyboardOpen
}
