'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    question: "Is it free? (এটি কি ফ্রি?)",
    answer: "Yes, we have a completely free plan for basic usage. You can upgrade to a paid plan later if you need advanced features like multiple staff accounts or premium support."
  },
  {
    question: "Can I use it from my phone? (মোবাইল থেকে ব্যবহার করা যাবে?)",
    answer: "Absolutely! BizTrack BD is fully optimized for mobile devices. You can manage your business from anywhere using your smartphone."
  },
  {
    question: "Does it work offline? (ইন্টারনেট ছাড়াও কি কাজ করবে?)",
    answer: "Yes. Once you load the app, you can enter sales and expenses even without an active internet connection. It will automatically sync when you come back online."
  },
  {
    question: "Can I track customer dues? (বাকির হিসাব রাখা যাবে?)",
    answer: "Yes, you can easily track dues (পাওনা) and payables (দেনা) for specific customers or suppliers, and view their balance ledger."
  },
  {
    question: "Can I track bKash/Nagad? (বিকাশ/নগদের হিসাব রাখা যাবে?)",
    answer: "Yes! You can manage multiple cash drawers including physical cash, bKash, Nagad, and bank accounts to see exactly where your money is."
  },
  {
    question: "Can multiple employees use it? (দোকানের স্টাফরা ব্যবহার করতে পারবে?)",
    answer: "Yes, on our paid plans you can add staff members with restricted permissions so they can only enter sales without seeing your overall profit or reports."
  },
  {
    question: "Can I export my data? (রিপোর্ট ডাউনলোড করা যাবে?)",
    answer: "Yes, you can export your sales, expenses, and inventory reports at any time."
  },
  {
    question: "Can I cancel anytime? (যেকোনো সময় কি ক্যানসেল করা যাবে?)",
    answer: "Yes, there are no long-term contracts. You can cancel your subscription at any time directly from your billing settings."
  }
]

export function FAQSection() {
  return (
    <section id="faq" className="py-24 bg-white">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            সাধারণ জিজ্ঞাসা (FAQ)
          </h2>
          <p className="text-lg text-slate-600">
            আপনার মনে কোনো প্রশ্ন থাকলে এখান থেকে উত্তর জেনে নিন।
          </p>
        </div>

        <Accordion className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left text-lg font-medium text-slate-900">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-slate-600 text-base leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
