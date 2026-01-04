"use client";

import { MessageSquare, Trash2 } from "lucide-react";

interface Thread {
  id_thread: string;
  title: string;
  created_at?: string;
}

interface ThreadSidebarProps {
  threads: Thread[];
  activeThreadId: string | null;
  onThreadClick: (threadId: string) => void;
  onDeleteThread: (threadId: string, e: React.MouseEvent) => void;
}

export function ThreadSidebar({
  threads,
  activeThreadId,
  onThreadClick,
  onDeleteThread,
}: ThreadSidebarProps) {
  return (
    <aside className="w-72 h-screen border-r border-slate-800 bg-[#0f172a] flex flex-col z-30 shadow-2xl text-white overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 p-5 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-2 scrollbar-hide mb-4">
          {threads.map((t) => (
            <div
              key={t.id_thread}
              onClick={() => onThreadClick(t.id_thread)}
              className={`group flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all ${
                activeThreadId === t.id_thread
                  ? "bg-purple-600/20 border border-purple-500/40 text-white"
                  : "hover:bg-white/5 text-slate-400"
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <MessageSquare size={14} />
                <span className="text-[11px] font-bold truncate">{t.title}</span>
              </div>
              <button
                onClick={(e) => onDeleteThread(t.id_thread, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

