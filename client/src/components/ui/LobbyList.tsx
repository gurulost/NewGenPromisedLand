import { useState, useEffect } from "react";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useAuth } from "../../lib/stores/useAuth";
import { useLobby } from "../../lib/stores/useLobby";
import { ContentShell } from "../primitives/ContentShell";
import { PanelHeader } from "../primitives/PanelHeader";
import { GlowingButton } from "../primitives/GlowingButton";
import { Globe, Plus, ArrowLeft, Users, LogIn } from "lucide-react";

function AuthForm({ onSuccess }: { onSuccess: () => void }) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = mode === "login" 
      ? await login(username, password)
      : await signup(username, password);

    setLoading(false);
    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || "An error occurred");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-amber-200 mb-1">Username</label>
        <input
          data-testid="lobby-auth-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-amber-500/30 rounded text-amber-100 focus:outline-none focus:border-amber-500"
          placeholder="Enter username"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-amber-200 mb-1">Password</label>
        <input
          data-testid="lobby-auth-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-amber-500/30 rounded text-amber-100 focus:outline-none focus:border-amber-500"
          placeholder="Enter password"
          required
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <GlowingButton data-testid="lobby-auth-submit" type="submit" className="w-full" disabled={loading}>
        {loading ? "Loading..." : mode === "login" ? "Log In" : "Sign Up"}
      </GlowingButton>
      <button
        data-testid="lobby-auth-toggle"
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="w-full text-sm text-amber-400 hover:text-amber-300 transition-colors"
      >
        {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
      </button>
    </form>
  );
}

function CreateLobbyForm({ onCreated }: { onCreated: (id: number) => void }) {
  const { createLobby, error: storeError, clearError } = useLobby();
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [mapSize, setMapSize] = useState("normal");
  const [authorityMode, setAuthorityMode] = useState<"private_demo_hosted" | "public_authoritative">("private_demo_hosted");
  const [loading, setLoading] = useState(false);
  const publicMultiplayerEnabled = import.meta.env.VITE_PUBLIC_MULTIPLAYER_ENABLED === "true";

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const lobby = await createLobby(name, maxPlayers, mapSize, authorityMode);
    setLoading(false);
    if (lobby) {
      onCreated(lobby.id);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-amber-200 mb-1">Game Name</label>
        <input
          data-testid="lobby-create-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-amber-500/30 rounded text-amber-100 focus:outline-none focus:border-amber-500"
          placeholder="My Game"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-amber-200 mb-1">Max Players</label>
        <select
          data-testid="lobby-create-max-players"
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
          className="w-full px-3 py-2 bg-slate-800 border border-amber-500/30 rounded text-amber-100 focus:outline-none focus:border-amber-500"
        >
          {[2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>{n} Players</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm text-amber-200 mb-1">Map Size</label>
        <select
          data-testid="lobby-create-map-size"
          value={mapSize}
          onChange={(e) => setMapSize(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-amber-500/30 rounded text-amber-100 focus:outline-none focus:border-amber-500"
        >
          <option value="tiny">Tiny (12x8)</option>
          <option value="small">Small (18x12)</option>
          <option value="normal">Normal (24x16)</option>
          <option value="large">Large (32x20)</option>
        </select>
      </div>
      {publicMultiplayerEnabled && (
        <div>
          <label className="block text-sm text-amber-200 mb-1">Multiplayer Mode</label>
          <select
            data-testid="lobby-create-authority-mode"
            value={authorityMode}
            onChange={(e) => setAuthorityMode(e.target.value as "private_demo_hosted" | "public_authoritative")}
            className="w-full px-3 py-2 bg-slate-800 border border-amber-500/30 rounded text-amber-100 focus:outline-none focus:border-amber-500"
          >
            <option value="private_demo_hosted">Private Demo (trusted host)</option>
            <option value="public_authoritative">Public Unranked (server authoritative)</option>
          </select>
        </div>
      )}
      <GlowingButton data-testid="lobby-create-submit" type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating..." : "Create Game"}
      </GlowingButton>
      {storeError && <p className="text-red-400 text-sm">{storeError}</p>}
    </form>
  );
}

function JoinByCodeForm({ onJoined }: { onJoined: (id: number) => void }) {
  const { joinLobby, error: storeError, clearError } = useLobby();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const lobby = await joinLobby(code.toUpperCase());
    setLoading(false);
    if (lobby) {
      onJoined(lobby.id);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <input
          data-testid="lobby-join-code-input"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="flex-1 px-3 py-2 bg-slate-800 border border-amber-500/30 rounded text-amber-100 focus:outline-none focus:border-amber-500 uppercase tracking-widest"
          placeholder="CODE"
          maxLength={6}
          required
        />
        <GlowingButton
          data-testid="lobby-join-code-submit"
          type="submit"
          disabled={loading || code.length < 4}
          aria-label="Join lobby by code"
        >
          <LogIn className="w-4 h-4" />
        </GlowingButton>
      </div>
      {storeError && <p className="text-red-400 text-sm">{storeError}</p>}
    </form>
  );
}

export default function LobbyList() {
  const { setGamePhase } = useLocalGame();
  const { user, checkAuth, loading: authLoading } = useAuth();
  const { lobbies, fetchLobbies, loading: lobbiesLoading, currentLobby } = useLobby();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLobbyId, setSelectedLobbyId] = useState<number | null>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (user) {
      fetchLobbies();
    }
  }, [user, fetchLobbies]);

  useEffect(() => {
    if (selectedLobbyId && currentLobby?.id === selectedLobbyId) {
      setGamePhase('lobbyRoom');
    }
  }, [currentLobby, selectedLobbyId, setGamePhase]);

  const handleLobbyCreated = async (id: number) => {
    setSelectedLobbyId(id);
    await useLobby.getState().fetchLobby(id);
  };

  const handleJoinByCode = async (code: string) => {
    const lobby = await useLobby.getState().joinLobby(code);
    if (lobby) {
      setSelectedLobbyId(lobby.id);
    }
  };

  const handleSelectOpenGame = async (lobby: { id: number; code: string }) => {
    await handleJoinByCode(lobby.code);
  };

  if (authLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
        <div className="text-amber-100">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-lg">
        <ContentShell size="lg">
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-2">
              <button
                data-testid="lobby-list-back-button"
                onClick={() => setGamePhase('menu')}
                className="text-amber-400 hover:text-amber-300 transition-colors"
                aria-label="Back to main menu"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <PanelHeader
                icon={<Globe />}
                title="Online Multiplayer"
                description={user ? `Logged in as ${user.username}` : "Sign in to play online"}
              />
            </div>

            {!user ? (
              <AuthForm onSuccess={() => fetchLobbies()} />
            ) : showCreate ? (
              <>
                <CreateLobbyForm onCreated={handleLobbyCreated} />
                <GlowingButton
                  variant="secondary"
                  data-testid="lobby-create-cancel"
                  className="w-full"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </GlowingButton>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <GlowingButton
                    data-testid="lobby-create-button"
                    className="w-full"
                    onClick={() => setShowCreate(true)}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" />
                      Create New Game
                    </span>
                  </GlowingButton>

                  <div className="border-t border-amber-500/20 pt-3">
                    <label className="block text-sm text-amber-200 mb-2">Join by Code</label>
                    <JoinByCodeForm onJoined={setSelectedLobbyId} />
                  </div>
                </div>

                <div className="border-t border-amber-500/20 pt-4">
                  <h3 className="text-amber-200 font-medium mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Open Games
                  </h3>
                  {lobbiesLoading ? (
                    <p className="text-amber-100/60 text-sm">Loading...</p>
                  ) : lobbies.length === 0 ? (
                    <p className="text-amber-100/60 text-sm text-center py-4">
                      No open games. Create one to get started!
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {lobbies.map((lobby) => (
                        <button
                          key={lobby.id}
                          data-testid={`lobby-open-game-${lobby.code}`}
                          onClick={() => handleSelectOpenGame(lobby)}
                          className="w-full p-3 bg-slate-800/50 border border-amber-500/20 rounded hover:border-amber-500/50 transition-colors text-left"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-amber-100 font-medium">{lobby.name}</span>
                            <span className="text-xs text-amber-400 bg-amber-500/20 px-2 py-1 rounded">
                              {lobby.code}
                            </span>
                          </div>
                          <div className="text-sm text-amber-100/60 mt-1">
                            {lobby.maxPlayers} players · {lobby.mapSize} map
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </ContentShell>
      </div>
    </div>
  );
}
