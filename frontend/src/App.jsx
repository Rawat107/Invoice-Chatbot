import { useState, useEffect } from 'react'
import ChatBox from './components/ChatBox'
import InvoiceList from './components/InvoiceList'
import UploadPanel from './components/UploadPanel'
import StatsBar from './components/StatsBar'
import { invoiceApi } from './lib/api'

function App() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load invoices on mount
  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await invoiceApi.getAll()
      setInvoices(data || [])
    } catch (err) {
      console.error('Failed to load invoices:', err)
      setError('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  const handleInvoiceUploaded = (newInvoice) => {
    setInvoices(prev => [...prev, newInvoice])
  }

  const handleInvoiceDeleted = (deletedId) => {
    setInvoices(prev => prev.filter(inv => inv.id !== deletedId))
  }

  const handleSampleDataLoaded = (sampleInvoices) => {
    setInvoices(sampleInvoices)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                AI Invoice Assistant
              </h1>
              <p className="text-sm text-gray-600">
                AI-first analysis with complete function calling capabilities
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={loadInvoices}
                disabled={loading}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <StatsBar invoices={invoices} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Upload and Invoices */}
          <div className="lg:col-span-1 space-y-6">
            <UploadPanel 
              onInvoiceUploaded={handleInvoiceUploaded}
              onSampleDataLoaded={handleSampleDataLoaded}
              loading={loading}
            />
            <InvoiceList 
              invoices={invoices}
              loading={loading}
              error={error}
              onInvoiceDeleted={handleInvoiceDeleted}
              onRefresh={loadInvoices}
            />
          </div>

          {/* Right Column - Chat */}
          <div className="lg:col-span-2">
            <ChatBox invoicesCount={invoices.length} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>Ai Invoice Assistant • Function Calling Enabled • Provider Agnostic</p>
            <p className="mt-2">
              Ask me anything about your invoices: totals, highest amounts, farthest due dates, vendor comparisons, trends, and more!
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
