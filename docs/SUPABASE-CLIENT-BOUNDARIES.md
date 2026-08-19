# Supabase Client Boundaries

BizTrack BD utilizes a unified Supabase project and PostgreSQL database for both the Business Application (tenant-facing) and the Admin Application (platform-facing). To maintain strict security boundaries, the application uses distinct Supabase clients depending on the execution context.

## 1. Business Authentication Context

The Business Application relies on Row Level Security (RLS) policies tied to the standard Supabase authentication context. The session is tracked via standard cookies (e.g., `sb-xyz-auth-token`).

### Clients
- **Browser Client (`createClient` from `@/lib/supabase/client`)**: Used in Client Components. It accesses the user's session from non-HttpOnly cookies.
- **Server Client (`createClient` from `@/lib/supabase/server`)**: Used in Server Components, API routes, and Server Actions. It parses cookies from the incoming request.

### Rules
- **ONLY** use these clients for Business domain operations (e.g., `src/app/app`, `src/app/(public)`).
- **NEVER** use these clients inside `src/app/admin` or `src/domains/admin`. If an admin invokes these clients, it will either fail (due to missing business cookies) or accidentally authenticate the admin as a lower-privileged business user.

## 2. Admin Authentication Context

The Admin Application utilizes a segregated authentication context. The admin session is stored in an `HttpOnly` cookie (`sb-admin-auth-token`) to prevent XSS attacks and differentiate it from the business session.

### Clients
- **Admin Server Auth Client (`createAdminAuthClient` from `@/domains/auth/admin-actions.ts`)**: Used for verifying admin credentials and maintaining the admin session. This client operates with the Admin user's JWT.
- **Admin Service Role Client (`createAdminClient` from `@/lib/supabase/server.ts` or `@/lib/supabase/admin.ts`)**: Uses the `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS. 

### Rules
- **NEVER** perform raw client-side Supabase operations (`@supabase/ssr` browser client) in the Admin UI. Because the admin cookie is `HttpOnly`, the browser client cannot access the session.
- **ALL** admin mutations and data fetching must occur server-side (Server Components or Server Actions).
- **ALL** admin Server Actions must be wrapped in `adminAction` to cryptographically verify the admin session and platform permissions *before* invoking the `adminClient` (service role).

## 3. Storage and Pre-signed URLs

- **Business Storage**: Business users can upload files directly from the browser using `createClient()` (which attaches their JWT for Storage RLS evaluation).
- **Admin Storage**: Admins cannot upload files directly from the browser using standard Supabase storage clients. Admin file uploads must be routed through Server Actions using `FormData`, where the server securely uploads the file using the Service Role client (`adminClient`).

## 4. Internal System Operations

- **Cron Jobs & Webhooks**: Must use `createAdminClient()` (Service Role) since there is no active user session.
- **Security Check**: These endpoints must be protected by cryptographic secrets (e.g., `CRON_SECRET`, webhook signatures) to prevent unauthorized invocation.
