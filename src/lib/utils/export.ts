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

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportToExcel(data: any[], filename: string) {
  if (!data || !data.length) return
  
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1")
  
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

export function exportToPDF(data: any[], filename: string, title: string = 'Report') {
  if (!data || !data.length) return
  
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
