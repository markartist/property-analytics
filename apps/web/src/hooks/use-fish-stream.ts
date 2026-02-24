"use client";

import { useCallback, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

// ── SSE Event types ─────────────────────────────────────────────

export interface FishThinkingEvent {
  type: "thinking";
  message: string;
}

export interface FishToolEvent {
  type: "tool";
  tool: string;
  status: string;
  explanation?: string;
  property?: string;
  filename?: string;
}

export interface FishTableEvent {
  type: "table";
  rows: Record<string, unknown>[];
  total: number;
  capped: boolean;
}

export interface FishTextEvent {
  type: "text";
  content: string;
}

export interface FishCsvEvent {
  type: "csv";
  key: string;
  filename: string;
  row_count: number;
}

export interface FishErrorEvent {
  type: "error";
  message: string;
}

export type FishEvent =
  | FishThinkingEvent
  | FishToolEvent
  | FishTableEvent
  | FishTextEvent
  | FishCsvEvent
  | FishErrorEvent;

// ── Chat message ────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  events: FishEvent[];
  tables: FishTableEvent[];
  csvs: FishCsvEvent[];
  isStreaming?: boolean;
}

// ── Hook ────────────────────────────────────────────────────────

export function useFishStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cast = useCallback(async (question: string) => {
    if (!question.trim() || isLoading) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: question,
      events: [],
      tables: [],
      csvs: [],
    };

    const assistantId = `a-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      events: [],
      tables: [],
      csvs: [],
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);
    setStatus("Casting into the data pond...");

    // Build history from previous messages (text only)
    const history = messages
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch(`${API_BASE}/v1/fish/cast`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: "Request failed" } }));
        throw new Error(err.error?.message ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete line

        let eventType = "";
        let eventData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            eventData = line.slice(6);
          } else if (line === "" && eventType && eventData) {
            // Process complete event
            processEvent(eventType, eventData, assistantId);
            eventType = "";
            eventData = "";
          }
        }
      }

      // Mark streaming complete
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
      );
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: m.content || `Error: ${msg}`,
                events: [...m.events, { type: "error" as const, message: msg }],
                isStreaming: false,
              }
            : m,
        ),
      );
    } finally {
      setIsLoading(false);
      setStatus(null);
      abortRef.current = null;
    }

    function processEvent(type: string, dataStr: string, msgId: string) {
      try {
        const data = JSON.parse(dataStr);

        switch (type) {
          case "thinking":
            setStatus(data.message);
            break;

          case "tool":
            setStatus(data.explanation ?? `Running ${data.tool}...`);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId ? { ...m, events: [...m.events, { type: "tool", ...data }] } : m,
              ),
            );
            break;

          case "table":
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId ? { ...m, tables: [...m.tables, { type: "table", ...data }] } : m,
              ),
            );
            break;

          case "text":
            setStatus(null);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId ? { ...m, content: m.content + (data.content ?? "") } : m,
              ),
            );
            break;

          case "csv":
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId ? { ...m, csvs: [...m.csvs, { type: "csv", ...data }] } : m,
              ),
            );
            break;

          case "error":
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId
                  ? { ...m, content: m.content || `Error: ${data.message}`, events: [...m.events, { type: "error", ...data }] }
                  : m,
              ),
            );
            break;

          case "done":
            // Final event — no action needed, stream will close
            break;
        }
      } catch {
        // Ignore malformed events
      }
    }
  }, [messages, isLoading]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
    setStatus(null);
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setStatus(null);
  }, []);

  return { messages, isLoading, status, cast, stop, clear };
}
