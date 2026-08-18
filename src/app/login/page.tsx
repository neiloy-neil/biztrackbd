import { redirect } from 'next/navigation'

// On localhost, /login has no page — this bridges to /app/login.
// On app.biztrackbd.com the middleware intercepts before this renders.
export default function LoginRedirect() {
  redirect('/app/login')
}
