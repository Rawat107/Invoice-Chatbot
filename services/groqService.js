import groq from 'groq-sdk';


class GroqService {
  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
    this.isConfigured = !!process.env.GROQ_API_KEY;
  }

  async generateResponse(prompt, context = '') {
    if (!this.isConfigured) {
      throw new Error('Groq API key not configured');
    }

    try {
      const systemPrompt = `You are an intelligent invoice assistant. You can answer questions about invoices including:
      - Due dates and upcoming invoices
      - Vendor information and totals  
      - Invoice filtering by amount, date, vendor
      - Summary statistics
      - General invoice management questions

      Current date: ${new Date().toISOString().split('T')[0]}

      Available invoice data:
      ${context}

      Respond in a helpful, concise manner. If asked about non-invoice topics, politely redirect to invoice-related questions.`;

      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        model: "mixtral-8x7b-32768",
        temperature: 0.1,
        max_tokens: 1000
      });

      return completion.choices[0]?.message?.content || "I couldn't process your request.";
    } catch (error) {
      console.error('Groq API error:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      await this.generateResponse("Hello", "Test data");
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default new GroqService();