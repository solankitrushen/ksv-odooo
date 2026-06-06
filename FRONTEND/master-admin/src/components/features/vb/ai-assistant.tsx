"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAssistantChat } from "@/hooks/vb/use-assistant";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; text: string };

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [greeted, setGreeted] = useState(false);

  const chat = useAssistantChat();
  const { isPending } = chat;

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message / typing indicator.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isPending]);

  const send = (raw: string) => {
    const text = raw.trim();
    // Empty greeting send is allowed (first open); otherwise require text.
    if (!text && greeted) return;
    if (isPending) return;

    if (text) {
      setMessages((prev) => [...prev, { role: "user", text }]);
    }
    setInput("");
    setSuggestions([]);

    chat.mutate(text, {
      onSuccess: (res) => {
        setMessages((prev) => [...prev, { role: "assistant", text: res.reply }]);
        setSuggestions(res.suggestions ?? []);
      },
    });
  };

  // On first open, fetch greeting + suggestions with an empty message.
  useEffect(() => {
    if (open && !greeted) {
      setGreeted(true);
      send("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, greeted]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed bottom-24 right-6 z-50 flex w-[360px] max-w-[calc(100vw-3rem)] flex-col",
            "max-h-[70vh] overflow-hidden rounded-xl border border-border bg-card shadow-2xl",
          )}
          role="dialog"
          aria-label="VendorBridge Assistant"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                VendorBridge Assistant
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Message list */}
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 space-y-3 overflow-y-auto px-4 py-4"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isPending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl bg-muted px-3 py-2.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Suggestion chips */}
          {suggestions.length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-2 border-t border-border px-4 py-3">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => send(s)}
                  disabled={isPending}
                  className={cn(
                    "rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground",
                    "transition-colors hover:bg-accent hover:text-accent-foreground",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-3 py-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the assistant…"
              className="h-9 flex-1"
              disabled={isPending}
            />
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={isPending || !input.trim()}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      {/* Floating toggle button */}
      <Button
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </Button>
    </>
  );
}
