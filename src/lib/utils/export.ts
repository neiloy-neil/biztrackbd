import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

// Extend jsPDF type to include autoTable if TypeScript complains
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: any
}

export function exportToCSV(data: any[], filename: string) {
  if (!data || !data.length) return
  
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(fieldName => JSON.stringify(row[fieldName], (key, value) => value === null ? '' : value)).join(','))
  ].join('\n')

  // EXP-01 Fix: Prepend UTF-8 BOM (\uFEFF) so Excel on Windows reads Bengali
  // text correctly instead of rendering Mojibake (corrupted characters).
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportToExcel(data: any[], filename: string) {
  if (!data || !data.length) return
  
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1")
  
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

/**
 * EXP-02: Bengali Font Limitation
 * jsPDF's built-in fonts (Helvetica/Times) only support Latin characters.
 * Bengali text (Unicode U+0980–U+09FF) will render as empty boxes unless a
 * custom font is embedded. Two approaches:
 * A) For tabular data (reports): use exportToExcel() instead — XLSX handles Unicode natively.
 * B) For styled receipts: use window.print() with @media print CSS — the browser's font stack
 *    includes Bengali fonts on most devices.
 *
 * This function adds a fallback: if it detects Bengali characters in the data,
 * it routes to Excel instead.
 */
function hasBengaliText(data: any[]): boolean {
  const str = JSON.stringify(data)
  return /[\u0980-\u09FF]/.test(str)
}

export function exportToPDF(data: any[], filename: string, title: string = 'Report') {
  if (!data || !data.length) return

  // EXP-02 Fix: Bengali text cannot render in jsPDF — fall back to Excel which handles Unicode.
  if (hasBengaliText(data)) {
    console.warn('PDF export: Bengali text detected — routing to Excel for correct Unicode rendering.')
    exportToExcel(data, filename)
    return
  }
  
  const doc = new jsPDF() as jsPDFWithAutoTable
  const headers = Object.keys(data[0])
  
  // Format body
  const body = data.map(row => headers.map(key => String(row[key] ?? '')))
  
  // Title
  doc.setFontSize(18)
  doc.text(title, 14, 22)
  doc.setFontSize(11)
  doc.setTextColor(100)
  
  // Table
  doc.autoTable({
    head: [headers.map(h => h.toUpperCase().replace(/_/g, ' '))],
    body: body,
    startY: 30,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
  })
  
  doc.save(`${filename}.pdf`)
}
