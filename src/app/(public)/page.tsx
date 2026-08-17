import { Metadata } from 'next'
import { AnnouncementBar } from '@/components/landing/AnnouncementBar'
import { Navbar } from '@/components/landing/Navbar'
import { Hero } from '@/components/landing/Hero'
import { SocialProof } from '@/components/landing/SocialProof'
import { ProblemSolution } from '@/components/landing/ProblemSolution'
import { FeaturesGrid } from '@/components/landing/FeaturesGrid'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { FeaturePreviews } from '@/components/landing/FeaturePreviews'
import { MobileOffline } from '@/components/landing/MobileOffline'
import { PricingSection } from '@/components/landing/PricingSection'
import { FAQSection } from '@/components/landing/FAQSection'
import { Footer } from '@/components/landing/Footer'

export const metadata: Metadata = {
  title: 'BizTrack BD - আপনার ব্যবসার হিসাব এখন হাতের মুঠোয়',
  description: 'BizTrack BD is a simple business management application for Bangladeshi shop and small-business owners. Track sales, expenses, dues, cash, inventory and profit — without complicated accounting.',
  openGraph: {
    title: 'BizTrack BD - সহজ একাউন্টিং সফটওয়্যার',
    description: 'Track sales, expenses, dues, cash, inventory and profit — without complicated accounting. "Know your business in 10 seconds."',
    url: 'https://biztrackbd.com',
    siteName: 'BizTrack BD',
    locale: 'bn_BD',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BizTrack BD - সহজ একাউন্টিং সফটওয়্যার',
    description: 'Track sales, expenses, dues, cash, inventory and profit — without complicated accounting.',
  },
}

export default function LandingPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'BizTrack BD',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BDT',
    },
    description: 'BizTrack BD is a simple business management application for Bangladeshi shop and small-business owners.'
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      
      <AnnouncementBar />
      <Navbar />
      
      <main>
        <Hero />
        <SocialProof />
        <ProblemSolution />
        <MobileOffline />
        <FeaturePreviews />
        <FeaturesGrid />
        <HowItWorks />
        <PricingSection />
        <FAQSection />
      </main>

      <Footer />
    </div>
  )
}
