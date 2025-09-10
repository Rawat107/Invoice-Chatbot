// app.js

// Main JavaScript for Invoice Chatbot frontend
const API_BASE = window.ENV.API_BASE_URL || "http://localhost:3000/api";

class InvoiceChatbot {
    constructor() {
        this.invoices = [];
        this.isProcessing = false;
        this.responseLimit = 10;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadInvoices();
        console.log(' Invoice Chatbot initialized - Ready for any question!');
    }

    bindEvents() {
        document.getElementById('sendBtn')?.addEventListener('click', () => this.handleChatMessage());
        document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !this.isProcessing) {
                e.preventDefault();
                this.handleChatMessage();
            }
        });

        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        // File upload handling
        uploadArea?.addEventListener('click', () => {
            console.log('Upload area clicked');
            fileInput?.click();
        });

        fileInput?.addEventListener('change', (e) => {
            console.log('File input changed');
            if (e.target.files[0]) {
                this.handleFileUpload(e.target.files[0]);
                e.target.value = '';
            }
        });

        // Drag and drop handlers
        uploadArea?.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('border-blue-500', 'bg-blue-50');
        });

        uploadArea?.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('border-blue-500', 'bg-blue-50');
        });

        uploadArea?.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('border-blue-500', 'bg-blue-50');
            if (e.dataTransfer.files[0]) {
                this.handleFileUpload(e.dataTransfer.files[0]);
            }
        });

        document.getElementById('loadSampleBtn')?.addEventListener('click', () => this.loadSampleData());
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.loadInvoices());
    }

    async makeApiCall(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                headers: { 'Content-Type': 'application/json' },
                ...options
            });
            return await response.json();
        } catch (error) {
            console.error(`API call failed for ${endpoint}:`, error);
            throw error;
        }
    }

    async handleFileUpload(file) {
        if (this.isProcessing) return;

        console.log('Starting file upload:', file.name);
        this.setProcessingState(true, 'Processing file upload...');

        const formData = new FormData();
        formData.append('invoice', file);

        try {
            const response = await fetch(`${API_BASE}/invoices/upload`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.showStatus(` File processed: ${result.data.vendor} - ${result.data.formatted_total}`, 'success');
                await this.loadInvoices();
                this.addBotMessage(` File uploaded successfully!\n\nVendor: ${result.data.vendor}\nInvoice: ${result.data.invoice_number}\nAmount: ${result.data.formatted_total}\nDue: ${result.data.due_date}\n\nYou can now ask me any questions about this invoice!`);
            } else {
                this.showStatus(' Error processing file: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showStatus(' Upload failed: ' + error.message, 'error');
        } finally {
            this.setProcessingState(false);
        }
    }

    async deleteInvoice(invoiceId) {
        if (!confirm('Are you sure you want to delete this invoice?')) {
            return;
        }

        try {
            const result = await this.makeApiCall(`/invoices/${invoiceId}`, {
                method: 'DELETE'
            });

            if (result.success) {
                this.showStatus(' Invoice deleted successfully', 'success');
                await this.loadInvoices();
                this.addBotMessage(' Invoice has been deleted.');
            } else {
                this.showStatus(' Failed to delete invoice: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Delete error:', error);
            this.showStatus(' Delete failed: ' + error.message, 'error');
        }
    }

    async loadSampleData() {
        if (this.isProcessing) return;

        this.setProcessingState(true, 'Loading sample data...');

        try {
            const result = await this.makeApiCall('/invoices/sample', { method: 'POST' });

            if (result.success) {
                this.showStatus(` Sample data loaded: ${result.data.length} invoices`, 'success');
                await this.loadInvoices();
                const total = result.data.reduce((sum, inv) => sum + inv.total, 0);
                this.addBotMessage(` Sample data loaded successfully!\n\nLoaded ${result.data.length} professional invoices:\n• Amazon Web Services: $2,450.00\n• Microsoft Corporation: $3,100.00\n• Google LLC: $1,850.00\n• Apple Inc.: $4,200.00\n• Tesla Inc.: $1,500.00\n\nTotal Value: $${total.toFixed(2)}\n\nNow you can ask me ANY questions about these invoices!`);
            } else {
                this.showStatus(' Failed to load sample data', 'error');
            }
        } catch (error) {
            console.error('Sample data error:', error);
            this.showStatus(' Error loading sample data: ' + error.message, 'error');
        } finally {
            this.setProcessingState(false);
        }
    }

    async handleChatMessage() {
        if (this.isProcessing) return;

        const chatInput = document.getElementById('chatInput');
        const message = chatInput?.value?.trim();

        if (!message) return;

        this.addUserMessage(message);
        chatInput.value = '';

        this.setProcessingState(true);
        this.showTypingIndicator(true);

        try {
            const result = await this.makeApiCall('/chat', {
                method: 'POST',
                body: JSON.stringify({ question: message })
            });

            setTimeout(() => {
                this.showTypingIndicator(false);
                if (result.success && result.data?.response) {
                    this.addBotMessage(result.data.response);
                } else {
                    this.addBotMessage('Sorry, I encountered an error processing your question. Please try again.');
                }
                this.setProcessingState(false);
            }, 800);

        } catch (error) {
            console.error('Chat error:', error);
            this.showTypingIndicator(false);
            this.addBotMessage('I encountered an error processing your question. Please try again.');
            this.setProcessingState(false);
        }
    }

    async loadInvoices() {
        try {
            const invoices = await this.makeApiCall('/invoices');
            this.invoices = invoices;
            this.updateUI();
        } catch (error) {
            console.error('Error loading invoices:', error);
        }
    }

    updateUI() {
        this.updateInvoicesList();
        this.updateHeaderStats();
    }

    // INVOICE LIST WITH DELETE BUTTON IN TOP LEFT
    updateInvoicesList() {
        const invoicesList = document.getElementById('invoicesList');
        if (!invoicesList) return;

        if (this.invoices.length === 0) {
            invoicesList.innerHTML = `
                <div class="p-8 text-center text-gray-500">
                    <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <p class="text-sm font-medium text-gray-700">No invoices loaded</p>
                    <p class="text-xs text-gray-500 mt-2">Upload files or load sample data</p>
                </div>
            `;
            return;
        }

        invoicesList.innerHTML = this.invoices.map(invoice => {
            const statusInfo = this.getInvoiceStatus(invoice);
            return `
                <div class="relative px-6 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                    <!-- DELETE BUTTON - Top Left X -->
                    <button 
                        onclick="window.invoiceChatbot?.deleteInvoice('${invoice.id}')"
                        class="absolute top-2 left-2 w-6 h-6 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full flex items-center justify-center transition-colors z-10"
                        title="Delete invoice"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>

                    <!-- INVOICE CONTENT - Left padding for delete button -->
                    <div class="pl-8">
                        <div class="flex items-center justify-between">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-semibold text-gray-900 truncate">${this.escapeHtml(invoice.vendor)}</p>
                                <div class="flex items-center mt-2 space-x-3">
                                    <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">${this.escapeHtml(invoice.invoice_number)}</span>
                                    <span class="text-xs px-2 py-1 rounded border ${statusInfo.class}">${statusInfo.text}</span>
                                </div>
                                <p class="text-xs text-gray-500 mt-2">Due: ${invoice.due_date}</p>
                                ${invoice.items && invoice.items.length > 0 ? 
                                    `<p class="text-xs text-gray-400 mt-1">Items: ${invoice.items.slice(0, 2).join(', ')}${invoice.items.length > 2 ? '...' : ''}</p>` : 
                                    ''
                                }
                            </div>
                            <div class="text-right ml-4">
                                <p class="text-lg font-bold text-gray-900">${invoice.formatted_total}</p>
                                <p class="text-xs text-gray-500">Invoice Total</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    getInvoiceStatus(invoice) {
        if (invoice.is_overdue) {
            return { class: 'bg-red-50 text-red-700 border-red-200', text: 'Overdue' };
        }

        if (invoice.due_date === 'Completed' || !invoice.days_until_due || invoice.days_until_due === null || isNaN(invoice.days_until_due)) {
            return { class: 'bg-green-50 text-green-700 border-green-200', text: 'On time' };
        }

        if (invoice.days_until_due <= 7 && invoice.days_until_due >= 0) {
            return { class: 'bg-yellow-50 text-yellow-700 border-yellow-200', text: `Due in ${invoice.days_until_due}d` };
        }

        return { class: 'bg-green-50 text-green-700 border-green-200', text: 'On time' };
    }

    updateHeaderStats() {
        const total = this.invoices.reduce((sum, inv) => sum + inv.total, 0);
        const overdue = this.invoices.filter(inv => inv.is_overdue).length;

        this.updateElement('headerInvoiceCount', this.invoices.length);
        this.updateElement('headerTotalValue', `$${total.toFixed(2)}`);
        this.updateElement('overdueCount', overdue);
    }

    updateElement(id, content) {
        const element = document.getElementById(id);
        if (element) element.textContent = content;
    }

    addUserMessage(message) { this.addMessage(message, true); }
    addBotMessage(message) { this.addMessage(message, false); }

    addMessage(message, isUser = false) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `flex message-enter ${isUser ? 'justify-end' : 'justify-start'} mb-3`;

        const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const bubbleColor = isUser ? 'bg-gray-600 text-white' : 'bg-white border border-gray-200 text-gray-800';
        const avatarColor = isUser ? 'bg-gray-600' : 'bg-blue-600';
        const label = isUser ? 'You' : 'AI';

        messageDiv.innerHTML = `
            <div class="flex items-start space-x-2 max-w-lg ${isUser ? 'flex-row-reverse space-x-reverse' : ''}">
                <div class="flex-shrink-0">
                    <div class="w-8 h-8 ${avatarColor} rounded-full flex items-center justify-center shadow-sm">
                        <span class="text-white text-xs font-medium">${label}</span>
                    </div>
                </div>
                <div>
                    <div class="flex items-center space-x-2 mb-1 ${isUser ? 'justify-end' : ''}">
                        <span class="text-xs text-gray-500">${timestamp}</span>
                    </div>
                    <div class="${bubbleColor} rounded-lg px-3 py-2 shadow-sm">
                        <p class="text-sm whitespace-pre-wrap">${this.escapeHtml(message)}</p>
                    </div>
                </div>
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        this.scrollChatToBottom();
    }

    setProcessingState(isProcessing, statusMessage = '') {
        this.isProcessing = isProcessing;

        const sendBtn = document.getElementById('sendBtn');
        const chatInput = document.getElementById('chatInput');
        const fileInput = document.getElementById('fileInput');

        [sendBtn].forEach(btn => {
            if (btn) {
                btn.disabled = isProcessing;
                if (isProcessing && btn === sendBtn) {
                    btn.innerHTML = '<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>';
                } else if (!isProcessing && btn === sendBtn) {
                    btn.innerHTML = '<span class="hidden sm:inline">Send</span><svg class="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>';
                }
            }
        });

        if (chatInput) chatInput.disabled = isProcessing;
        if (fileInput) fileInput.disabled = isProcessing;

        if (statusMessage) this.showStatus(statusMessage, 'info');
    }

    scrollChatToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            requestAnimationFrame(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });
        }
    }

    showTypingIndicator(show) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const existingTyping = document.getElementById('typingIndicator');

        if (show && !existingTyping) {
            const typingDiv = document.createElement('div');
            typingDiv.id = 'typingIndicator';
            typingDiv.className = 'flex space-x-3';
            typingDiv.innerHTML = `
                <div class="flex-shrink-0">
                    <div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                        <span class="text-white text-sm font-medium">AI</span>
                    </div>
                </div>
                <div class="flex-1">
                    <div class="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
                        <div class="flex space-x-1">
                            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                        </div>
                    </div>
                </div>
            `;
            chatMessages.appendChild(typingDiv);
            this.scrollChatToBottom();
        } else if (!show && existingTyping) {
            existingTyping.remove();
        }
    }

    showStatus(message, type) {
        const statusDiv = document.getElementById('uploadStatus');
        if (!statusDiv) return;

        const colorMap = {
            success: 'bg-green-50 text-green-800 border-green-200',
            error: 'bg-red-50 text-red-800 border-red-200',
            info: 'bg-blue-50 text-blue-800 border-blue-200'
        };

        statusDiv.className = `mt-4 p-4 rounded-lg border ${colorMap[type] || colorMap.info}`;
        statusDiv.innerHTML = `<p class="text-sm font-medium">${this.escapeHtml(message)}</p>`;
        statusDiv.classList.remove('hidden');

        setTimeout(() => statusDiv.classList.add('hidden'), 6000);
    }

    escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }
}

// Make instance globally available for delete buttons
document.addEventListener('DOMContentLoaded', () => {
    const chatbot = new InvoiceChatbot();
    window.invoiceChatbot = chatbot;
});