import { useState, useRef } from 'react'
import { invoiceApi } from '../lib/api'

export default function UploadPanel({ onInvoiceUploaded, onSampleDataLoaded, loading }) {
  const [uploading, setUploading] = useState(false)
  const [loadingSample, setLoadingSample] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const fileInputRef = useRef(null)

  const clearMessages = () => {
    setError(null)
    setSuccess(null)
  }

  const showMessage = (message, isError = false) => {
    clearMessages()
    if (isError) {
      setError(message)
    } else {
      setSuccess(message)
    }
    setTimeout(clearMessages, 5000)
  }

  const handleFileUpload = async (file) => {
    if (!file) return

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      showMessage('Please upload a PDF or image file (JPG, PNG, WEBP)', true)
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      showMessage('File size must be less than 10MB', true)
      return
    }

    try {
      setUploading(true)
      clearMessages()

      const result = await invoiceApi.uploadFile(file)

      showMessage(`File processed: ${result.vendor} - ${result.formatted_total || result.total}`)
      onInvoiceUploaded(result)

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      console.error('Upload failed:', err)
      showMessage(`Upload failed: ${err.message}`, true)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      await handleFileUpload(files[0])
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleLoadSample = async () => {
    try {
      setLoadingSample(true)
      clearMessages()

      const sampleInvoices = await invoiceApi.loadSampleData()

      showMessage(`Sample data loaded: ${sampleInvoices.length} invoices`)
      onSampleDataLoaded(sampleInvoices)
    } catch (err) {
      console.error('Failed to load sample data:', err)
      showMessage(`Failed to load sample data: ${err.message}`, true)
    } finally {
      setLoadingSample(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Upload Invoices</h3>
        <p className="text-sm text-gray-600">Multiple ways to add invoices</p>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* File Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : uploading
              ? 'border-gray-300 bg-gray-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
              <p className="text-gray-600">Processing file...</p>
            </div>
          ) : (
            <div>
              <div className="text-3xl text-gray-400 mb-2">📄</div>
              <h4 className="font-medium text-gray-900 mb-1">Upload Invoice File</h4>
              <p className="text-sm text-gray-600 mb-3">PDF, PNG, JPG up to 10MB</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Choose File
              </button>
              <p className="text-xs text-gray-500 mt-2">or drag & drop here</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>

        {/* Sample Data Button */}
        <div className="text-center">
          <button
            onClick={handleLoadSample}
            disabled={loading || loadingSample}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingSample ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Loading Sample Data...
              </span>
            ) : (
              '🚀 Load Sample Data'
            )}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            5 professional invoices from major vendors
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600"> {error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600"> {success}</p>
          </div>
        )}
      </div>
    </div>
  )
}
