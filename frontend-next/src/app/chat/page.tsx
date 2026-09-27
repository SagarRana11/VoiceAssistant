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
  type RoleId,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ROLES, roleById } from "@/lib/roles";

export default function ChatPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [railOpen, setRailOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const refreshList = useCallback(async () => {
    const d = await api<{ conversations: ConversationSummary[] }>("/chat/conversations");
    setList(d.conversations);
  }, []);

  useEffect(() => {
    if (!user) return;
    api<{ conversations: ConversationSummary[] }>("/chat/conversations")
      .then((d) => setList(d.conversations))
      .catch((e) => setError(e.message));
  }, [user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [active?.messages]);

  async function createConversation(roleId: RoleId) {
    const d = await api<{ conversation: Conversation }>("/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ roleId, roleName: roleById(roleId).name }),
    });
    return d.conversation;
  }

  async function startConversation(roleId: RoleId) {
    setError("");
    try {
      setActive(await createConversation(roleId));
      setRailOpen(false);
      await refreshList();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function openConversation(id: string) {
    setError("");
    try {
      const d = await api<{ conversation: Conversation }>(`/chat/conversations/${id}`);
      setActive(d.conversation);
      setRailOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteConversation(id: string) {
    try {
      await api(`/chat/conversations/${id}`, { method: "DELETE" });
      if (active?._id === id) setActive(null);
      await refreshList();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || streaming) return;
    setDraft("");
    setError("");
    setStreaming(true);
    // No role picked yet → start a General (no-role) conversation; RAG is chosen from the query.
    let conv = active;
    if (!conv) {
      try {
        conv = await createConversation("general");
        setActive(conv);
      } catch (err) {
        setError((err as Error).message);
        setDraft(text);
        setStreaming(false);
        return;
      }
    }
    const target = conv;
    const now = new Date().toISOString();
    const userMsg: ChatMessage = { _id: `u-${now}`, role: "user", content: text, timestamp: now };
    const botMsg: ChatMessage = { _id: `a-${now}`, role: "assistant", content: "", timestamp: now };
    setActive((c) => c && { ...c, messages: [...c.messages, userMsg, botMsg] });
    try {
      await streamMessage({ conversationId: target._id, message: text, roleId: target.roleId }, (chunk) =>
        setActive((c) => {
          if (!c) return c;
          const msgs = c.messages.slice();
          const last = msgs[msgs.length - 1];
          msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
          return { ...c, messages: msgs };
        }),
      );
      await refreshList();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStreaming(false);
    }
  }

  if (loading || !user) return null;

  const role = active ? roleById(active.roleId) : null;

  return (
    <div className="flex h-dvh" style={{ ["--hue" as string]: role?.hue ?? "var(--accent)" }}>
      {/* Rail */}
      <aside
        className={`${railOpen ? "flex" : "hidden"} absolute inset-0 z-20 w-full flex-col border-r border-line bg-paper md:static md:flex md:w-80`}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <span className="font-display text-lg font-semibold">Voice Assistant</span>
          <Link href="/hrms" className="text-sm text-ink-soft hover:text-ink">
            HR policies →
          </Link>
          <button className="text-sm text-ink-soft md:hidden" onClick={() => setRailOpen(false)}>
            Close
          </button>
        </div>

        <h2 className="px-5 pt-6 text-sm font-medium text-ink-soft">Start a conversation</h2>
        <ul className="mt-2 space-y-1 px-3">
          {ROLES.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => startConversation(r.id)}
                className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-mist"
              >
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.hue }} />
                <span>
                  <span className="block font-medium">{r.name}</span>
                  <span className="block text-sm text-ink-soft">{r.blurb}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <h2 className="px-5 pt-6 text-sm font-medium text-ink-soft">Recent</h2>
        <ul className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          {list.length === 0 && <li className="px-2 py-2 text-sm text-ink-soft">No conversations yet.</li>}
          {list.map((c) => {
            const r = roleById(c.roleId);
            const selected = active?._id === c._id;
            return (
              <li key={c._id} className="group flex items-center">
                <button
                  onClick={() => openConversation(c._id)}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left ${selected ? "bg-mist" : "hover:bg-mist"}`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.hue }} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.roleName}</span>
                    <span className="block truncate text-xs text-ink-soft">
                      {c.lastMessage?.content ?? "No messages yet"}
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => deleteConversation(c._id)}
                  aria-label={`Delete ${c.roleName} conversation`}
                  className="ml-1 rounded px-2 py-1 text-xs text-ink-soft opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-danger"
                >
                  Delete
                </button>
              </li>
            );
          })}
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
          {role ? (
            <>
              <span className="h-3 w-3 rounded-full bg-hue" />
              <h1 className="font-display text-xl font-semibold">{role.name}</h1>
            </>
          ) : (
            <h1 className="font-display text-xl font-semibold">Choose a coach</h1>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          {!active ? (
            <div className="mx-auto mt-16 max-w-md">
              <p className="font-display text-3xl leading-tight font-semibold">
                Hi {user.name.split(" ")[0]}, who do you want to talk to?
              </p>
              <p className="mt-3 text-ink-soft">
                Pick a coach on the left, or just type a question below — with no role, answers come from the knowledge
                docs that match your question.
              </p>
            </div>
          ) : active.messages.length === 0 ? (
            <p className="mx-auto mt-16 max-w-md text-ink-soft">
              Say hello to your {role?.name.toLowerCase()}. Your conversation is saved as you go.
            </p>
          ) : (
            <ol className="mx-auto max-w-2xl space-y-4">
              {active.messages.map((m) => (
                <li key={m._id} className={m.role === "user" ? "flex justify-end" : "flex"}>
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[80%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 whitespace-pre-wrap text-paper"
                        : "max-w-[80%] border-l-[3px] border-hue py-1 pl-4 leading-relaxed whitespace-pre-wrap"
                    }
                  >
                    {m.content || <span className="text-ink-soft">Thinking…</span>}
                  </div>
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

        <form onSubmit={send} className="border-t border-line bg-paper px-4 py-3 md:px-8">
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
              placeholder={active ? "Type a message" : "Ask anything, or pick a coach"}
              aria-label="Message"
              className="max-h-40 flex-1 resize-none rounded-xl border border-line bg-mist px-4 py-2.5 outline-none focus:border-hue disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={streaming || !draft.trim()}
              className="rounded-xl bg-hue px-5 py-2.5 font-medium text-white disabled:opacity-40"
            >
              {streaming ? "Replying…" : "Send"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
