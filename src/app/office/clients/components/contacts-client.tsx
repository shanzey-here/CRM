'use client'

import { Contact } from '@/modules/clients/server/repository'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

interface ContactsClientProps {
  initialContacts: Contact[]
  currentPage: number
  totalPages: number
  currentQuery: string
  currentType: string
  totalCount: number
}

export default function ContactsClient({
  initialContacts,
  currentPage,
  totalPages,
  currentQuery,
  currentType,
  totalCount
}: ContactsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Local state for immediate typing feedback
  const [search, setSearch] = useState(currentQuery)

  const applyFilters = (newQuery?: string, newType?: string, newPage?: number) => {
    const params = new URLSearchParams(searchParams.toString())

    if (newQuery !== undefined) {
      if (newQuery.trim() !== '') {
        params.set('query', newQuery)
      } else {
        params.delete('query')
      }
      // Reset page on search change
      params.set('page', '1')
    }

    if (newType !== undefined) {
      if (newType !== 'all') {
        params.set('type', newType)
      } else {
        params.delete('type')
      }
      params.set('page', '1')
    }

    if (newPage !== undefined) {
      params.set('page', newPage.toString())
    }

    startTransition(() => {
      router.push(`?${params.toString()}`)
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex gap-4 items-center w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search by name or email..."
              className="pl-9 bg-slate-50 border-slate-200"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applyFilters(search, undefined, undefined)
                }
              }}
            />
          </div>
          
          <Select 
            value={currentType} 
            onValueChange={(val) => applyFilters(undefined, val ?? undefined, undefined)}
          >
            <SelectTrigger className="w-[180px] bg-slate-50 border-slate-200">
              <SelectValue placeholder="Contact Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="residential">Residential</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
            </SelectContent>
          </Select>

          {isPending && (
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          )}
        </div>
        
        <div className="text-sm text-slate-500 whitespace-nowrap">
          {totalCount} total contact{totalCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      {/* Table */}
      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden relative">
        <div className="overflow-x-auto whitespace-nowrap">
          <Table>
            <TableHeader className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-100">
              <TableRow className="hover:bg-transparent border-0">
                <TableHead className="py-3 font-medium text-slate-500">Status</TableHead>
                <TableHead className="py-3 font-medium text-slate-500">Move Date</TableHead>
                <TableHead className="py-3 font-medium text-slate-500">Pickup</TableHead>
                <TableHead className="py-3 font-medium text-slate-500">Delivery</TableHead>
                <TableHead className="py-3 font-medium text-slate-500 w-[200px]">Name / Company</TableHead>
                <TableHead className="py-3 font-medium text-slate-500 text-right">Hours</TableHead>
                <TableHead className="py-3 font-medium text-slate-500 text-right">Quoted / Sales</TableHead>
                <TableHead className="py-3 font-medium text-slate-500 text-right">Men</TableHead>
                <TableHead className="py-3 font-medium text-slate-500">Email</TableHead>
                <TableHead className="py-3 font-medium text-slate-500">Number</TableHead>
                <TableHead className="py-3 font-medium text-slate-500">Communication</TableHead>
                <TableHead className="py-3 font-medium text-slate-500 max-w-[200px]">Review/Notes</TableHead>
                <TableHead className="py-3 font-medium text-slate-500">By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="h-32 text-center text-slate-400 font-medium">
                    No contacts found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                initialContacts.map((contact: any) => {
                  const lead = contact.leads?.[0]
                  const quote = lead?.quotes?.[0]
                  const quotedSales = quote?.final_price ?? quote?.total_price
                  
                  let badgeStyle = 'bg-slate-100 text-slate-600 border-transparent font-medium'
                  let formattedStage = 'None'

                  if (lead?.stage) {
                    formattedStage = lead.stage.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                    switch (lead.stage) {
                      case 'completed':
                      case 'confirmed_booking':
                        badgeStyle = 'bg-emerald-100 text-emerald-700 border-transparent font-semibold shadow-sm'
                        break
                      case 'archived':
                        badgeStyle = 'bg-red-50 text-red-600 border-red-100 font-medium'
                        break
                      case 'survey_scheduled':
                      case 'follow_up':
                        badgeStyle = 'bg-amber-100 text-amber-700 border-transparent font-medium shadow-sm'
                        break
                      case 'inquiry':
                      case 'quote_sent':
                        badgeStyle = 'bg-blue-100 text-blue-700 border-transparent font-medium shadow-sm'
                        break
                    }
                  }

                  const emptyIndicator = <span className="text-slate-300 font-light">-</span>

                  return (
                    <TableRow 
                      key={contact.id} 
                      className="group hover:bg-slate-50/80 transition-all duration-200 cursor-pointer border-b border-slate-50 last:border-0"
                      onClick={() => router.push(`/office/clients/${contact.id}`)}
                    >
                      <TableCell className="py-3">
                        {lead?.stage ? (
                          <Badge variant="outline" className={badgeStyle}>
                            {formattedStage}
                          </Badge>
                        ) : (
                          emptyIndicator
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-slate-600 font-medium">
                        {lead?.preferred_move_date ? new Date(lead.preferred_move_date).toLocaleDateString() : emptyIndicator}
                      </TableCell>
                      <TableCell className="py-3 text-slate-500">
                        {lead?.origin_address?.postcode || lead?.origin_address?.city || emptyIndicator}
                      </TableCell>
                      <TableCell className="py-3 text-slate-500">
                        {lead?.destination_address?.postcode || lead?.destination_address?.city || emptyIndicator}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="font-semibold text-slate-800 truncate max-w-[200px] group-hover:text-blue-600 transition-colors">
                          {contact.first_name} {contact.last_name || ''}
                        </div>
                        {contact.company_name && (
                          <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px] font-medium">{contact.company_name}</div>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right text-slate-600 font-medium">
                        {lead?.estimated_hours ?? emptyIndicator}
                      </TableCell>
                      <TableCell className="py-3 text-right font-semibold text-slate-800">
                        {quotedSales != null ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(quotedSales) : emptyIndicator}
                      </TableCell>
                      <TableCell className="py-3 text-right text-slate-600 font-medium">
                        {lead?.estimated_crew_size ?? emptyIndicator}
                      </TableCell>
                      <TableCell className="py-3 text-slate-500">
                        {contact.email || emptyIndicator}
                      </TableCell>
                      <TableCell className="py-3 text-slate-500">
                        {contact.phone || emptyIndicator}
                      </TableCell>
                      <TableCell className="py-3 text-slate-500 capitalize">
                        {lead?.source ? lead.source.replace('_', ' ') : emptyIndicator}
                      </TableCell>
                      <TableCell className="py-3 text-slate-400 text-sm truncate max-w-[150px]" title={contact.notes || ''}>
                        {contact.notes || emptyIndicator}
                      </TableCell>
                      <TableCell className="py-3 text-slate-500">
                        {lead?.assigned_to ? <span className="text-emerald-600 font-medium">Assigned</span> : emptyIndicator}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {isPending && (
          <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-10" />
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyFilters(undefined, undefined, currentPage - 1)}
            disabled={currentPage <= 1 || isPending}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <div className="text-sm font-medium text-slate-500 px-4">
            Page {currentPage} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyFilters(undefined, undefined, currentPage + 1)}
            disabled={currentPage >= totalPages || isPending}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
