import { redirect } from 'next/navigation'

export default function Home() {
  // Temporary redirect to the app portal until the marketing landing page is built
  redirect('/app/dashboard')
}
