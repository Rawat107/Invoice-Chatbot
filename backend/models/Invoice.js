// backend/models/Invoice.js
import { DateUtils, FormatUtils } from '../utils/utils.js';

export class Invoice {
    constructor(data) {
        this.id = data.id || Date.now().toString();
        this.vendor = data.vendor || '';
        this.invoice_number = data.invoice_number || '';
        this.invoice_date = data.invoice_date || '';
        this.due_date = data.due_date || '';
        this.total = parseFloat(data.total) || 0;
        this.items = data.items || [];
        this.processed_date = new Date().toISOString();
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

export const sampleInvoices = [
    {
        vendor: "Amazon Web Services",
        invoice_number: "AWS-2024-001",
        invoice_date: "2025-08-20",
        due_date: "2025-09-05",
        total: 2450.00,
        items: ["EC2 Instance", "S3 Storage", "CloudFront CDN"]
    },
    {
        vendor: "Microsoft Corporation",
        invoice_number: "MS-2024-043",
        invoice_date: "2025-08-25",
        due_date: "2025-09-10",
        total: 3100.00,
        items: ["Office 365 License", "Azure Services", "Teams Premium"]
    },
    {
        vendor: "Google LLC",
        invoice_number: "GOOG-2024-028",
        invoice_date: "2025-09-01",
        due_date: "2025-09-20",
        total: 1850.00,
        items: ["Google Cloud Platform", "Google Workspace", "YouTube Premium"]
    },
    {
        vendor: "Apple Inc.",
        invoice_number: "AAPL-2024-017",
        invoice_date: "2025-08-30",
        due_date: "2025-09-15",
        total: 4200.00,
        items: ["MacBook Pro", "iPhone 15", "Apple Care"]
    },
    {
        vendor: "Tesla Inc.",
        invoice_number: "TSLA-2024-009",
        invoice_date: "2025-09-02",
        due_date: "2025-09-25",
        total: 1500.00,
        items: ["Supercharger Credits", "Service Package", "Model Y Accessories"]
    }
];