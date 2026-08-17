const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBanglaNumber(number: number | string): string {
  if (number === null || number === undefined) return '';
  const numStr = number.toString();
  return numStr.replace(/\d/g, (d) => banglaDigits[parseInt(d, 10)]);
}

export function formatBanglaCurrency(amount: number): string {
  const n = amount ?? 0
  const formatted = n.toLocaleString('en-IN')
  return toBanglaNumber(formatted)
}
