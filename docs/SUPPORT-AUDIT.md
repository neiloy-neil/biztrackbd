# Support System Audit

## Executive Summary
This document outlines the findings of the Support System audit (`public.support_tickets`, `public.support_ticket_messages`, and `storage.objects`). While the system correctly separates tickets by business, it suffers from a massive data leak in the attachments bucket and critical RLS omissions that allow users to forge messages from administrators.

---

## 1. Unrestricted Attachment Access (Critical Data Leak)

The `support-attachments` storage bucket is intended to hold sensitive information (invoices, screenshots, logs, etc.). However, its Row Level Security is fundamentally broken.

**The Flaw:**
In `20260817110000_support_system.sql`, the policy is defined as:
```sql
CREATE POLICY "Users can view attachments" ON storage.objects
FOR SELECT USING (bucket_id = 'support-attachments' AND auth.role() = 'authenticated');
```

**The Impact:**
There is **zero tenant isolation** for attachments. Any authenticated user on the platform can view, download, or script the enumeration of every single support attachment uploaded by any other business. An attacker simply needs to call the Supabase Storage API directly from their browser console.

---

## 2. Message Spoofing & Identity Forgery (Integrity Failure)

The system allows tenants to insert messages into their support tickets, but it completely fails to verify the identity of the sender.

**The Flaw:**
```sql
CREATE POLICY "Tenant isolation INSERT messages" ON public.support_ticket_messages 
FOR INSERT WITH CHECK (
  is_internal_note = false AND 
  EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.id = ticket_id AND public.is_business_member(st.business_id))
);
```

**The Impact:**
Because there is no check ensuring `sender_id = auth.uid()`, a malicious tenant can bypass the UI, connect to the database via the Supabase client, and insert a message with the `sender_id` of a Platform Admin. This allows them to forge official support replies (e.g., "We have processed your refund of $5,000"). 

---

## 3. Ticket Spoofing & Unrestricted Fields

When creating a ticket, the RLS policy only verifies that the `business_id` belongs to the user. It fails to restrict other sensitive columns.

**The Flaw:**
```sql
CREATE POLICY "Tenant isolation INSERT tickets" ON public.support_tickets 
FOR INSERT WITH CHECK (public.is_business_member(business_id));
```

**The Impact:**
A malicious tenant can insert a ticket and arbitrarily set:
- `user_id`: Spoofing the creator to be a different member of their business.
- `assigned_to`: Forcefully assigning the ticket to a specific super admin's UUID to spam them.
- `status`: Creating tickets that are immediately `Resolved` or `Closed` to bypass reporting metrics.

---

## Conclusion
The Support System's Row Level Security must be completely rewritten. 
1. The `storage.objects` policy must join against `support_ticket_messages` and `support_tickets` to verify the user has access to the ticket containing the attachment.
2. The `INSERT` policies for both tickets and messages must enforce `user_id = auth.uid()` and `sender_id = auth.uid()`.
3. The `INSERT` policy for tickets must force `status = 'Open'` and `assigned_to = NULL`.
