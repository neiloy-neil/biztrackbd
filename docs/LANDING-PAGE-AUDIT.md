# Landing Page & Public Website Audit

## Executive Summary
This document summarizes the SEO, UX, and conversion readiness of the BizTrack public landing page (`src/app/(public)/page.tsx`). While the page correctly loads dynamic pricing from the database, it suffers from a catastrophic conversion failure (100% broken CTAs) and is missing foundational SEO requirements.

---

## 1. Catastrophic Conversion Failure (Broken CTAs)
**Issue:** Every Call-to-Action (CTA) on the landing page, including the Navbar "Login" and "Sign Up" buttons, the Hero section, and the Pricing section, points to non-existent routes.
- The links explicitly use `<Link href="/login">` and `<Link href="/signup">`.
- The actual Next.js application routes are located at `/app/login` and `/app/onboarding` respectively.
**Impact:** 100% of organic and paid traffic will click the primary action buttons and hit a Next.js 404 page. It is currently impossible to acquire new users through the public website.

## 2. Missing Foundational SEO
**Issue:** The project completely lacks the basic files required by search engine crawlers.
- `public/robots.txt` is missing.
- `app/sitemap.ts` (or `sitemap.xml`) is missing.
**Impact:** Google and other search engines will have degraded crawling efficiency and cannot automatically discover the page hierarchy or directives.

## 3. Incomplete Social Graph Metadata
**Issue:** While `page.tsx` includes basic Open Graph and Twitter metadata, it critically omits `og:image` and `twitter:image`. 
**Impact:** If a user shares `https://biztrackbd.com` on WhatsApp, Facebook, or Twitter, the link preview will appear as a plain text box without a branding image or screenshot, severely lowering click-through rates.

## 4. Missing Canonical Tags
**Issue:** No canonical URL is defined in the global `layout.tsx` or `page.tsx` metadata.
**Impact:** If the site is accessible via both `http://`, `https://`, `www.`, and non-www, search engines may penalize the site for duplicate content.

## 5. Pricing Transparency (Pass)
**Status:** ✅ Passed
**Observation:** The `<PricingSection />` component does not hardcode prices in HTML. It dynamically queries `supabase.from('plans').select('*')`, ensuring that the public-facing prices always mathematically match the backend Stripe/UddoktaPay SaaS entitlement limits and checkout flows.

---

## Conclusion
The landing page cannot be shipped in its current state. The CTAs must be immediately re-routed to `/app/login`, and an `og:image` alongside standard `robots.txt` generation must be added to enable basic marketing functionality.
