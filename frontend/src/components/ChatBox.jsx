import { useState, useRef, useEffect } from 'react'
import { chatApi } from '../lib/api'

export default function ChatBox({ invoicesCount }) {
  const [messages, setMessages] = useState([
    {
      type: 'bot',
      content: `Hello! I'm your AI invoice assistant.

            **I can help you with:**
            • Total calculations and summaries
            • Finding highest/lowest amounts  
            • Overdue invoice analysis
            • Any other invoice-related questions

${invoicesCount > 0 ? `You have ${invoicesCount} invoices loaded. Try asking: "Which invoice has the highest value?" or "Total value of all invoices?"` : 'Upload some invoices or load sample data to get started!'}`,
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const question = input.trim()
    if (!question || loading) return

    // Add user message
    const userMessage = {
      type: 'user',
      content: question,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const response = await chatApi.askQuestion(question)

      // Add bot response
      const botMessage = {
        type: 'bot',
        content: response?.response || 'Sorry, I couldn\'t process that question.',
        timestamp: new Date(),
        trace: response?.trace
      }

      setMessages(prev => [...prev, botMessage])
    } catch (err) {
      console.error('Chat error:', err)
      setError(err.message)

      // Add error message
      const errorMessage = {
        type: 'bot',
        content: `Sorry, I encountered an error: ${err.message}. Please try again.`,
        timestamp: new Date(),
        isError: true
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const clearChat = () => {
    setMessages([{
      type: 'bot',
      content: `Chat cleared! I'm ready to help you analyze your ${invoicesCount} invoices. What would you like to know?`,
      timestamp: new Date()
    }])
    setError(null)
  }

  const formatMessage = (content) => {
    // Convert markdown-style bold to HTML
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
  }

  const exampleQuestions = [
    "Total Value of all invoices?",
    "Which invoice has the highest value?",
    "Which invoice has the latest due date?",
    "How many invoices are due in the next 7 days?",
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[600px] flex flex-col">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-gray-900">AI Assistant</h3>
          <p className="text-xs text-gray-500">
            Analysis • {invoicesCount} invoices loaded
          </p>
        </div>
        <button
          onClick={clearChat}
          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Clear Chat
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3xl rounded-lg p-3 ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.isError
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-gray-50 text-gray-900 border border-gray-200'
              }`}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: formatMessage(message.content)
                }}
              />
              <div className="text-xs opacity-75 mt-2">
                {message.timestamp.toLocaleTimeString()}
                {message.trace && (
                  <span className="ml-2">• {message.trace.provider}</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-gray-600">AI is analyzing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Example Questions */}
      {messages.length === 1 && invoicesCount > 0 && (
        <div className="px-4 py-2 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {exampleQuestions.slice(0, 4).map((question, index) => (
              <button
                key={index}
                onClick={() => setInput(question)}
                className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={
              invoicesCount > 0 
                ? "Ask me anything about your invoices..." 
                : "Upload invoices first, then ask me anything!"
            }
            disabled={loading}
                className="border flex-1 rounded-md border-blue-300 shadow-sm focus:border-indigo-700 focus:outline-none focus:ring-0 disabled:bg-gray-100 p-2"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>

        {error && (
          <div className="mt-2 text-sm text-red-600">
            Error: {error}
          </div>
        )}
      </form>
    </div>
  )
}
