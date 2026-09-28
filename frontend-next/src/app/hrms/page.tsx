"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  streamMessage,
  type ChatMessage,
  type Conversation,
  type ConversationSummary,
  type Source,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

// HR policy Q&A — backed by /api/hrms (RAG over company_docs/pdf). Separate history from /chat.
const HUE = "#2F7F7A";
const SUGGESTIONS = [
  "How many earned leaves do I get in a year?",
  "What is the notice period for a Senior?",
  "What is the hotel limit in Bengaluru?",
  "How do I raise a POSH complaint?",
  "Which holidays does the Toronto office get?",
  "How is gratuity calculated?",
];

type Msg = ChatMessage & { sources?: Source[] };
type Conv = Omit<Conversation, "messages"> & { messages: Msg[] };

export default function HrmsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [active, setActive] = useState<Conv | null>(null);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [railOpen, setRailOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const refreshList = useCallback(async () => {
    const d = await api<{ conversations: ConversationSummary[] }>("/hrms/conversations");
    setList(d.conversations);
  }, []);

  useEffect(() => {
    if (!user) return;
    api<{ conversations: ConversationSummary[] }>("/hrms/conversations")
      .then((d) => setList(d.conversations))
      .catch((e) => setError(e.message));
  }, [user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [active?.messages]);

  async function openConversation(id: string) {
    setError("");
    try {
      const d = await api<{ conversation: Conversation }>(`/hrms/conversations/${id}`);
      setActive(d.conversation);
      setRailOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteConversation(id: string) {
    try {
      await api(`/hrms/conversations/${id}`, { method: "DELETE" });
      if (active?._id === id) setActive(null);
      await refreshList();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function patchLast(fn: (m: Msg) => Msg) {
    setActive((c) => {
      if (!c) return c;
      const msgs = c.messages.slice();
      msgs[msgs.length - 1] = fn(msgs[msgs.length - 1]);
      return { ...c, messages: msgs };
    });
  }

  async function ask(text: string) {
    text = text.trim();
    if (!text || streaming) return;
    setDraft("");
    setError("");
    setStreaming(true);
    let conv = active;
    if (!conv) {
      try {
        conv = (await api<{ conversation: Conversation }>("/hrms/conversations", { method: "POST" })).conversation;
        setActive(conv);
      } catch (err) {
        setError((err as Error).message);
        setDraft(text);
        setStreaming(false);
        return;
      }
    }
    const now = new Date().toISOString();
    const userMsg: Msg = { _id: `u-${now}`, role: "user", content: text, timestamp: now };
    const botMsg: Msg = { _id: `a-${now}`, role: "assistant", content: "", timestamp: now };
    setActive((c) => c && { ...c, messages: [...c.messages, userMsg, botMsg] });
    try {
      await streamMessage(
        { conversationId: conv._id, message: text },
        (chunk) => patchLast((m) => ({ ...m, content: m.content + chunk })),
        { path: "/hrms/message", onDone: (sources) => patchLast((m) => ({ ...m, sources })) },
      );
      await refreshList();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStreaming(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="flex h-dvh" style={{ ["--hue" as string]: HUE }}>
      {/* Rail */}
      <aside
        className={`${railOpen ? "flex" : "hidden"} absolute inset-0 z-20 w-full flex-col border-r border-line bg-paper md:static md:flex md:w-80`}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <span className="font-display text-lg font-semibold">HR Assistant</span>
          <Link href="/chat" className="text-sm text-ink-soft hover:text-ink">
            ← Coaches
          </Link>
          <button className="text-sm text-ink-soft md:hidden" onClick={() => setRailOpen(false)}>
            Close
          </button>
        </div>

        <div className="px-3 pt-5">
          <button
            onClick={() => {
              setActive(null);
              setRailOpen(false);
            }}
            className="w-full rounded-lg border border-line px-3 py-2 text-left text-sm font-medium hover:bg-mist"
          >
            + New question
          </button>
        </div>

        <h2 className="px-5 pt-6 text-sm font-medium text-ink-soft">Recent</h2>
        <ul className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          {list.length === 0 && <li className="px-2 py-2 text-sm text-ink-soft">No HR questions yet.</li>}
          {list.map((c) => (
            <li key={c._id} className="group flex items-center">
              <button
                onClick={() => openConversation(c._id)}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left ${active?._id === c._id ? "bg-mist" : "hover:bg-mist"}`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-hue" />
                <span className="block truncate text-sm">{c.lastMessage?.content ?? "No messages yet"}</span>
              </button>
              <button
                onClick={() => deleteConversation(c._id)}
                aria-label="Delete HR conversation"
                className="ml-1 rounded px-2 py-1 text-xs text-ink-soft opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-danger"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3 border-t border-line px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper">
            {user.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-ink-soft">{user.email}</span>
          </span>
          <button onClick={logout} className="text-sm text-ink-soft hover:text-ink">
            Log out
          </button>
        </div>
      </aside>

      {/* Conversation */}
      <main
        className="relative flex min-w-0 flex-1 flex-col"
        style={{ background: "color-mix(in oklab, var(--hue) 7%, var(--mist))" }}
      >
        <header className="flex items-center gap-3 border-b border-line px-4 py-3 md:px-8">
          <button className="text-sm font-medium md:hidden" onClick={() => setRailOpen(true)}>
            Menu
          </button>
          <span className="h-3 w-3 rounded-full bg-hue" />
          <h1 className="font-display text-xl font-semibold">Company policies</h1>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          {!active || active.messages.length === 0 ? (
            <div className="mx-auto mt-12 max-w-xl">
              <p className="font-display text-3xl leading-tight font-semibold">Ask about Nimbus HR policies</p>
              <p className="mt-3 text-ink-soft">
                Leave, travel claims, notice periods, holidays, benefits, conduct and more. Answers come from the
                company policy documents, not your personal records.
              </p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {SUGGESTIONS.map((q) => (
                  <li key={q}>
                    <button
                      onClick={() => ask(q)}
                      disabled={streaming}
                      className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm hover:border-hue disabled:opacity-50"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ol className="mx-auto max-w-2xl space-y-4">
              {active.messages.map((m) => (
                <li key={m._id} className={m.role === "user" ? "flex justify-end" : "flex flex-col"}>
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[80%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 whitespace-pre-wrap text-paper"
                        : "max-w-[80%] border-l-[3px] border-hue py-1 pl-4 leading-relaxed whitespace-pre-wrap"
                    }
                  >
                    {m.content || <span className="text-ink-soft">Searching policies…</span>}
                  </div>
                  {m.sources && m.sources.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5 pl-4" aria-label="Sources">
                      {m.sources.map((s) => (
                        <li
                          key={`${s.doc}:${s.section ?? ""}`}
                          title={s.section ? `${s.title} › ${s.section}` : s.title}
                          className="max-w-full truncate rounded-md bg-paper px-2 py-0.5 text-xs text-ink-soft"
                        >
                          {s.title}
                          {s.section && <span className="text-ink-soft/70"> › {s.section}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
          <div ref={endRef} />
        </div>

        {error && (
          <p role="alert" className="mx-4 mb-2 text-sm text-danger md:mx-8">
            {error}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
          className="border-t border-line bg-paper px-4 py-3 md:px-8"
        >
          <div className="mx-auto flex max-w-2xl items-end gap-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              placeholder="Ask an HR policy question"
              aria-label="HR question"
              className="max-h-40 flex-1 resize-none rounded-xl border border-line bg-mist px-4 py-2.5 outline-none focus:border-hue"
            />
            <button
              type="submit"
              disabled={streaming || !draft.trim()}
              className="rounded-xl bg-hue px-5 py-2.5 font-medium text-white disabled:opacity-40"
            >
              {streaming ? "Replying…" : "Ask"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
