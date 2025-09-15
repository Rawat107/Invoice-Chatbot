import dotenv from 'dotenv';
dotenv.config();

// Service to interact with OpenAI API for invoice analysis
class OpenAiService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseUrl = 'https://api.openai.com/v1/chat/completions';
    this.model = 'gpt-4o-mini';

    if (!this.apiKey) {
      console.warn('WARNING: OPENAI_API_KEY not found in environment variables');
    }
  }

  async processQuestion(question, invoices) {
    console.log(`Processing question: "${question}"`);

    if (invoices.length === 0) {
      return 'No invoices loaded. Please upload some first.';
    }

    if (!this.apiKey) {
      return this.processWithLocalFallback(question, invoices);
    }

    try {
      return await this.processWithOpenAI(question, invoices);
    } catch (error) {
      console.error('OpenAI error:', error.message);
      return this.processWithLocalFallback(question, invoices);
    }
  }

  // This method prepares the invoice data and interacts with OpenAI's function-calling feature
  async processWithOpenAI(question, invoices) {
    const invoiceData = this.prepareInvoiceData(invoices);

    const functions = [
      {
        name: "analyzeInvoices",
        description: "Analyze invoice data for any question about totals, amounts, due dates, vendors, overdue status, on-time status, or any other invoice analysis.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The specific question being asked"
            },
            analysis_type: {
              type: "string",
              description: "Type of analysis: total_calculation, highest_amount, lowest_amount, farthest_due_date, on_time_invoices, overdue_analysis, vendor_analysis, custom_analysis"
            }
          },
          required: ["query", "analysis_type"]
        }
      }
    ];

    const messages = [
      {
        role: "system",
        content: `You are an invoice analysis assistant. You have access to complete invoice data and must ALWAYS call the analyzeInvoices function to get accurate information.

CRITICAL RULES:
- ALWAYS use the analyzeInvoices function for ANY invoice question
- NEVER provide answers without calling the function first
- Be specific with numbers, vendor names, and dates
- No generic responses

INVOICE DATA:
${JSON.stringify(invoiceData, null, 2)}`
      },
      {
        role: "user",
        content: question
      }
    ];

    const requestBody = {
      model: this.model,
      messages: messages,
      functions: functions,
      function_call: "auto",
      temperature: 0.1
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    if (message.function_call) {
      const functionName = message.function_call.name;
      const functionArgs = JSON.parse(message.function_call.arguments);

      console.log(`Calling function: ${functionName}`);
      const functionResult = this.executeFunction(functionName, functionArgs, invoices);

      const followUpMessages = [
        ...messages,
        message,
        {
          role: "function",
          name: functionName,
          content: JSON.stringify(functionResult)
        }
      ];

      const followUpResponse = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: followUpMessages,
          temperature: 0.1
        })
      });

      const followUpData = await followUpResponse.json();
      return followUpData.choices[0].message.content;
    }

    return message.content;
  }

  executeFunction(functionName, args, invoices) {
    if (functionName === "analyzeInvoices") {
      return this.performAnalysis(args, invoices);
    }
    return { error: "Unknown function" };
  }

  performAnalysis(args, invoices) {
    const query = args.query.toLowerCase();

    const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const count = invoices.length;
    const average = total / count;

    const overdue = invoices.filter(inv => inv.isOverdue());
    const onTime = invoices.filter(inv => !inv.isOverdue());

    const highest = invoices.reduce((max, inv) => inv.total > max.total ? inv : max);
    const lowest = invoices.reduce((min, inv) => inv.total < min.total ? inv : min);

    const validDueDates = invoices.filter(inv => inv.due_date && inv.due_date !== 'Completed');
    const farthestDue = validDueDates.length > 0
      ? validDueDates.reduce((latest, inv) =>
          new Date(inv.due_date) > new Date(latest.due_date) ? inv : latest)
      : null;

    const vendorTotals = {};
    invoices.forEach(inv => {
      vendorTotals[inv.vendor] = (vendorTotals[inv.vendor] || 0) + inv.total;
    });

    const sortedVendors = Object.entries(vendorTotals)
      .sort(([,a], [,b]) => b - a)
      .map(([vendor, total]) => ({ vendor, total, formatted: `$${total.toFixed(2)}` }));

    return {
      query: args.query,
      analysis_type: args.analysis_type,

      totals: {
        count: count,
        total_value: `$${total.toFixed(2)}`,
        raw_total: total,
        average: `$${average.toFixed(2)}`,
        raw_average: average
      },

      amounts: {
        highest: {
          vendor: highest.vendor,
          amount: `$${highest.total.toFixed(2)}`,
          invoice_number: highest.invoice_number,
          due_date: highest.due_date
        },
        lowest: {
          vendor: lowest.vendor,
          amount: `$${lowest.total.toFixed(2)}`,
          invoice_number: lowest.invoice_number,
          due_date: lowest.due_date
        }
      },

      due_dates: {
        farthest_due: farthestDue ? {
          vendor: farthestDue.vendor,
          due_date: farthestDue.due_date,
          amount: `$${farthestDue.total.toFixed(2)}`,
          invoice_number: farthestDue.invoice_number,
          days_until_due: farthestDue.getDaysUntilDue()
        } : null
      },

      status: {
        overdue_count: overdue.length,
        on_time_count: onTime.length,
        overdue_total: `$${overdue.reduce((sum, inv) => sum + inv.total, 0).toFixed(2)}`,
        on_time_total: `$${onTime.reduce((sum, inv) => sum + inv.total, 0).toFixed(2)}`,

        overdue_invoices: overdue.map(inv => ({
          vendor: inv.vendor,
          amount: `$${inv.total.toFixed(2)}`,
          due_date: inv.due_date,
          days_overdue: Math.abs(inv.getDaysUntilDue())
        })),

        on_time_invoices: onTime.map(inv => ({
          vendor: inv.vendor,
          amount: `$${inv.total.toFixed(2)}`,
          due_date: inv.due_date,
          days_until_due: inv.getDaysUntilDue()
        }))
      },

      vendors: {
        breakdown: sortedVendors,
        highest_vendor: sortedVendors[0]
      }
    };
  }

  prepareInvoiceData(invoices) {
    return invoices.map(inv => ({
      id: inv.id,
      vendor: inv.vendor,
      invoice_number: inv.invoice_number,
      total: inv.total,
      formatted_total: `$${inv.total.toFixed(2)}`,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      items: inv.items,
      is_overdue: inv.isOverdue(),
      days_until_due: inv.getDaysUntilDue()
    }));
  }

  processWithLocalFallback(question, invoices) {
    console.log('Using local fallback...');

    const lowerQ = question.toLowerCase();

    if (lowerQ.includes('total') && (lowerQ.includes('all') || lowerQ.includes('invoice'))) {
      const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
      return `Total value of all invoices: $${total.toFixed(2)} across ${invoices.length} invoices\n\nBreakdown:\n${invoices.map(inv => `• ${inv.vendor}: $${inv.total.toFixed(2)}`).join('\n')}`;
    }

    if (lowerQ.includes('highest') || lowerQ.includes('maximum') || lowerQ.includes('largest')) {
      const highest = invoices.reduce((max, inv) => inv.total > max.total ? inv : max);
      return `Highest invoice: ${highest.vendor} with $${highest.total.toFixed(2)}\n\nDetails:\n• Invoice Number: ${highest.invoice_number}\n• Due Date: ${highest.due_date}`;
    }

    if ((lowerQ.includes('farthest') || lowerQ.includes('latest') || lowerQ.includes('furthest')) && lowerQ.includes('due')) {
      const validDueDates = invoices.filter(inv => inv.due_date && inv.due_date !== 'Completed');
      if (validDueDates.length > 0) {
        const latest = validDueDates.reduce((latest, inv) =>
          new Date(inv.due_date) > new Date(latest.due_date) ? inv : latest);
        return `Invoice with farthest due date: ${latest.vendor} on ${latest.due_date}\n\nDetails:\n• Amount: $${latest.total.toFixed(2)}\n• Invoice Number: ${latest.invoice_number}\n• Days Until Due: ${latest.getDaysUntilDue()} days`;
      }
      return 'No future due dates found.';
    }

    if ((lowerQ.includes('on time') || lowerQ.includes('still on time')) && (lowerQ.includes('list') || lowerQ.includes('how many'))) {
      const onTime = invoices.filter(inv => !inv.isOverdue());
      if (onTime.length === 0) return 'All invoices are currently overdue.';

      return `Invoices that are on time (${onTime.length} total):\n\n${onTime.map(inv => `• ${inv.vendor}: $${inv.total.toFixed(2)} (Due: ${inv.due_date})`).join('\n')}\n\nTotal on-time value: $${onTime.reduce((sum, inv) => sum + inv.total, 0).toFixed(2)}`;
    }

    if (lowerQ.includes('how many') && lowerQ.includes('overdue')) {
      const overdue = invoices.filter(inv => inv.isOverdue());
      if (overdue.length === 0) return 'No invoices are overdue.';

      return `${overdue.length} invoices are overdue:\n\n${overdue.map(inv => `• ${inv.vendor}: $${inv.total.toFixed(2)} (${Math.abs(inv.getDaysUntilDue())} days overdue)`).join('\n')}\n\nTotal overdue: $${overdue.reduce((sum, inv) => sum + inv.total, 0).toFixed(2)}`;
    }

    const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const overdue = invoices.filter(inv => inv.isOverdue()).length;
    const onTime = invoices.filter(inv => !inv.isOverdue()).length;

    return `I have ${invoices.length} invoices totaling $${total.toFixed(2)}.\n\nOverdue: ${overdue} invoices\nOn-time: ${onTime} invoices\n\nAsk me about specific details, due dates, or vendor analysis.`;
  }
}

export default new OpenAiService();
