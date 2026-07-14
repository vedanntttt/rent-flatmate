"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";

/**
 * Real-time chat for an accepted interest (interest.id = conversation id).
 * History loads via the API; new messages stream over Supabase Realtime
 * (WebSocket) filtered by interest_id, and are persisted in the messages table.
 */
export function Chat({
  interestId,
  currentUserId,
}: {
  interestId: string;
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      // Ensure Realtime carries the user's JWT so RLS lets postgres_changes
      // through (guards against a cookie-hydration race on first render).
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);

      const res = await fetch(`/api/messages?interestId=${interestId}`);
      const json = await res.json();
      if (active) setMessages(json.messages ?? []);

      channel = supabase
        .channel(`messages:${interestId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `interest_id=eq.${interestId}`,
          },
          (payload) => {
            const msg = payload.new as Message;
            setMessages((prev) =>
              prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
            );
          }
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [interestId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText("");
    setSending(true);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interest_id: interestId, content }),
    });
    setSending(false);
    const json = await res.json();
    if (res.ok && json.message) {
      // Optimistic add; realtime echo is de-duped by id.
      setMessages((prev) =>
        prev.some((m) => m.id === json.message.id) ? prev : [...prev, json.message]
      );
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50">
      <div className="scroll-thin flex h-64 flex-col gap-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="m-auto text-xs text-neutral-400">
            No messages yet. Say hello 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div
                key={m.id}
                className={cn("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-1.5 text-sm",
                    mine
                      ? "bg-neutral-900 text-white"
                      : "border border-neutral-200 bg-white text-neutral-900"
                  )}
                >
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-neutral-200 p-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="h-9"
        />
        <Button type="submit" size="sm" disabled={sending}>
          Send
        </Button>
      </form>
    </div>
  );
}
