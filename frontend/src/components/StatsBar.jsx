export default function StatsBar({ invoices }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const calculateStats = () => {
    if (!invoices || invoices.length === 0) {
      return {
        total: 0,
        count: 0,
        overdue: 0,
        onTime: 0,
        average: 0
      }
    }

    const total = invoices.reduce((sum, inv) => sum + parseFloat(inv.total || inv.raw_amount || 0), 0)
    const overdue = invoices.filter(inv => inv.is_overdue).length
    const onTime = invoices.length - overdue
    const average = total / invoices.length

    return {
      total,
      count: invoices.length,
      overdue,
      onTime,
      average
    }
  }

  const stats = calculateStats()

  if (stats.count === 0) {
    return null // Don't show stats bar when no invoices
  }

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Total Value */}
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats.total)}
            </div>
            <div className="text-sm text-gray-600">Total Value</div>
          </div>

          {/* Invoice Count */}
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {stats.count}
            </div>
            <div className="text-sm text-gray-600">Total Invoices</div>
          </div>

          {/* Average */}
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.average)}
            </div>
            <div className="text-sm text-gray-600">Average</div>
          </div>

          {/* On Time */}
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {stats.onTime}
            </div>
            <div className="text-sm text-gray-600">On Time</div>
          </div>

          {/* Overdue */}
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {stats.overdue}
            </div>
            <div className="text-sm text-gray-600">Overdue</div>
          </div>
        </div>

        {/* Progress Bar */}
        {stats.count > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Payment Status</span>
              <span>{Math.round((stats.onTime / stats.count) * 100)}% on time</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(stats.onTime / stats.count) * 100}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
