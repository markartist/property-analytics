"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFishStream, type ChatMessage, type FishTableEvent, type FishCsvEvent, type Conversation } from "@/hooks/use-fish-stream";
import {
  Fish, ArrowLeft, Send, Loader2, Database, Download, Trash2,
  Square, Sparkles, ChevronDown, MessageSquare, Plus, Clock, X,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

// ── Suggested casts ─────────────────────────────────────────────

const SUGGESTED_CASTS = [
  "Build me a PIB for The Anatole for 30 days and email mlaufhutte@venterraliving.com",
  "Which properties have the highest CIR this week?",
  "Show me the top 10 properties by total sessions",
  "Which properties are below 90% occupancy?",
  "Give me a portfolio summary",
  "Compare leasing funnel metrics across the portfolio",
  "Which properties have declining session trends?",
];

// ── Markdown-lite renderer (bold, bullets, headers) ─────────────

function RenderContent({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith("### ")) {
      elements.push(<h4 key={i} className="mt-3 mb-1 text-sm font-bold text-slate-900">{line.slice(4)}</h4>);
    } else if (line.startsWith("## ")) {
      elements.push(<h3 key={i} className="mt-4 mb-1 text-base font-bold text-slate-900">{line.slice(3)}</h3>);
    } else if (line.startsWith("# ")) {
      elements.push(<h2 key={i} className="mt-4 mb-2 text-lg font-bold text-slate-900">{line.slice(2)}</h2>);
    }
    // Bullet points
    else if (line.match(/^[-*] /)) {
      elements.push(
        <div key={i} className="flex gap-2 py-0.5">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0D5E6D]/60" />
          <span className="text-sm leading-relaxed text-slate-700">{renderInline(line.slice(2))}</span>
        </div>
      );
    }
    // Numbered lists
    else if (line.match(/^\d+\. /)) {
      const numMatch = line.match(/^(\d+)\. (.*)$/);
      if (numMatch) {
        elements.push(
          <div key={i} className="flex gap-2 py-0.5">
            <span className="shrink-0 text-sm font-semibold text-[#0D5E6D]/70 w-5 text-right">{numMatch[1]}.</span>
            <span className="text-sm leading-relaxed text-slate-700">{renderInline(numMatch[2])}</span>
          </div>
        );
      }
    }
    // Empty line
    else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    }
    // Regular paragraph
    else {
      elements.push(<p key={i} className="text-sm leading-relaxed text-slate-700">{renderInline(line)}</p>);
    }
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const chunks = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return chunks.map((chunk, i) => {
    const linkMatch = chunk.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const label = linkMatch[1];
      const href = linkMatch[2];
      if (href.startsWith("/")) {
        return (
          <Link key={i} href={href} className="text-[#0D5E6D] underline underline-offset-2 hover:text-[#15803D]">
            {label}
          </Link>
        );
      }
      return (
        <a key={i} href={href} target="_blank" rel="noreferrer" className="text-[#0D5E6D] underline underline-offset-2 hover:text-[#15803D]">
          {label}
        </a>
      );
    }

    const parts = chunk.split(/(\*\*[^*]+\*\*)/g);
    return (
      <React.Fragment key={i}>
        {parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={`${i}-${j}`} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
          }
          return <React.Fragment key={`${i}-${j}`}>{part}</React.Fragment>;
        })}
      </React.Fragment>
    );
  });
}

function buildPibDeepLink(prompt: string): string | null {
  const text = prompt.trim();
  if (!/\bpib\b/i.test(text)) return null;
  if (!/\b(build|generate|create|email|send)\b/i.test(text)) return null;
  return "/analysis/pib";
}

// ── Data table component ────────────────────────────────────────

function DataTable({ table }: { table: FishTableEvent }) {
  const [expanded, setExpanded] = React.useState(false);
  const rows = table.rows;
  if (!rows.length) return null;

  const columns = Object.keys(rows[0]);
  const displayRows = expanded ? rows : rows.slice(0, 10);

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50">
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">
                  {col.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-2 text-xs font-medium text-[#0D5E6D] hover:bg-slate-50"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Show less" : `Show all ${rows.length} rows${table.capped ? ` (capped from ${table.total})` : ""}`}
        </button>
      )}
      {!expanded && table.capped && rows.length <= 10 && (
        <div className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400">
          Showing {rows.length} of {table.total} rows. Ask for a CSV export to get all data.
        </div>
      )}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

// ── CSV download badge ──────────────────────────────────────────

function CsvBadge({ csv }: { csv: FishCsvEvent }) {
  return (
    <a
      href={`${API_BASE}/v1/fish/export/${csv.key}`}
      download={csv.filename}
      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors my-1"
    >
      <Download className="h-3.5 w-3.5" />
      {csv.filename} ({csv.row_count} rows)
    </a>
  );
}

// ── Message bubble ──────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#0D5E6D] px-4 py-3 text-sm text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="mt-1 shrink-0 rounded-full bg-[#15803D]/10 p-1.5">
        <Fish className="h-4 w-4 text-[#15803D]" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {/* Tool activity indicators */}
        {message.events
          .filter((e) => e.type === "tool")
          .map((e, i) => {
            const tool = e as { tool: string; explanation?: string };
            return (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                <Database className="h-3 w-3" />
                <span>{tool.explanation ?? `Used ${tool.tool}`}</span>
              </div>
            );
          })}

        {/* Data tables */}
        {message.tables.map((table, i) => (
          <DataTable key={i} table={table} />
        ))}

        {/* Text content */}
        {message.content && (
          <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm border border-slate-100">
            <RenderContent text={message.content} />
          </div>
        )}

        {/* CSV downloads */}
        {message.csvs.map((csv, i) => (
          <CsvBadge key={i} csv={csv} />
        ))}

        {/* Streaming indicator */}
        {message.isStreaming && !message.content && message.tables.length === 0 && (
          <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm border border-slate-100">
            <div className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-[#0D5E6D]/40 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-2 w-2 rounded-full bg-[#0D5E6D]/40 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 rounded-full bg-[#0D5E6D]/40 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────

export default function FishingHolePage() {
  const router = useRouter();
  const {
    messages, isLoading, status, conversationId,
    conversations, cast, stop, clear,
    loadConversations, loadConversation, deleteConversation,
  } = useFishStream();
  const [input, setInput] = React.useState("");
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Load conversations on mount
  React.useEffect(() => { loadConversations(); }, [loadConversations]);

  // Auto-scroll on new messages
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const pibLink = buildPibDeepLink(input);
    if (pibLink) {
      setInput("");
      router.push(pibLink);
      return;
    }
    cast(input);
    setInput("");
  };

  const handleSuggestedCast = (question: string) => {
    const pibLink = buildPibDeepLink(question);
    if (pibLink) {
      router.push(pibLink);
      return;
    }
    cast(question);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Conversation sidebar */}
      {sidebarOpen && (
        <div className="shrink-0 w-72 flex flex-col border-r border-slate-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Conversations</span>
            <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <button
              onClick={() => { clear(); setSidebarOpen(false); }}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm text-[#15803D] font-medium hover:bg-slate-50 border-b border-slate-50"
            >
              <Plus className="h-4 w-4" />
              New Conversation
            </button>
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-start gap-2 px-4 py-3 cursor-pointer hover:bg-slate-50 border-b border-slate-50 ${
                  conversationId === conv.id ? "bg-[#15803D]/5" : ""
                }`}
              >
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1" onClick={() => { loadConversation(conv.id); setSidebarOpen(false); }}>
                  <p className="text-xs font-medium text-slate-700 truncate">{conv.title}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {formatDistanceToNow(parseISO(conv.updated_at), { addSuffix: true })}
                    {" · "}{conv.message_count} msgs
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-slate-400">No conversations yet</p>
            )}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 bg-[#15803D] px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <Link href="/pond" className="text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <button
            onClick={() => { setSidebarOpen(!sidebarOpen); if (!sidebarOpen) loadConversations(); }}
            className="text-white/60 hover:text-white transition-colors"
            title="Past conversations"
          >
            <MessageSquare className="h-5 w-5" />
          </button>
          <Fish className="h-6 w-6 text-white/70" />
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">The Fishing Hole</h1>
            <p className="text-xs text-white/50">Cast a question into the data pond</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
          {isEmpty ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-[#15803D]/10 p-4 mb-5">
                <Fish className="h-10 w-10 text-[#15803D]" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Welcome to The Fishing Hole</h2>
              <p className="text-sm text-slate-500 max-w-md mb-8">
                Ask me anything about your property analytics — traffic, CIR, leasing funnels, occupancy, reviews, and more. I&apos;ll query the data pond and reel in an answer.
              </p>

              {/* Suggested casts */}
              <div className="w-full max-w-lg">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  <Sparkles className="inline h-3 w-3 mr-1" />
                  Suggested Casts
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {SUGGESTED_CASTS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSuggestedCast(q)}
                      disabled={isLoading}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-xs text-slate-600 shadow-sm transition-all hover:border-[#15803D]/30 hover:shadow-md hover:text-[#15803D] disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Message list */
            messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
          )}
        </div>
      </div>

      {/* Status bar */}
      {status && (
        <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-2">
          <div className="mx-auto flex max-w-4xl items-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            {status}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-4xl items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Cast your line... (e.g. Which properties have the best CIR?)"
            disabled={isLoading}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#15803D]/50 focus:outline-none focus:ring-2 focus:ring-[#15803D]/20 disabled:opacity-60"
          />
          {isLoading ? (
            <Button
              type="button"
              onClick={stop}
              size="icon"
              className="h-11 w-11 rounded-xl bg-red-500 hover:bg-red-600"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!input.trim()}
              size="icon"
              className="h-11 w-11 rounded-xl bg-[#15803D] hover:bg-[#166534]"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
    </div>
  );
}
