import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle } from "lucide-react";

import { ChatPanel } from "@/components/chat/ChatPanel";
import type { ChatIdentity } from "@/components/chat/types";
import { useChatChannel } from "@/hooks/useChatChannel";
import { useChatUIState } from "@/hooks/useChatUIState";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface ChatDockProps {
  identity: ChatIdentity;
  participantCount?: number;
  roomTitle?: string;
  topOffsetPx?: number;
  suppressPeek?: boolean;
}

export function ChatDock({
  identity,
  participantCount,
  roomTitle,
  topOffsetPx = 0,
  suppressPeek = false,
}: ChatDockProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const badgePulseTimeoutRef = useRef<number | null>(null);
  const prevUnreadRef = useRef(0);
  const [showUnreadShimmer, setShowUnreadShimmer] = useState(false);
  const reducedMotion = useReducedMotion();
  const channel = useChatChannel(identity);

  const { ensureLobby, setLobbyOpen, consumePeek } = useChatUIState((state) => ({
    ensureLobby: state.ensureLobby,
    setLobbyOpen: state.setLobbyOpen,
    consumePeek: state.consumePeek,
  }));

  const lobbyState = useChatUIState(
    useMemo(
      () => (state) => state.byLobby[identity.lobbyCode],
      [identity.lobbyCode],
    ),
  );

  const isOpen = lobbyState?.isOpen ?? false;
  const unreadCount = lobbyState?.unreadCount ?? 0;
  const peek = lobbyState?.peek ?? null;
  const isRecording = lobbyState?.isRecording ?? false;

  useEffect(() => {
    ensureLobby(identity.lobbyCode);
  }, [ensureLobby, identity.lobbyCode]);

  useEffect(() => {
    if (!peek || isOpen || suppressPeek) return;
    const timer = window.setTimeout(() => {
      consumePeek(identity.lobbyCode);
    }, 3200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [consumePeek, identity.lobbyCode, isOpen, peek, suppressPeek]);

  useEffect(() => {
    const previousUnread = prevUnreadRef.current;
    prevUnreadRef.current = unreadCount;
    if (reducedMotion) return;
    if (unreadCount <= 0 || previousUnread !== 0) return;

    setShowUnreadShimmer(true);
    if (badgePulseTimeoutRef.current) {
      window.clearTimeout(badgePulseTimeoutRef.current);
    }
    badgePulseTimeoutRef.current = window.setTimeout(() => {
      setShowUnreadShimmer(false);
      badgePulseTimeoutRef.current = null;
    }, 900);
  }, [reducedMotion, unreadCount]);

  useEffect(() => {
    return () => {
      if (badgePulseTimeoutRef.current) {
        window.clearTimeout(badgePulseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setLobbyOpen(identity.lobbyCode, false);
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [identity.lobbyCode, isOpen, setLobbyOpen]);

  const topStyle = {
    top: `calc(env(safe-area-inset-top) + 1rem + ${topOffsetPx}px)`,
    right: "calc(env(safe-area-inset-right) + 1rem)",
  };

  const showPeek = Boolean(peek && !isOpen && !suppressPeek);

  return (
    <div className="fixed z-[var(--z-floating)] pointer-events-auto" style={topStyle}>
      <div className="relative flex flex-col items-end gap-2">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            setLobbyOpen(identity.lobbyCode, !isOpen);
            if (!isOpen) {
              consumePeek(identity.lobbyCode);
            }
          }}
          className={cn(
            "relative inline-flex h-10 w-10 items-center justify-center rounded-full border bg-slate-900/75 text-amber-100 shadow-lg backdrop-blur transition-all duration-150",
            unreadCount > 0 ? "border-amber-400/80 ring-2 ring-amber-400/30" : "border-slate-500/60 hover:border-amber-500/50",
            showUnreadShimmer && "shadow-[0_0_24px_rgba(245,158,11,0.45)]",
            isRecording && "border-red-400/80 ring-2 ring-red-400/35",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
          )}
          aria-label={isOpen ? "Close chat" : "Open chat"}
        >
          <MessageCircle className="h-4 w-4" />
          {isRecording && (
            <span className="pointer-events-none absolute bottom-1.5 right-1.5 inline-flex h-2.5 w-2.5">
              {!reducedMotion && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300/90" />
              )}
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-400" />
            </span>
          )}
          {unreadCount > 0 && (
            <motion.span
              key={unreadCount}
              initial={reducedMotion ? { opacity: 0 } : { scale: 0.75, opacity: 0.4 }}
              animate={reducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
              transition={{ duration: reducedMotion ? 0.08 : 0.12 }}
              className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full border border-amber-200/80 bg-amber-500 px-1 text-[10px] font-bold text-slate-950"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </button>

        <AnimatePresence>
          {showPeek && peek && (
            <motion.div
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: reducedMotion ? 0.1 : 0.18, ease: "easeOut" }}
              className="w-[260px] rounded-lg border border-amber-500/35 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-lg"
            >
              <div className="font-semibold text-amber-100">{peek.senderName}</div>
              <div className="mt-0.5 truncate text-slate-300/90">{peek.previewText}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: reducedMotion ? 0.1 : 0.16, ease: "easeOut" }}
              className="origin-top-right"
            >
              <ChatPanel
                identity={identity}
                isOpen={isOpen}
                onClose={() => {
                  setLobbyOpen(identity.lobbyCode, false);
                  triggerRef.current?.focus();
                }}
                participantCount={participantCount}
                roomTitle={roomTitle}
                variant="dropdown"
                channel={channel}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
