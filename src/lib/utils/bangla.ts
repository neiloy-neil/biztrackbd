const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBanglaNumber(number: number | string): string {
  if (number === null || number === undefined) return '';
  const numStr = number.toString();
  return numStr.replace(/\d/g, (d) => banglaDigits[parseInt(d, 10)]);
}

export function formatBanglaCurrency(amount: number): string {
  // First add commas normally
  const formatted = amount.toLocaleString('en-IN'); // Indian/Bangladeshi comma style (lakhs/crores)
  // Then convert digits
  return toBanglaNumber(formatted);
}
