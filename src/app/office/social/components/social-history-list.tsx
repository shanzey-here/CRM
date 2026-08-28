'use client'

import React, { useState, useMemo } from 'react'
import { SocialPostItem } from './social-post-item'
import { Search, Clock, CheckCircle2, AlertTriangle, Layers, Calendar, MessageSquareOff } from 'lucide-react'

interface SocialHistoryListProps {
  posts: any[]
  accountsByIdMap: Record<string, any>
}

type TabType = 'all' | 'pending' | 'published' | 'issues'

export function SocialHistoryList({ posts, accountsByIdMap }: SocialHistoryListProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Compute counts for tabs
  const counts = useMemo(() => {
    return {
      all: posts.length,
      pending: posts.filter((p) => p.status === 'pending').length,
      published: posts.filter((p) => p.status === 'published').length,
      issues: posts.filter((p) => p.status === 'failed' || p.status === 'partial').length,
    }
  }, [posts])

  // Filtered posts based on active tab and search query
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // Tab filter
      if (activeTab === 'pending' && post.status !== 'pending') return false
      if (activeTab === 'published' && post.status !== 'published') return false
      if (activeTab === 'issues' && post.status !== 'failed' && post.status !== 'partial') return false

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const contentMatch = post.content?.toLowerCase().includes(query)
        const accountMatch = post.account_ids?.some((id: string) => {
          const acc = accountsByIdMap[id]
          return (
            acc?.display_name?.toLowerCase().includes(query) ||
            acc?.platform?.toLowerCase().includes(query)
          )
        })
        if (!contentMatch && !accountMatch) return false
      }

      return true
    })
  }, [posts, activeTab, searchQuery, accountsByIdMap])

  return (
    <div className="space-y-4">
      {/* Header with Search and Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Posts</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'pending'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Scheduled Queue</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'pending' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800'
              }`}
            >
              {counts.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('published')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'published'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Published</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'published' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {counts.published}
            </span>
          </button>

          {counts.issues > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('issues')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'issues'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Issues</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'issues' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {counts.issues}
              </span>
            </button>
          )}
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts or channels..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Posts List */}
      {filteredPosts.length > 0 ? (
        <div className="space-y-3">
          {filteredPosts.map((post) => (
            <SocialPostItem
              key={post.id}
              post={post}
              accountsByIdMap={accountsByIdMap}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            {searchQuery ? (
              <Search className="w-5 h-5" />
            ) : activeTab === 'pending' ? (
              <Clock className="w-5 h-5" />
            ) : (
              <MessageSquareOff className="w-5 h-5" />
            )}
          </div>
          <p className="text-sm font-semibold text-slate-700">
            {searchQuery
              ? 'No matching posts found'
              : activeTab === 'pending'
              ? 'No posts scheduled in the queue'
              : activeTab === 'published'
              ? 'No published posts yet'
              : activeTab === 'issues'
              ? 'No delivery issues found'
              : 'No posts yet'}
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `We couldn't find any post matching "${searchQuery}". Try a different search term.`
              : 'Compose a message above to post immediately or schedule for future publication.'}
          </p>
        </div>
      )}
    </div>
  )
}
