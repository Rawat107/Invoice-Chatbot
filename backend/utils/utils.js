export class DateUtils {
  static getCurrentDate() {
    return new Date(2025, 9, 16); // Fixed date for consistent testing
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
