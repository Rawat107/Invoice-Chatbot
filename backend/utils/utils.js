// Shared utilities to make code DRY
export class DateUtils {
    static getCurrentDate() {
        return new Date(2025, 8, 10); // September 10, 2025 (consistent across app)
    }

    static parseDate(dateString) {
        if (!dateString) return new Date();
        const [year, month, day] = dateString.split('-').map(num => parseInt(num));
        return new Date(year, month - 1, day);
    }

    static formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    static getDaysUntilDue(dueDate) {
        const today = this.getCurrentDate();
        const due = this.parseDate(dueDate);
        const diffTime = due - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    static isOverdue(dueDate) {
        return this.getDaysUntilDue(dueDate) < 0;
    }
}

export class FormatUtils {
    static formatCurrency(amount) {
        return `$${parseFloat(amount).toFixed(2)}`;
    }

    static extractAmount(text) {
        const patterns = [
            /₹(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
            /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
            /(\d+(?:,\d{3})*(?:\.\d{2})?)(?=\s*only)/gi,
            /total[:\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
        ];

        for (const pattern of patterns) {
            const matches = text.match(pattern);
            if (matches) {
                const amount = matches[matches.length - 1].replace(/[₹$,]/g, '');
                const numAmount = parseFloat(amount);
                if (numAmount > 0) return numAmount;
            }
        }
        return null;
    }

    static generateHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
}

export class ValidationUtils {
    static isNonInvoiceQuestion(text) {
        const nonInvoiceKeywords = [
            'weather', 'time', 'news', 'sports', 'movie', 'music', 'recipe',
            'health', 'travel', 'joke', 'story', 'game', 'politics', 'hello',
            'how are you', 'what is your name'
        ];
        return nonInvoiceKeywords.some(keyword => text.toLowerCase().includes(keyword));
    }
}

export class ResponseUtils {
    static createErrorResponse(message) {
        return { success: false, error: message };
    }

    static createSuccessResponse(message, data = null) {
        const response = { success: true, message };
        if (data) response.data = data;
        return response;
    }
}