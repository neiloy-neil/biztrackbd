export function ProblemSolution() {
  return (
    <section className="py-24 bg-white border-t border-b">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
              লাল খাতার দিন শেষ, <br />
              <span className="text-indigo-600">স্মার্ট ব্যবসার শুরু।</span>
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              সারাদিন বেচাকেনা করে রাতে খাতা-কলম নিয়ে হিসাব মেলাতে মেলাতে ক্লান্ত? 
              ভুল হিসাব, বাকি টাকা হারিয়ে যাওয়া বা স্টকে কত মাল আছে তা না জানার কারণে 
              প্রতি মাসে আপনার ব্যবসার যে ক্ষতি হচ্ছে, তা আর নয়।
            </p>
            <ul className="space-y-4 pt-4">
              <li className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mt-1 mr-3">
                  <span className="text-red-600 text-xs font-bold">✕</span>
                </div>
                <p className="text-slate-700">খাতায় লিখে রাখলে হারিয়ে যাওয়া বা নষ্ট হওয়ার ভয় থাকে।</p>
              </li>
              <li className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center mt-1 mr-3">
                  <span className="text-emerald-600 text-xs font-bold">✓</span>
                </div>
                <p className="text-slate-700">BizTrack BD তে ডাটা ক্লাউডে সুরক্ষিত থাকে। যেকোনো সময় যেকোনো ডিভাইস থেকে এক্সেস করা যায়।</p>
              </li>
            </ul>
          </div>
          
          <div className="bg-slate-50 p-8 rounded-2xl border relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="text-8xl font-serif">"</span>
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-semibold mb-4 text-slate-900">"BizTrack BD ব্যবহার করার পর থেকে আমার ব্যবসার হিসাব রাখা অর্ধেক সহজ হয়ে গেছে। এখন আমি জানি প্রতিদিন আমার কত লাভ হচ্ছে।"</h3>
              <div className="flex items-center gap-4 mt-8">
                <div className="w-12 h-12 bg-indigo-200 rounded-full flex items-center justify-center font-bold text-indigo-700">SA</div>
                <div>
                  <div className="font-semibold text-slate-900">Sayed Alamin</div>
                  <div className="text-sm text-slate-500">Retail Shop Owner, Dhaka</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
