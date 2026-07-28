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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[300px]">Name / Company</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead className="text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                  No contacts found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              initialContacts.map((contact) => (
                <TableRow key={contact.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell>
                    <div className="font-medium text-slate-900">
                      {contact.first_name} {contact.last_name || ''}
                    </div>
                    {contact.company_name && (
                      <div className="text-sm text-slate-500 mt-0.5">{contact.company_name}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary"
                      className={
                        contact.type === 'commercial' 
                          ? 'bg-blue-50 text-blue-700 hover:bg-blue-50' 
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50'
                      }
                    >
                      {contact.type.charAt(0).toUpperCase() + contact.type.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {contact.email && <div className="text-slate-900">{contact.email}</div>}
                      {contact.phone && <div className="text-slate-500">{contact.phone}</div>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-slate-500 text-sm">
                    {new Date(contact.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

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
