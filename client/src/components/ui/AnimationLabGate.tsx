import { useEffect, useState } from "react";
import { ArrowLeft, LockKeyhole } from "lucide-react";

import { useAnimationLabAccess } from "@/lib/stores/useAnimationLabAccess";

import { ContentShell } from "../primitives/ContentShell";
import { PanelHeader } from "../primitives/PanelHeader";
import { HeroBackground } from "./HeroBackground";
import { Button } from "./button";
import { Input } from "./input";

interface AnimationLabGateProps {
  children: React.ReactNode;
}

export function AnimationLabGate({ children }: AnimationLabGateProps) {
  const allowed = useAnimationLabAccess((state) => state.allowed);
  const loading = useAnimationLabAccess((state) => state.loading);
  const initialized = useAnimationLabAccess((state) => state.initialized);
  const configured = useAnimationLabAccess((state) => state.configured);
  const question = useAnimationLabAccess((state) => state.question);
  const error = useAnimationLabAccess((state) => state.error);
  const expiresAt = useAnimationLabAccess((state) => state.expiresAt);
  const refresh = useAnimationLabAccess((state) => state.refresh);
  const unlock = useAnimationLabAccess((state) => state.unlock);
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    if (!initialized && !loading) {
      void refresh();
    }
  }, [initialized, loading, refresh]);

  if (allowed) {
    return <>{children}</>;
  }

  const handleUnlock = async () => {
    const result = await unlock(answer);
    if (result.success) {
      setAnswer("");
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-amber-50">
      <HeroBackground />
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl">
          <ContentShell size="lg" shimmerBorder showCornerOrnaments>
            <div className="space-y-6 p-6 md:p-8">
              <PanelHeader
                icon={<LockKeyhole className="h-5 w-5" />}
                title="Restricted Tool"
                description="Animation Lab is locked in production. Unlock it for this browser session to continue."
                animated
              />

              {!initialized ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-amber-100/75">
                  Checking access…
                </div>
              ) : !configured ? (
                <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
                  Animation Lab access is not configured on this deployment. Set the server secret before using it in production.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-500/25 bg-black/25 p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-amber-300/70">Pass Phrase Prompt</div>
                    <p className="mt-2 text-sm leading-relaxed text-amber-100/80">{question}</p>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-amber-100">Answer</span>
                    <Input
                      type="password"
                      autoComplete="off"
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && answer.trim()) {
                          void handleUnlock();
                        }
                      }}
                      placeholder="Enter the answer"
                      className="border-amber-500/20 bg-black/30 text-amber-50 placeholder:text-amber-100/35"
                    />
                  </label>

                  {error ? (
                    <div className="rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {error}
                    </div>
                  ) : expiresAt ? (
                    <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                      Unlocked until {new Date(expiresAt).toLocaleString()}.
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      onClick={() => void handleUnlock()}
                      disabled={loading || answer.trim().length === 0}
                      className="bg-amber-300 text-slate-950 hover:bg-amber-200"
                    >
                      {loading ? "Unlocking…" : "Unlock Animation Lab"}
                    </Button>
                    <Button type="button" variant="secondary" asChild>
                      <a href="/">
                        <ArrowLeft className="h-4 w-4" />
                        Back to game
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ContentShell>
        </div>
      </div>
    </div>
  );
}

export default AnimationLabGate;
