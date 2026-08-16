'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { createParty } from '@/domains/parties/actions'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
type PartyType = 'customer' | 'supplier' | 'both'
import { toast } from 'sonner'

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }),
  phone: z.string().optional(),
})

interface PartyFormProps {
  businessId: string
  type: PartyType
  onSuccess?: () => void
}

export function PartyForm({ businessId, type, onSuccess }: PartyFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      phone: '',
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)
    try {
      await createParty({
        type,
        name: values.name,
        phone: values.phone,
        opening_balance: 0
      })
      toast.success(type === 'customer' ? 'Customer added!' : 'Supplier added!')
      form.reset()
      if (onSuccess) onSuccess()
    } catch (error) {
      toast.error('Failed to add party')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>নাম (Name)</FormLabel>
              <FormControl>
                <Input placeholder="Enter name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>মোবাইল নম্বর (Phone)</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="01XXX-XXXXXX" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Saving...' : 'সেভ করুন (Save)'}
        </Button>
      </form>
    </Form>
  )
}
