import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { format, subDays, parseISO, isValid } from 'date-fns'
import { ConversionFunnel } from '@/modules/analytics/components/conversion-funnel'
import { RepeatCustomersList } from '@/modules/analytics/components/repeat-customers-list'
import { GlobalDateRangePicker } from '@/modules/analytics/components/global-date-range-picker'
import { QuotesBookingsChart } from '@/modules/analytics/components/quotes-bookings-chart'
import { RevenueChart } from '@/modules/analytics/components/revenue-chart'
import { NewClientsChart } from '@/modules/analytics/components/new-clients-chart'
import { StatTile } from '@/components/ui/stat-tile'

export const metadata: Metadata = {
  title: 'Reports & Analytics | GoMove CRM',
}

export default async function ReportsPage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const searchParams = await props.searchParams
  const supabase = await createClient()

  // 1. Enforce Authentication & Role (from layout, but getting user info for RPCs)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const tenantId = user.app_metadata?.tenant_id

  if (!tenantId) return null

  // 2. Parse Date Range
  const defaultStart = format(subDays(new Date(), 90), 'yyyy-MM-dd')
  const defaultEnd = format(new Date(), 'yyyy-MM-dd')

  let startDate = typeof searchParams.startDate === 'string' ? searchParams.startDate : defaultStart
  let endDate = typeof searchParams.endDate === 'string' ? searchParams.endDate : defaultEnd

  if (!isValid(parseISO(startDate))) startDate = defaultStart
  if (!isValid(parseISO(endDate))) endDate = defaultEnd

  // 3. Fetch Data in Parallel
  const [
    { data: quotesBookingsData, error: qbError },
    { data: revenueData, error: revError },
    { data: clientsData, error: clientError },
  ] = await Promise.all([
    supabase.rpc('get_tenant_quotes_bookings_over_time', { p_tenant_id: tenantId, p_start_date: startDate, p_end_date: endDate }),
    supabase.rpc('get_tenant_revenue_over_time', { p_tenant_id: tenantId, p_start_date: startDate, p_end_date: endDate }),
    supabase.rpc('get_tenant_new_clients_over_time', { p_tenant_id: tenantId, p_start_date: startDate, p_end_date: endDate }),
  ])

  if (qbError) console.error('Failed to load quotes/bookings:', qbError.message || qbError)
  if (revError) console.error('Failed to load revenue:', revError.message || revError)
  if (clientError) console.error('Failed to load new clients:', clientError.message || clientError)

  // 4. Aggregate Totals for Stat Tiles
  const totalInvoiced = revenueData?.reduce((sum, d) => sum + Number(d.invoiced_revenue), 0) ?? 0
  const totalCollected = revenueData?.reduce((sum, d) => sum + Number(d.collected_revenue), 0) ?? 0
  const totalNewClients = clientsData?.reduce((sum, d) => sum + Number(d.new_clients), 0) ?? 0
  const totalQuotesSent = quotesBookingsData?.reduce((sum, d) => sum + Number(d.quotes_sent), 0) ?? 0

  const formatGBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n)

  // Transform data for recharts
  const formattedRevenueData = revenueData?.map(d => ({
    period: d.period,
    bucket_date: d.bucket_date,
    invoiced_revenue: Number(d.invoiced_revenue),
    collected_revenue: Number(d.collected_revenue)
  })) || []

  const formattedQuotesData = quotesBookingsData?.map(d => ({
    period: d.period,
    bucket_date: d.bucket_date,
    quotesSent: Number(d.quotes_sent),
    confirmedBookings: Number(d.confirmed_bookings),
    conversionRate: d.conversion_rate ? Number(d.conversion_rate) : null
  })) || []

  const formattedClientsData = clientsData?.map(d => ({
    period: d.period,
    bucket_date: d.bucket_date,
    new_clients: Number(d.new_clients)
  })) || []

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Business performance and conversion tracking.
          </p>
        </div>
        <GlobalDateRangePicker />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Total Invoiced" value={formatGBP(totalInvoiced)} accentClassName="text-slate-600" />
        <StatTile label="Total Collected" value={formatGBP(totalCollected)} accentClassName="text-emerald-600" />
        <StatTile label="New Clients" value={String(totalNewClients)} accentClassName="text-blue-600" />
        <StatTile label="Quotes Sent" value={String(totalQuotesSent)} accentClassName="text-blue-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Revenue over time</h2>
          <RevenueChart data={formattedRevenueData} />
        </div>
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Quotes & Bookings</h2>
          <QuotesBookingsChart data={formattedQuotesData} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column (Main Stats) */}
        <div className="lg:col-span-2 space-y-8">
          <ConversionFunnel startDate={startDate} endDate={endDate} />
          
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Client Acquisition</h2>
            <NewClientsChart data={formattedClientsData} />
          </div>
        </div>

        {/* Right Column (Lists) */}
        <div className="lg:col-span-1 space-y-8">
          <RepeatCustomersList />
        </div>
      </div>
    </div>
  )
}
