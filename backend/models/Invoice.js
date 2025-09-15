import { DateUtils, FormatUtils } from '../utils/utils.js';

export class Invoice {
  constructor(data) {
    this.id = data.id || this.generateAbsolutelyUniqueId();
    this.vendor = data.vendor || '';
    this.invoice_number = data.invoice_number || '';
    this.invoice_date = data.invoice_date || '';
    this.due_date = data.due_date || '';
    this.total = parseFloat(data.total) || 0;
    this.items = data.items || [];
    this.processed_date = new Date().toISOString();
  }

  generateAbsolutelyUniqueId() {
    const timestamp = Date.now();
    const microseconds = performance.now().toString().replace('.', '');
    const random1 = Math.random().toString(36).substr(2, 12);
    const random2 = Math.random().toString(36).substr(2, 12);
    const counter = Invoice.idCounter++;

    // High-resolution time or fallback
    let hrtime = '';
    try {
      hrtime = process.hrtime.bigint().toString(36).substr(-10);
    } catch {
      hrtime = Math.random().toString(36).substr(2, 10);
    }

    // Combine ALL entropy sources
    return `inv-${timestamp}-${microseconds}-${counter}-${random1}-${random2}-${hrtime}`;
  }

  getDaysUntilDue() {
    return DateUtils.getDaysUntilDue(this.due_date);
  }

  isOverdue() {
    return DateUtils.isOverdue(this.due_date);
  }

  getFormattedTotal() {
    return FormatUtils.formatCurrency(this.total);
  }

  getDisplayData() {
    return {
      ...this,
      days_until_due: this.getDaysUntilDue(),
      is_overdue: this.isOverdue(),
      formatted_total: this.getFormattedTotal()
    };
  }
}

// Static counter for ID generation - starts from random number
Invoice.idCounter = Math.floor(Math.random() * 10000) + 1;

export const sampleInvoices = [
  {
    id: 'sample-aws-001-fixed-unique-' + Date.now(),
    vendor: "Amazon Web Services",
    invoice_number: "AWS-2024-001",
    invoice_date: "2025-08-20",
    due_date: "2025-09-05",
    total: 2450.00,
    items: ["EC2 Instance", "S3 Storage", "CloudFront CDN"]
  },
  {
    id: 'sample-ms-002-fixed-unique-' + (Date.now() + 1),
    vendor: "Microsoft Corporation",
    invoice_number: "MS-2024-043",
    invoice_date: "2025-08-25",
    due_date: "2025-09-10",
    total: 3100.00,
    items: ["Office 365 License", "Azure Services", "Teams Premium"]
  },
  {
    id: 'sample-goog-003-fixed-unique-' + (Date.now() + 2),
    vendor: "Google LLC",
    invoice_number: "GOOG-2024-028",
    invoice_date: "2025-09-01",
    due_date: "2025-09-20",
    total: 1850.00,
    items: ["Google Cloud Platform", "Google Workspace", "YouTube Premium"]
  },
  {
    id: 'sample-aapl-004-fixed-unique-' + (Date.now() + 3),
    vendor: "Apple Inc.",
    invoice_number: "AAPL-2024-017",
    invoice_date: "2025-08-30",
    due_date: "2025-09-15",
    total: 4200.00,
    items: ["MacBook Pro", "iPhone 15", "Apple Care"]
  },
  {
    id: 'sample-tsla-005-fixed-unique-' + (Date.now() + 4),
    vendor: "Tesla Inc.",
    invoice_number: "TSLA-2024-009",
    invoice_date: "2025-09-02",
    due_date: "2025-09-25",
    total: 1500.00,
    items: ["Supercharger Credits", "Service Package", "Model Y Accessories"]
  }
];
