# Dual-Plane Authentication Architecture

This document describes the physical separation of the Admin Authentication Plane and the Business Authentication Plane for BizTrack BD.

## 1. Architectural Boundaries

To ensure that ordinary business users cannot accidentally or maliciously authenticate into the platform's control plane, we employ a completely isolated secondary Supabase project specifically for Admin Identity.

### Business Plane (Tenant Operations)
- **Primary Users:** Business Owners, Managers, Cashiers
- **Authentication Method:** Mobile number + OTP (or PIN fallback)
- **Environment Variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Frontend Route:** `app.biztrackbd.com/login` (Uses `BusinessLoginForm`)
- **Supabase Project:** The primary database storing `businesses`, `transactions`, `inventory`.

### Admin Plane (Platform Operations)
- **Primary Users:** Platform Administrators, Support Staff, Super Admins
- **Authentication Method:** Secure Email + Password
- **Environment Variables:** `NEXT_PUBLIC_ADMIN_SUPABASE_URL`, `NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY`
- **Frontend Route:** `admin.biztrackbd.com/admin/login` (Uses `AdminLoginForm`)
- **Supabase Project:** A secondary lightweight database strictly for authenticating platform admins.

## 2. Server-Side Execution Flow

When an admin performs an action inside `/admin` (e.g. extending a business subscription or resolving a bug):
1. The browser sends the request to the Next.js server with the `admin_session` cookie.
2. The server validates the `admin_session` against the **Admin Supabase**.
3. If valid, the Next.js server instantiates a connection to the **Business Supabase** using the server-only `SUPABASE_SERVICE_ROLE_KEY`.
4. The server performs the action on behalf of the admin.
5. **Security Guarantee:** The browser running the admin dashboard never holds the service-role key or direct JWTs to the business database.

## 3. Required Environment Variables

When deploying the Admin Panel, the following environment variables must be injected into the production environment:

```env
# Secondary Supabase Project (Strictly for Admin Auth)
NEXT_PUBLIC_ADMIN_SUPABASE_URL=https://[ADMIN_PROJECT_REF].supabase.co
NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY=eyJ...

# Primary Supabase Project (For manipulating business data)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## 4. Admin Migration Strategy

Because admins were previously stored alongside regular users in the Business Supabase (often relying on `platform_admins` tables or custom claims), we must securely migrate them to the new Admin Supabase.

### Step-by-Step Migration Plan
1. **Identify Admins:** Export all users who exist in the `platform_admins` table of the Business database.
2. **Setup Admin Project:** Provision the secondary Supabase project.
3. **Import Identities:** Using the Supabase Management CLI, import the identified admin email addresses into the Admin Supabase Auth module.
4. **Trigger Password Resets:** Since we cannot extract plaintext passwords from the Business database, send a "Platform Migration: Secure Password Reset" email via the Admin Supabase to all imported users.
5. **Revoke Business Access:** Delete the admin identities from the Business Supabase `auth.users` to prevent them from logging into the mobile/tenant app by mistake, enforcing strict role separation.
6. **Hard Cutover:** Deploy the environment variables and the dual-auth application code. Admins will now use their new passwords to log into `admin.biztrackbd.com/admin/login`.
