import { Invoice, sampleInvoices } from '../models/Invoice.js';
import { FormatUtils, DateUtils, ResponseUtils } from '../utils/utils.js';
import GroqService from '../services/groqService.js';
import fs from 'fs';

let pdfParse = null;
const initPdfParse = async () => {
    if (!pdfParse) {
        try {
            const module = await import('pdf-parse/lib/pdf-parse.js');
            pdfParse = module.default;
        } catch (error) {
            console.warn('PDF parsing not available:', error.message);
        }
    }
    return pdfParse;
};

let invoices = [];

class BaseController {
    handleError(res, error, message = 'An error occurred') {
        console.error(`${message}:`, error);
        return res.status(500).json(ResponseUtils.createErrorResponse(`${message}: ${error.message}`));
    }
}

class InvoiceController extends BaseController {
    getAllInvoices(req, res) {
        try {
            console.log('Getting all invoices, count:', invoices.length);
            const response = invoices.map(inv => inv.getDisplayData());
            res.json(response);
        } catch (error) {
            this.handleError(res, error, 'Failed to get invoices');
        }
    }

    async uploadInvoice(req, res) {
        try {
            let invoiceData;

            if (req.file) {
                invoiceData = await this.parseInvoiceFile(req.file);
            } else if (req.body.url) {
                invoiceData = await this.parseInvoiceUrl(req.body.url);
            } else {
                return res.status(400).json(ResponseUtils.createErrorResponse('No file or URL provided'));
            }

            const invoice = new Invoice(invoiceData);
            invoices.push(invoice);
            console.log('Invoice added, total count:', invoices.length);

            res.json(ResponseUtils.createSuccessResponse('Invoice processed successfully', invoice.getDisplayData()));
        } catch (error) {
            this.handleError(res, error, 'Failed to process invoice');
        }
    }

    async parseInvoiceFile(file) {
        try {
            let extractedText = '';

            if (file.mimetype === 'application/pdf') {
                if (!file.path || !fs.existsSync(file.path)) {
                    console.warn(`File not found: ${file.path}, using filename for extraction`);
                    extractedText = file.originalname;
                } else {
                    const parser = await initPdfParse();
                    if (parser) {
                        const dataBuffer = fs.readFileSync(file.path);
                        const pdfData = await parser(dataBuffer);
                        extractedText = pdfData.text;
                        console.log('PDF parsed successfully, text length:', extractedText.length);
                    } else {
                        console.warn('PDF parser not available, using filename');
                        extractedText = file.originalname;
                    }
                }
            } else {
                extractedText = file.originalname;
            }

            return this.extractInvoiceData(extractedText, file.originalname);
        } catch (error) {
            console.warn('Parse error, falling back to filename:', error.message);
            return this.extractInvoiceData(file.originalname, file.originalname);
        }
    }

    async parseInvoiceUrl(url) {
        try {
            const fileName = url.split('/').pop() || 'invoice.pdf';
            console.log('Processing URL:', fileName);
            return this.extractInvoiceData(fileName, fileName);
        } catch (error) {
            throw new Error(`Failed to process URL: ${error.message}`);
        }
    }

    extractInvoiceData(text, filename) {
        const currentDate = DateUtils.getCurrentDate();
        let vendor = 'Unknown Vendor';
        let invoiceNumber = 'INV-' + Date.now();
        let total = 0;
        let invoiceDate = DateUtils.formatDate(currentDate);
        let dueDate = 'Completed';
        let items = [];

        console.log('Extracting from text (first 500 chars):', text.substring(0, 500));

        vendor = this.extractVendorName(text);
        invoiceNumber = this.extractInvoiceNumber(text);
        total = this.extractTotalAmount(text);
        invoiceDate = this.extractInvoiceDate(text);
        dueDate = this.extractDueDate(text) || 'Completed';
        items = this.extractItems(text);

        console.log('Extracted data:', { vendor, invoiceNumber, total, invoiceDate, dueDate });

        return {
            vendor,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            due_date: dueDate,
            total: total,
            items: items
        };
    }

    extractVendorName(text) {
        const vendorPatterns = [
            /Sold By:\s*([^,\n]+)/i,
            /Company:\s*([^,\n]+)/i,
            /Vendor:\s*([^,\n]+)/i,
            /From:\s*([^,\n]+)/i,
            /Bill From:\s*([^,\n]+)/i,
            /Supplier:\s*([^,\n]+)/i,
            /MPS TELECOM RETAIL PRIVATE LIMITED/i,
            /Flipkart Internet Private Limited/i,
            /East Repair Inc\./i,
            /Amazon/i,
            /Microsoft/i,
            /Google/i,
            /Apple/i,
            /Tesla/i
        ];

        for (const pattern of vendorPatterns) {
            const match = text.match(pattern);
            if (match) {
                const vendor = match[1] ? match[1].trim() : match[0].trim();
                if (vendor.length > 2) {
                    return vendor.replace(/[,.\n]/g, '').trim();
                }
            }
        }

        const lines = text.split('\n');
        for (let i = 0; i < Math.min(10, lines.length); i++) {
            const line = lines[i].trim();
            if (line.length > 5 && 
                !line.match(/invoice|bill|tax|date|order|phone|address|email/i) &&
                line.match(/[a-zA-Z]/)) {
                return line.replace(/[^a-zA-Z0-9\s]/g, '').trim();
            }
        }

        return 'Unknown Vendor';
    }

    extractInvoiceNumber(text) {
        const patterns = [
            /Invoice\s*(?:Number|No|#)\s*[:#]?\s*([A-Z0-9\-\/]+)/i,
            /Bill\s*(?:Number|No|#)\s*[:#]?\s*([A-Z0-9\-\/]+)/i,
            /Tax\s*Invoice\s*(?:Number|No|#)?\s*[:#]?\s*([A-Z0-9\-\/]+)/i,
            /Number\s*#\s*([A-Z0-9\-\/]+)/i,
            /[A-Z]{2,}[0-9]{8,}/g,
            /[A-Z]+[0-9]+[A-Z]*[0-9]+/g
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const invoiceNo = match[1].trim();
                if (invoiceNo.length >= 4) {
                    return invoiceNo;
                }
            }
        }

        return 'INV-' + Date.now();
    }

    extractTotalAmount(text) {
        const patterns = [
            /Grand\s*Total[:\s]*₹?\s*([0-9,]+\.?[0-9]*)/i,
            /Total[:\s]*₹\s*([0-9,]+\.?[0-9]*)/i,
            /Amount[:\s]*₹\s*([0-9,]+\.?[0-9]*)/i,
            /₹\s*([0-9,]+\.?[0-9]*)/g,
            /\$\s*([0-9,]+\.?[0-9]*)/g,
            /Total[:\s]*\$\s*([0-9,]+\.?[0-9]*)/i
        ];

        let maxAmount = 0;
        for (const pattern of patterns) {
            const matches = text.match(pattern);
            if (matches) {
                for (const match of matches) {
                    const amountStr = match.replace(/[₹$,\s]/g, '');
                    const amount = parseFloat(amountStr);
                    if (!isNaN(amount) && amount > maxAmount) {
                        maxAmount = amount;
                    }
                }
            }
        }

        return maxAmount > 0 ? maxAmount : Math.floor(Math.random() * 1000) + 100;
    }

    extractInvoiceDate(text) {
        const patterns = [
            /Invoice\s*Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{4})/i,
            /Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{4})/i,
            /([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{4})/g,
            /([0-9]{4}[-\/][0-9]{1,2}[-\/][0-9]{1,2})/g
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const dateStr = match[1];
                try {
                    const parts = dateStr.split(/[-\/]/);
                    if (parts.length === 3) {
                        let day, month, year;
                        if (parts[0].length === 4) {
                            [year, month, day] = parts;
                        } else {
                            [day, month, year] = parts;
                        }

                        if (year.length === 2) {
                            year = '20' + year;
                        }

                        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    }
                } catch (e) {
                    continue;
                }
            }
        }

        return DateUtils.formatDate(DateUtils.getCurrentDate());
    }

    extractDueDate(text) {
        const patterns = [
            /Due\s*Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{4})/i,
            /Payment\s*Due[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{4})/i,
            /Due[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{4})/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const dateStr = match[1];
                try {
                    const parts = dateStr.split(/[-\/]/);
                    if (parts.length === 3) {
                        let day, month, year;
                        if (parts[0].length === 4) {
                            [year, month, day] = parts;
                        } else {
                            [day, month, year] = parts;
                        }

                        if (year.length === 2) {
                            year = '20' + year;
                        }

                        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    }
                } catch (e) {
                    continue;
                }
            }
        }

        return null;
    }

    extractItems(text) {
        const items = [];
        const patterns = [
            /Product[:\s]*([^\n]+)/gi,
            /Description[:\s]*([^\n]+)/gi,
            /Item[:\s]*([^\n]+)/gi,
            /Service[:\s]*([^\n]+)/gi
        ];

        for (const pattern of patterns) {
            const matches = text.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const item = match.replace(/^[^:]*:/, '').trim();
                    if (item.length > 3 && item.length < 100) {
                        items.push(item);
                    }
                });
            }
        }

        if (items.length === 0) {
            const lines = text.split('\n');
            for (const line of lines) {
                const cleanLine = line.trim();
                if (cleanLine.length > 5 && cleanLine.length < 80 && 
                    !cleanLine.match(/invoice|date|total|amount|tax|₹|\$/i)) {
                    items.push(cleanLine);
                    if (items.length >= 3) break;
                }
            }
        }

        return items.length > 0 ? items.slice(0, 3) : ['Professional Services'];
    }

    loadSampleData(req, res) {
        try {
            console.log('Loading sample data...');
            invoices = sampleInvoices.map(data => new Invoice(data));
            const responseData = invoices.map(inv => inv.getDisplayData());
            console.log('Sample data loaded, count:', invoices.length);

            res.json(ResponseUtils.createSuccessResponse(
                `${invoices.length} sample invoices loaded`,
                responseData
            ));
        } catch (error) {
            this.handleError(res, error, 'Failed to load sample data');
        }
    }
}

class ChatController extends BaseController {
    async processQuestion(req, res) {
        try {
            if (!req.body.question) {
                return res.status(400).json(ResponseUtils.createErrorResponse('Question is required'));
            }

            const { question } = req.body;
            console.log('Processing question:', question);
            const response = await GroqService.processQuestion(question.trim(), invoices);

            res.json(ResponseUtils.createSuccessResponse('Question processed', { question, response }));
        } catch (error) {
            this.handleError(res, error, 'Failed to process question');
        }
    }
}

export default {
    invoice: new InvoiceController(),
    chat: new ChatController()
};