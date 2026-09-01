'use client'

import React, { useState } from 'react'
import { PlatformIcon, getPlatformColor } from './platform-icons'
import { ThumbsUp, MessageSquare, Share2, Heart, Repeat2, Send, Bookmark, MoreHorizontal, Globe, Sparkles } from 'lucide-react'

interface LivePostPreviewProps {
  content: string
  platforms: string[]
  companyName?: string
  logoUrl?: string | null
}

export function LivePostPreview({
  content,
  platforms,
  companyName = 'Gomove Removals Ltd',
  logoUrl,
}: LivePostPreviewProps) {
  const activePlatforms = platforms.length > 0 ? platforms : ['facebook']
  const [selectedPlatform, setSelectedPlatform] = useState<string>(activePlatforms[0] || 'facebook')

  // Keep selectedPlatform in sync if active platforms change
  const currentPlatform = activePlatforms.includes(selectedPlatform) ? selectedPlatform : activePlatforms[0]

  return (
    <div className="flex flex-col h-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Live Feed Preview</span>
        </div>

        {/* Platform switcher tabs */}
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-xs">
          {activePlatforms.map((plat) => {
            const isSelected = plat === currentPlatform
            const colors = getPlatformColor(plat)
            return (
              <button
                key={plat}
                type="button"
                onClick={() => setSelectedPlatform(plat)}
                title={`Preview on ${plat}`}
                aria-label={`Preview on ${plat}`}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  isSelected
                    ? `${colors.activeBg} ${colors.activeText} shadow-xs`
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <PlatformIcon platform={plat} className="w-3.5 h-3.5" />
                <span className="capitalize hidden sm:inline">{plat}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center py-4">
        {currentPlatform === 'facebook' && (
          <div className="w-full max-w-[420px] bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-xs overflow-hidden border border-slate-100">
                  {logoUrl ? (
                    <img src={logoUrl} alt={companyName} className="w-full h-full object-cover" />
                  ) : (
                    companyName.charAt(0)
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 leading-tight">{companyName}</h4>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <span>Just now</span> &middot; <Globe className="w-3 h-3 text-slate-400" />
                  </p>
                </div>
              </div>
              <MoreHorizontal className="w-4 h-4 text-slate-400" />
            </div>

            {/* Post text */}
            <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap min-h-[60px]">
              {content.trim() ? (
                content
              ) : (
                <span className="text-slate-400 italic">Your post text will appear here...</span>
              )}
            </div>

            {/* Mock stats & actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <button type="button" className="flex-1 py-1.5 flex items-center justify-center gap-1.5 hover:bg-slate-50 rounded font-medium text-slate-600">
                <ThumbsUp className="w-3.5 h-3.5 text-blue-600" /> Like
              </button>
              <button type="button" className="flex-1 py-1.5 flex items-center justify-center gap-1.5 hover:bg-slate-50 rounded font-medium text-slate-600">
                <MessageSquare className="w-3.5 h-3.5" /> Comment
              </button>
              <button type="button" className="flex-1 py-1.5 flex items-center justify-center gap-1.5 hover:bg-slate-50 rounded font-medium text-slate-600">
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
            </div>
          </div>
        )}

        {currentPlatform === 'linkedin' && (
          <div className="w-full max-w-[420px] bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-sm bg-sky-700 text-white font-bold flex items-center justify-center text-sm shadow-xs overflow-hidden border border-slate-100">
                  {logoUrl ? (
                    <img src={logoUrl} alt={companyName} className="w-full h-full object-cover" />
                  ) : (
                    companyName.charAt(0)
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 leading-tight">{companyName}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Removals & Logistics &middot; 1h</p>
                </div>
              </div>
              <MoreHorizontal className="w-4 h-4 text-slate-400" />
            </div>

            <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap min-h-[60px]">
              {content.trim() ? (
                content
              ) : (
                <span className="text-slate-400 italic">Your LinkedIn update will appear here...</span>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <button type="button" className="flex-1 py-1.5 flex items-center justify-center gap-1.5 hover:bg-slate-50 rounded font-medium text-slate-600">
                <ThumbsUp className="w-3.5 h-3.5 text-sky-600" /> Like
              </button>
              <button type="button" className="flex-1 py-1.5 flex items-center justify-center gap-1.5 hover:bg-slate-50 rounded font-medium text-slate-600">
                <MessageSquare className="w-3.5 h-3.5" /> Comment
              </button>
              <button type="button" className="flex-1 py-1.5 flex items-center justify-center gap-1.5 hover:bg-slate-50 rounded font-medium text-slate-600">
                <Repeat2 className="w-3.5 h-3.5" /> Repost
              </button>
              <button type="button" className="flex-1 py-1.5 flex items-center justify-center gap-1.5 hover:bg-slate-50 rounded font-medium text-slate-600">
                <Send className="w-3.5 h-3.5" /> Send
              </button>
            </div>
          </div>
        )}

        {(currentPlatform === 'twitter' || currentPlatform === 'x') && (
          <div className="w-full max-w-[420px] bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs shadow-xs overflow-hidden shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt={companyName} className="w-full h-full object-cover" />
                ) : (
                  companyName.charAt(0)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-slate-900 truncate leading-tight">{companyName}</h4>
                  <span className="text-xs text-slate-400">@gomove</span>
                  <span className="text-xs text-slate-400">&middot; 1m</span>
                </div>

                <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap mt-2 min-h-[50px]">
                  {content.trim() ? (
                    content
                  ) : (
                    <span className="text-slate-400 italic">Your post preview...</span>
                  )}
                </div>

                <div className="pt-3 flex items-center justify-between text-slate-400 text-xs max-w-[300px]">
                  <MessageSquare className="w-3.5 h-3.5 hover:text-blue-500 cursor-pointer" />
                  <Repeat2 className="w-3.5 h-3.5 hover:text-emerald-500 cursor-pointer" />
                  <Heart className="w-3.5 h-3.5 hover:text-pink-500 cursor-pointer" />
                  <Bookmark className="w-3.5 h-3.5 hover:text-blue-500 cursor-pointer" />
                  <Share2 className="w-3.5 h-3.5 hover:text-blue-500 cursor-pointer" />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentPlatform === 'instagram' && (
          <div className="w-full max-w-[420px] bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 p-[2px]">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                    {logoUrl ? (
                      <img src={logoUrl} alt={companyName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-slate-800">{companyName.charAt(0)}</span>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">{companyName.toLowerCase().replace(/\s+/g, '')}</h4>
                  <p className="text-[10px] text-slate-400">Original audio</p>
                </div>
              </div>
              <MoreHorizontal className="w-4 h-4 text-slate-400" />
            </div>

            <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap min-h-[50px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="font-bold mr-1.5">{companyName.toLowerCase().replace(/\s+/g, '')}</span>
              {content.trim() ? content : <span className="text-slate-400 italic">Caption preview...</span>}
            </div>

            <div className="pt-2 flex items-center justify-between text-slate-700">
              <div className="flex items-center gap-3">
                <Heart className="w-4 h-4 hover:text-red-500 cursor-pointer" />
                <MessageSquare className="w-4 h-4 hover:text-slate-500 cursor-pointer" />
                <Send className="w-4 h-4 hover:text-slate-500 cursor-pointer" />
              </div>
              <Bookmark className="w-4 h-4 hover:text-slate-500 cursor-pointer" />
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-center text-slate-400">
        Simulated mockup of cross-platform post layout & typography
      </p>
    </div>
  )
}
