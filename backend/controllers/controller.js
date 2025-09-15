import { Invoice, sampleInvoices } from '../models/Invoice.js';
import { FormatUtils, DateUtils, ResponseUtils } from '../utils/utils.js';
import OpenAiService from '../services/openAiService.js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

let pdfParse = null;

// Lazy-load pdf-parse when needed
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

// Base controller with common methods
class BaseController {
  handleError(res, error, message = 'An error occurred') {
    console.error(`ERROR ${message}:`, error);
    return res.status(500).json(ResponseUtils.createErrorResponse(`${message}: ${error.message}`));
  }
}

// In-memory invoice storage for simplicity
class InvoiceController extends BaseController {
  getAllInvoices(req, res) {
    try {
      console.log(`Getting all invoices: ${invoices.length} found`);
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
        console.log('Processing uploaded file:', req.file.originalname);
        invoiceData = await this.parseInvoiceFile(req.file);
      } else if (req.body.url) {
        console.log('Processing URL:', req.body.url);
        invoiceData = await this.parseInvoiceUrl(req.body.url);
      } else {
        return res.status(400).json(ResponseUtils.createErrorResponse('No file or URL provided'));
      }

      const invoice = new Invoice(invoiceData);
      invoices.push(invoice);

      console.log(`Invoice added: ${invoice.invoice_number} (ID: ${invoice.id})`);
      console.log(`Total invoices: ${invoices.length}`);

      res.json(ResponseUtils.createSuccessResponse('Invoice processed successfully', invoice.getDisplayData()));
    } catch (error) {
      this.handleError(res, error, 'Failed to process invoice');
    }
  }

  // Delete an invoice by ID
  async deleteInvoice(req, res) {
    try {
      const { id } = req.params;
      console.log(`Attempting to delete invoice: ${id}`);

      if (!id) {
        return res.status(400).json(ResponseUtils.createErrorResponse('Invoice ID is required'));
      }

      const invoiceToDelete = invoices.find(inv => inv.id === id);
      if (!invoiceToDelete) {
        console.log(`Invoice not found: ${id}`);
        return res.status(404).json(ResponseUtils.createErrorResponse('Invoice not found'));
      }

      const initialCount = invoices.length;
      invoices = invoices.filter(inv => inv.id !== id);

      if (invoices.length === initialCount) {
        console.log(`Failed to delete invoice: ${id}`);
        return res.status(500).json(ResponseUtils.createErrorResponse('Failed to delete invoice'));
      }

      console.log(`Successfully deleted invoice: ${invoiceToDelete.vendor} (${id})`);
      console.log(`Remaining invoices: ${invoices.length}`);

      res.json(ResponseUtils.createSuccessResponse('Invoice deleted successfully'));
    } catch (error) {
      this.handleError(res, error, 'Failed to delete invoice');
    }
  }

  loadSampleData(req, res) {
    try {
      console.log('Loading sample data...');

      invoices = [];
      invoices = sampleInvoices.map(data => new Invoice(data));
      const responseData = invoices.map(inv => inv.getDisplayData());

      console.log(`Sample data loaded: ${invoices.length} invoices`);

      res.json(ResponseUtils.createSuccessResponse(
        `${invoices.length} sample invoices loaded`,
        responseData
      ));
    } catch (error) {
      this.handleError(res, error, 'Failed to load sample data');
    }
  }

  // Parse invoice from an uploaded file (PDF or image)
  async parseInvoiceFile(file) {
    try {
      let extractedText = '';
      if (file.mimetype === 'application/pdf') {
        if (!file.path || !fs.existsSync(file.path)) {
          extractedText = file.originalname;
        } else {
          const parser = await initPdfParse();
          if (parser) {
            const dataBuffer = fs.readFileSync(file.path);
            const pdfData = await parser(dataBuffer);
            extractedText = pdfData.text;
          } else {
            extractedText = file.originalname;
          }
        }
      } else {
        extractedText = file.originalname;
      }

      return this.extractInvoiceData(extractedText, file.originalname);
    } catch (error) {
      return this.extractInvoiceData(file.originalname, file.originalname);
    }
  }

  // Parse invoice from a given URL (PDF or text)
  async parseInvoiceUrl(url) {
    try {
      const content = await this.downloadFromUrl(url);
      const fileName = url.split('/').pop() || 'invoice.pdf';
      let extractedText = '';

      if (fileName.toLowerCase().endsWith('.pdf') || content.startsWith('%PDF')) {
        const parser = await initPdfParse();
        if (parser) {
          try {
            const pdfData = await parser(content);
            extractedText = pdfData.text;
          } catch {
            extractedText = fileName;
          }
        } else {
          extractedText = fileName;
        }
      } else {
        extractedText = content.toString('utf8');
      }

      return this.extractInvoiceData(extractedText, fileName);
    } catch {
      const fileName = url.split('/').pop() || 'invoice.pdf';
      return this.extractInvoiceData(fileName, fileName);
    }
  }

  // Download file content from a URL with timeout and error handling
  async downloadFromUrl(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      const request = client.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'Invoice-Assistant/1.0' }
      }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          this.downloadFromUrl(response.headers.location).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
      });
      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  extractInvoiceData(text, filename) {
    const currentDate = DateUtils.getCurrentDate();
    return {
      vendor: this.extractVendorName(text),
      invoice_number: this.extractInvoiceNumber(text),
      invoice_date: this.extractInvoiceDate(text) || DateUtils.formatDate(currentDate),
      due_date: this.extractDueDate(text) || 'Completed',
      total: this.extractTotalAmount(text),
      items: this.extractItems(text)
    };
  }

  extractVendorName(text) {
    const vendorPatterns = [
      /Sold\s*By[:\s]*([^\n]+)/i,
      /Vendor[:\s]*([^\n]+)/i,
      /Company[:\s]*([^\n]+)/i
    ];

    for (const pattern of vendorPatterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    const keywords = ["Amazon", "Microsoft", "Google", "Apple", "Tesla"];
    const found = keywords.find(k => text.toLowerCase().includes(k.toLowerCase()));
    return found || "Unknown Vendor";
  }

  extractInvoiceNumber(text) {
    const patterns = [
      /Invoice\s*(?:Number|No|#)[:\s]*([A-Z0-9\-\/]+)/i,
      /(?:INV|BILL|REF)[-#]?\s*([A-Z0-9\-\/]{4,})/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return 'INV-' + Date.now();
  }

  // Heuristic to find the largest monetary amount in the text
  extractTotalAmount(text) {
    const patterns = [
      /Grand\s*Total[:\s]*\$?₹?\s*([0-9,]+\.?[0-9]*)/i,
      /Total[:\s]*\$?₹?\s*([0-9,]+\.?[0-9]*)/i,
      /\$([0-9,]+\.[0-9]{2})/g
    ];

    let maxAmount = 0;
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        (Array.isArray(matches) ? matches : [matches]).forEach(m => {
          const amountStr = m.replace(/[₹$,\s]/g, '');
          const amount = parseFloat(amountStr);
          if (!isNaN(amount) && amount > maxAmount) maxAmount = amount;
        });
      }
    }

    return maxAmount || Math.floor(Math.random() * 1000 + 100);
  }

  extractInvoiceDate(text) {
    //looks for "Invoice Date: DD-MM-YYYY" or similar patterns
    const match = text.match(/Invoice\s*Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i);
    return match ? this.normalizeDate(match[1]) : null;
  }

  extractDueDate(text) {
    // looks for "Due Date: DD-MM-YYYY" or similar patterns
    const match = text.match(/Due\s*Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i);
    return match ? this.normalizeDate(match[1]) : null;
  }

  normalizeDate(dateStr) {
    try {
      const parts = dateStr.split(/[-\/]/);
      if (parts.length === 3) {
        let [d, m, y] = parts;
        if (y.length === 2) y = parseInt(y) > 50 ? '19' + y : '20' + y;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    } catch {}
    return null;
  }

  
  extractItems(text) {
    const items = [];
    // Look for lines starting with "Description" or "Item"
    const patterns = [/Description[:\s]*([^\n]+)/gi, /Item[:\s]*([^\n]+)/gi];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const item = match[1].trim();
        if (item.length > 3) items.push(item);
      }
    }

    return items.length ? items.slice(0, 3) : ['Service'];
  }
}

class ChatController extends BaseController {
  async processQuestion(req, res) {
    try {
      console.log('Chat request received');

      if (!req.body.question) {
        console.log('No question provided');
        return res.status(400).json(ResponseUtils.createErrorResponse('Question is required'));
      }

      const { question } = req.body;
      console.log(`Question: "${question}"`);
      console.log(`Available invoices: ${invoices.length}`);

      if (invoices.length === 0) {
        console.log('No invoices available');
      } else {
        console.log('Invoice summaries:');
        invoices.forEach((inv, i) => {
          console.log(`  ${i+1}. ${inv.vendor} - $${inv.total.toFixed(2)} (${inv.isOverdue() ? 'OVERDUE' : 'ON-TIME'})`);
        });
      }

      console.log('Calling OpenAI Service...');
      const response = await OpenAiService.processQuestion(question.trim(), invoices);

      console.log('OpenAI Service response received');
      console.log(`Response length: ${response?.length || 0} characters`);

      res.json(ResponseUtils.createSuccessResponse('Question processed', { 
        question, 
        response 
      }));

    } catch (error) {
      console.error('Chat processing error:', {
        name: error.name,
        message: error.message
      });

      let fallbackResponse;
      if (invoices.length > 0) {
        const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
        const overdue = invoices.filter(inv => inv.isOverdue()).length;
        const onTime = invoices.filter(inv => !inv.isOverdue()).length;
        const highest = invoices.reduce((max, inv) => inv.total > max.total ? inv : max);

        fallbackResponse = `I have ${invoices.length} invoices totaling $${total.toFixed(2)}.

        Key information:
        - Highest: ${highest.vendor} ($${highest.total.toFixed(2)})
        - Overdue: ${overdue} invoices  
        - On-time: ${onTime} invoices

        Ask me about specific details, due dates, or vendor analysis.

        Note: Using fallback mode due to service error.`;
      } else {
        fallbackResponse = 'No invoices loaded. Please load sample data or upload invoices first.';
      }

      res.json(ResponseUtils.createSuccessResponse('Fallback response', { 
        question, 
        response: fallbackResponse 
      }));
    }
  }
}

export default {
  invoice: new InvoiceController(),
  chat: new ChatController()
};
