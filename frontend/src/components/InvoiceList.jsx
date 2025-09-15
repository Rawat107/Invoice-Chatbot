import { useState } from 'react'
import { invoiceApi } from '../lib/api'

export default function InvoiceList({ invoices, loading, error, onInvoiceDeleted, onRefresh }) {
  const [deletingId, setDeletingId] = useState(null)

  const handleDelete = async (invoice) => {
    // Prevent multiple deletions
    if (deletingId) return

    if (!confirm(`Delete invoice from ${invoice.vendor}?`)) return

    try {
      console.log(`Deleting invoice: ${invoice.vendor} (${invoice.id})`)
      setDeletingId(invoice.id)

      await invoiceApi.delete(invoice.id)
      console.log(`Successfully deleted: ${invoice.id}`)

      onInvoiceDeleted(invoice.id)
    } catch (err) {
      console.error('Delete failed:', err)
      alert(`Delete failed: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const formatCurrency = (amount) => {
    if (typeof amount === 'string' && amount.startsWith('$')) {
      return amount
    }
    return `$${parseFloat(amount || 0).toFixed(2)}`
  }

  const getStatusBadge = (invoice) => {
    if (invoice.is_overdue) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Overdue
        </span>
      )
    }

    if (invoice.due_date === 'Completed') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Completed  
        </span>
      )
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        On Time
      </span>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Current Invoices</h3>
        </div>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading invoices...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">
          Current Invoices ({invoices.length})
        </h3>
        <button
          onClick={onRefresh}
          className="text-sm text-gray-500 hover:text-gray-700"
          title="Refresh"
        >
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-100">
            <p className="text-sm text-red-600">Error: {error}</p>
          </div>
        )}

        {invoices.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 text-4xl mb-4">📄</div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No invoices loaded</h4>
            <p className="text-gray-600 mb-4">Upload files or load sample data to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {invoices.map((invoice, index) => {
              // Use index as primary key since it's guaranteed unique for this render
              // Combined with vendor and amount for additional uniqueness
              const reactKey = `invoice-${index}-${invoice.vendor?.replace(/\s+/g, '-') || 'unknown'}-${invoice.total || 0}`;

              return (
                <div key={reactKey} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-gray-900 truncate">
                          {invoice.vendor || 'Unknown Vendor'}
                        </h4>
                        {getStatusBadge(invoice)}
                      </div>

                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Invoice:</span>
                          <span className="font-mono">{invoice.invoice_number}</span>
                        </div>

                        <div className="flex justify-between">
                          <span>Amount:</span>
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(invoice.formatted_total || invoice.total)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span>Due:</span>
                          <span>{invoice.due_date}</span>
                        </div>

                        {invoice.days_until_due !== undefined && invoice.due_date !== 'Completed' && (
                          <div className="flex justify-between">
                            <span>Days:</span>
                            <span className={
                              invoice.is_overdue 
                                ? 'text-red-600 font-medium' 
                                : invoice.days_until_due <= 7 
                                  ? 'text-yellow-600 font-medium'
                                  : 'text-green-600'
                            }>
                              {invoice.is_overdue 
                                ? `${Math.abs(invoice.days_until_due)} overdue`
                                : `${invoice.days_until_due} remaining`
                              }
                            </span>
                          </div>
                        )}
                      </div>

                      {invoice.items && invoice.items.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          Items: {invoice.items.slice(0, 2).join(', ')}
                          {invoice.items.length > 2 && '...'}
                        </div>
                      )}
                    </div>

                    <div className="ml-4">
                      <button
                        onClick={() => handleDelete(invoice)}
                        disabled={deletingId === invoice.id}
                        className="text-red-400 hover:text-red-600 disabled:opacity-50 p-1"
                        title={`Delete invoice from ${invoice.vendor}`}
                      >
                        {deletingId === invoice.id ? (
                          <div className="w-4 h-4 animate-spin border border-red-400 border-t-transparent rounded-full"></div>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
