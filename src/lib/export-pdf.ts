import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatRupiah } from './format'

export interface ExportReportParams {
  periodeLabel: string
  filenameMonth: string
  totals: { income: number; expense: number; net: number }
  expenseByCat: { category: string; total: number }[]
  incomeByCat: { category: string; total: number }[]
  investments: { name: string; modal: number; nilai: number }[]
}

export function exportReportPDF(params: ExportReportParams): void {
  const { periodeLabel, filenameMonth, totals, expenseByCat, incomeByCat, investments } = params
  const doc = new jsPDF()

  // Header
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Laporan Keuangan', 14, 22)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(periodeLabel, 14, 30)

  // Summary
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Ringkasan', 14, 44)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  const summaryRows: [string, string, string][] = [
    ['Total Pemasukan', formatRupiah(totals.income), ''],
    ['Total Pengeluaran', formatRupiah(totals.expense), ''],
    ['Net', formatRupiah(totals.net), ''],
  ]
  autoTable(doc, {
    startY: 48,
    head: [['Keterangan', 'Jumlah', '']],
    body: summaryRows,
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: { 2: { cellWidth: 0 } },
    showHead: false,
    theme: 'plain',
    styles: { fontSize: 10 },
    margin: { left: 14 },
  })

  let cursorY: number = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // Pengeluaran per Kategori
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Pengeluaran per Kategori', 14, cursorY)
  cursorY += 4

  autoTable(doc, {
    startY: cursorY,
    head: [['Kategori', 'Total']],
    body: expenseByCat.length > 0
      ? expenseByCat.map((r) => [r.category, formatRupiah(r.total)])
      : [['Tidak ada data pada periode ini', '']],
    headStyles: { fillColor: [239, 68, 68] },
    styles: { fontSize: 10 },
    margin: { left: 14 },
  })

  cursorY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // Pemasukan per Kategori
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Pemasukan per Kategori', 14, cursorY)
  cursorY += 4

  autoTable(doc, {
    startY: cursorY,
    head: [['Kategori', 'Total']],
    body: incomeByCat.length > 0
      ? incomeByCat.map((r) => [r.category, formatRupiah(r.total)])
      : [['Tidak ada data pada periode ini', '']],
    headStyles: { fillColor: [16, 185, 129] },
    styles: { fontSize: 10 },
    margin: { left: 14 },
  })

  cursorY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // Kinerja Investasi
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Kinerja Investasi', 14, cursorY)
  cursorY += 4

  autoTable(doc, {
    startY: cursorY,
    head: [['Nama Aset', 'Modal', 'Nilai Kini', 'Gain/Loss']],
    body: investments.length > 0
      ? investments.map((i) => [
          i.name,
          formatRupiah(i.modal),
          formatRupiah(i.nilai),
          formatRupiah(i.nilai - i.modal),
        ])
      : [['Belum ada investasi', '', '', '']],
    headStyles: { fillColor: [14, 165, 233] },
    styles: { fontSize: 10 },
    margin: { left: 14 },
  })

  doc.save(`laporan-keuangan-${filenameMonth}.pdf`)
}
