import Groq from 'groq-sdk';
import { FormatUtils, ValidationUtils } from '../utils/utils.js';

class GroqService {
    constructor() {
        this.groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
        this.responseLimit = 10;
    }

    async processQuestion(question, invoices) {
        const lowerQ = question.toLowerCase();

        if (ValidationUtils.isNonInvoiceQuestion(lowerQ)) {
            return "I can only help with invoice-related questions. Please ask about invoice totals, due dates, vendors, amounts, or specific invoice details.";
        }

        if (invoices.length === 0) {
            return 'No invoices loaded. Please upload invoices or load sample data first.';
        }

        try {
            if (this.groq) {
                const context = this.buildDetailedContext(invoices);
                const aiResponse = await this.getGroqResponse(question, context);
                if (aiResponse) return aiResponse;
            }
        } catch (error) {
            console.log('AI service failed, using enhanced rule-based response');
        }

        return this.processIntelligentQuestion(question, invoices);
    }

    async getGroqResponse(question, context) {
        try {
            const enhancedPrompt = `You are an intelligent invoice assistant. From the given invoice data, answer the user's question accurately and completely.

          ${context}

          User Question: ${question}

          Instructions:
          - Answer ONLY based on the invoice data provided above
          - Be specific with numbers, dates, and vendor names
          - If asking about "on time" invoices, those are invoices that are not overdue
          - If asking about highest/lowest values, provide exact amounts and vendor names
          - If asking about amounts less than/above certain values, filter and show only matching results
          - If the question cannot be answered from the invoice data, say "I cannot find that information in the current invoices"
          - Always be precise and helpful`;

            const completion = await this.groq.chat.completions.create({
                messages: [
                    { role: "system", content: enhancedPrompt },
                    { role: "user", content: question }
                ],
                model: "mixtral-8x7b-32768",
                temperature: 0.1,
                max_tokens: 1000
            });

            return completion.choices[0]?.message?.content;
        } catch (error) {
            throw error;
        }
    }

    processIntelligentQuestion(question, invoices) {
        const lowerQ = question.toLowerCase();

        if (lowerQ.includes('on time') || lowerQ.includes('ontime')) {
            const onTimeInvoices = invoices.filter(inv => !inv.isOverdue());
            return `${onTimeInvoices.length} invoices are on time: ${onTimeInvoices.map(inv => inv.vendor).join(', ')}`;
        }

        if (lowerQ.includes('highest value') || lowerQ.includes('most expensive') || lowerQ.includes('largest')) {
            const highest = invoices.reduce((max, inv) => inv.total > max.total ? inv : max, invoices[0]);
            return `The highest value invoice is from ${highest.vendor} with ${FormatUtils.formatCurrency(highest.total)} (Invoice: ${highest.invoice_number})`;
        }

        if (lowerQ.includes('lowest value') || lowerQ.includes('cheapest') || lowerQ.includes('smallest')) {
            const lowest = invoices.reduce((min, inv) => inv.total < min.total ? inv : min, invoices[0]);
            return `The lowest value invoice is from ${lowest.vendor} with ${FormatUtils.formatCurrency(lowest.total)} (Invoice: ${lowest.invoice_number})`;
        }

        if (lowerQ.includes('overdue') || lowerQ.includes('late')) {
            const overdueInvoices = invoices.filter(inv => inv.isOverdue());
            if (overdueInvoices.length === 0) return 'No invoices are overdue.';
            const total = overdueInvoices.reduce((sum, inv) => sum + inv.total, 0);
            return `${overdueInvoices.length} overdue invoices: ${overdueInvoices.map(inv => `${inv.vendor} (${FormatUtils.formatCurrency(inv.total)})`).join(', ')}. Total overdue: ${FormatUtils.formatCurrency(total)}`;
        }

        if (lowerQ.includes('total') && (lowerQ.includes('value') || lowerQ.includes('amount'))) {
            const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
            return `Total value of all invoices: ${FormatUtils.formatCurrency(total)} across ${invoices.length} invoices`;
        }

        const amount = this.extractAmount(question);
        if (amount && (lowerQ.includes('less than') || lowerQ.includes('below') || lowerQ.includes('under') || lowerQ.includes('<'))) {
            const filtered = invoices.filter(inv => inv.total < amount);
            if (filtered.length === 0) {
                return `No invoices below ${FormatUtils.formatCurrency(amount)}.`;
            }
            const vendorList = filtered.map(inv => `${inv.vendor} (${FormatUtils.formatCurrency(inv.total)})`).join(', ');
            return `Vendors with invoices below ${FormatUtils.formatCurrency(amount)}: ${vendorList}`;
        }

        if (amount && (lowerQ.includes('more than') || lowerQ.includes('above') || lowerQ.includes('over') || lowerQ.includes('greater') || lowerQ.includes('>'))) {
            const filtered = invoices.filter(inv => inv.total > amount);
            if (filtered.length === 0) {
                return `No invoices above ${FormatUtils.formatCurrency(amount)}.`;
            }
            const vendorList = filtered.map(inv => `${inv.vendor} (${FormatUtils.formatCurrency(inv.total)})`).join(', ');
            return `Vendors with invoices above ${FormatUtils.formatCurrency(amount)}: ${vendorList}`;
        }

        if (lowerQ.includes('vendor') || lowerQ.includes('company') || lowerQ.includes('supplier')) {
            if (lowerQ.includes('count') || lowerQ.includes('how many')) {
                const uniqueVendors = [...new Set(invoices.map(inv => inv.vendor))];
                return `There are ${uniqueVendors.length} unique vendors: ${uniqueVendors.join(', ')}`;
            }

            const vendorStats = {};
            invoices.forEach(inv => {
                if (!vendorStats[inv.vendor]) {
                    vendorStats[inv.vendor] = { count: 0, total: 0 };
                }
                vendorStats[inv.vendor].count++;
                vendorStats[inv.vendor].total += inv.total;
            });

            const vendorList = Object.entries(vendorStats)
                .map(([vendor, stats]) => `${vendor}: ${stats.count} invoices, ${FormatUtils.formatCurrency(stats.total)}`)
                .join('; ');

            return `Vendor breakdown: ${vendorList}`;
        }

        if (lowerQ.includes('due') && (lowerQ.includes('next') || lowerQ.includes('upcoming'))) {
            const days = this.extractNumber(question) || 30;
            const upcomingInvoices = invoices.filter(inv => {
                const daysUntilDue = inv.getDaysUntilDue();
                return daysUntilDue >= 0 && daysUntilDue <= days;
            });

            if (upcomingInvoices.length === 0) {
                return `No invoices are due in the next ${days} days.`;
            }

            const total = upcomingInvoices.reduce((sum, inv) => sum + inv.total, 0);
            return `${upcomingInvoices.length} invoices due in next ${days} days: ${upcomingInvoices.map(inv => `${inv.vendor} (${FormatUtils.formatCurrency(inv.total)})`).join(', ')}. Total: ${FormatUtils.formatCurrency(total)}`;
        }

        if (lowerQ.includes('average') || lowerQ.includes('mean')) {
            const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
            const average = total / invoices.length;
            return `Average invoice value: ${FormatUtils.formatCurrency(average)}`;
        }

        if (lowerQ.includes('statistics') || lowerQ.includes('stats') || lowerQ.includes('summary')) {
            return this.getDetailedStatistics(invoices);
        }

        const specificVendor = this.findVendorInQuestion(question, invoices);
        if (specificVendor) {
            const vendorInvoices = invoices.filter(inv => 
                inv.vendor.toLowerCase().includes(specificVendor.toLowerCase())
            );
            const total = vendorInvoices.reduce((sum, inv) => sum + inv.total, 0);
            return `${specificVendor}: ${vendorInvoices.length} invoices totaling ${FormatUtils.formatCurrency(total)}. Invoices: ${vendorInvoices.map(inv => `${inv.invoice_number} (${FormatUtils.formatCurrency(inv.total)})`).join(', ')}`;
        }

        return "I cannot find that specific information in the current invoices. Please ask about invoice totals, vendors, due dates, amounts, or statistics.";
    }

    getDetailedStatistics(invoices) {
        const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
        const average = total / invoices.length;
        const vendors = [...new Set(invoices.map(inv => inv.vendor))];
        const overdue = invoices.filter(inv => inv.isOverdue());
        const onTime = invoices.filter(inv => !inv.isOverdue());
        const highest = Math.max(...invoices.map(inv => inv.total));
        const lowest = Math.min(...invoices.map(inv => inv.total));

        return `Invoice Statistics:
            Total Invoices: ${invoices.length}
            Total Value: ${FormatUtils.formatCurrency(total)}
            Average Value: ${FormatUtils.formatCurrency(average)}
            Unique Vendors: ${vendors.length}
            On Time: ${onTime.length}
            Overdue: ${overdue.length}
            Highest Invoice: ${FormatUtils.formatCurrency(highest)}
            Lowest Invoice: ${FormatUtils.formatCurrency(lowest)}

            Vendors: ${vendors.join(', ')}`;
    }

    buildDetailedContext(invoices) {
        if (invoices.length === 0) return 'No invoices available.';

        const invoiceDetails = invoices.map(inv => {
            return `Invoice ${inv.invoice_number}: ${inv.vendor}, Amount: ${FormatUtils.formatCurrency(inv.total)}, Date: ${inv.invoice_date}, Due: ${inv.due_date}, Status: ${inv.isOverdue() ? 'Overdue' : 'On Time'}`;
        }).join('\n');

        const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
        const vendors = [...new Set(invoices.map(inv => inv.vendor))];
        const overdue = invoices.filter(inv => inv.isOverdue()).length;
        const onTime = invoices.filter(inv => !inv.isOverdue()).length;

        return `INVOICE DATA:
            Total Invoices: ${invoices.length}
            Total Value: ${FormatUtils.formatCurrency(total)}
            Vendors: ${vendors.join(', ')}
            On Time: ${onTime}
            Overdue: ${overdue}

            DETAILED INVOICES:
            ${invoiceDetails}`;
    }

    findVendorInQuestion(question, invoices) {
        const vendors = [...new Set(invoices.map(inv => inv.vendor))];
        const lowerQ = question.toLowerCase();

        for (const vendor of vendors) {
            const vendorWords = vendor.toLowerCase().split(' ');
            for (const word of vendorWords) {
                if (word.length > 3 && lowerQ.includes(word)) {
                    return vendor;
                }
            }
        }
        return null;
    }

    extractAmount(text) {
        const patterns = [
            /less than\s*(\d+)/i,
            /below\s*(\d+)/i,
            /under\s*(\d+)/i,
            /above\s*(\d+)/i,
            /over\s*(\d+)/i,
            /more than\s*(\d+)/i,
            /greater than\s*(\d+)/i,
            /<\s*(\d+)/,
            />\s*(\d+)/,
            /(\d+)/
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return parseFloat(match[1]);
            }
        }
        return null;
    }

    extractNumber(text) {
        const match = text.match(/(\d+)/);
        return match ? parseInt(match[1]) : null;
    }
}

export default new GroqService();