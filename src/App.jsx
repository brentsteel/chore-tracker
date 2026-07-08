import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";

const COLORS = {
  dark: "#0B3D5C",
  primary: "#1E88C7",
  primaryLight: "#2CA8E0",
  accent: "#4FA8D8",
  bgTop: "#EAF6FB",
  bgBottom: "#DCEFF9",
  border: "#CDE7F5",
  muted: "#9BB8C9",
  mutedLight: "#7FA8BE",
  card: "#ffffff",
  chip: "#F1F9FC",
};

const playChime = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const notes = [880, 1108.73]; // A5, C#6 — a bright little "ping"
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });
    setTimeout(() => ctx.close(), 900);
  } catch (e) {
    // Web Audio not available — fail silently
  }
};

const todayKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const dayLabel = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const last7Days = () => {
  const arr = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    arr.push(todayKey(d));
  }
  return arr;
};

export default function ChoreTracker() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [rooms, setRooms] = useState([]);
  const [chores, setChores] = useState([]);
  const [completions, setCompletions] = useState([]);

  const [tab, setTab] = useState("chores");
  const [sortMode, setSortMode] = useState("date");
  const [dayFilter, setDayFilter] = useState(null);

  const [newRoomName, setNewRoomName] = useState("");
  const [newChoreName, setNewChoreName] = useState("");
  const [newChoreRoom, setNewChoreRoom] = useState("");
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState(null);
  const [viewRoomId, setViewRoomId] = useState(null);
  const [celebration, setCelebration] = useState(null);

  const today = todayKey();

  // Track sign-in state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Load data once signed in, and keep every device in sync live
  useEffect(() => {
    if (!session) return;
    let active = true;

    const loadAll = async () => {
      const [roomsRes, choresRes, completionsRes] = await Promise.all([
        supabase.from("rooms").select("*").order("created_at"),
        supabase.from("chores").select("*").order("created_at"),
        supabase.from("completions").select("*"),
      ]);
      if (!active) return;
      if (roomsRes.data) setRooms(roomsRes.data.map((r) => ({ id: r.id, name: r.name })));
      if (choresRes.data)
        setChores(
          choresRes.data.map((c) => ({
            id: c.id,
            name: c.name,
            roomId: c.room_id,
            starred: c.starred,
          }))
        );
      if (completionsRes.data)
        setCompletions(
          completionsRes.data.map((c) => ({
            id: c.id,
            choreId: c.chore_id,
            date: c.date,
            completedBy: c.completed_by_name,
          }))
        );
    };

    loadAll();

    const channel = supabase
      .channel("chore-tracker-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "chores" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "completions" }, loadAll)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [session]);

  useEffect(() => {
    if (!newChoreRoom && rooms.length > 0) setNewChoreRoom(rooms[0].id);
  }, [rooms, newChoreRoom]);

  const currentName = () =>
    session?.user?.user_metadata?.full_name || session?.user?.email || "Someone";
  const currentEmail = () => session?.user?.email || "";

  const addRoom = async () => {
    const name = newRoomName.trim();
    if (!name) return;
    setNewRoomName("");
    await supabase.from("rooms").insert({ name });
  };

  const deleteRoom = async (roomId) => {
    setConfirmDeleteRoom(null);
    setViewRoomId((v) => (v === roomId ? null : v));
    await supabase.from("rooms").delete().eq("id", roomId);
  };

  const addChore = async () => {
    const name = newChoreName.trim();
    if (!name || !newChoreRoom) return;
    setNewChoreName("");
    await supabase.from("chores").insert({ name, room_id: newChoreRoom, starred: false });
  };

  const toggleStar = async (choreId) => {
    const chore = chores.find((c) => c.id === choreId);
    if (!chore) return;
    await supabase.from("chores").update({ starred: !chore.starred }).eq("id", choreId);
  };

  const deleteChore = async (choreId) => {
    await supabase.from("chores").delete().eq("id", choreId);
  };

  const isDoneToday = (choreId) =>
    completions.some((c) => c.choreId === choreId && c.date === today);

  const toggleDoneToday = async (choreId) => {
    if (isDoneToday(choreId)) {
      await supabase.from("completions").delete().eq("chore_id", choreId).eq("date", today);
    } else {
      await supabase.from("completions").insert({
        chore_id: choreId,
        date: today,
        completed_by_name: currentName(),
        completed_by_email: currentEmail(),
      });
      const chore = chores.find((c) => c.id === choreId);
      if (chore && chore.starred) {
        playChime();
        setCelebration(chore.name);
        window.clearTimeout(window.__choreCelebrationTimeout);
        window.__choreCelebrationTimeout = window.setTimeout(
          () => setCelebration(null),
          1800
        );
      }
    }
  };

  const lastDone = (choreId) => {
    const dates = completions
      .filter((c) => c.choreId === choreId)
      .map((c) => c.date)
      .sort();
    return dates.length ? dates[dates.length - 1] : null;
  };

  const roomName = (roomId) => rooms.find((r) => r.id === roomId)?.name || "—";

  const week = last7Days();
  const countsByDay = week.reduce((acc, d) => {
    acc[d] = completions.filter((c) => c.date === d).length;
    return acc;
  }, {});
  const maxCount = Math.max(1, ...Object.values(countsByDay));

  let historyRows = completions.map((c) => {
    const chore = chores.find((ch) => ch.id === c.choreId);
    return {
      id: c.id,
      date: c.date,
      choreName: chore ? chore.name : "(deleted chore)",
      roomName: chore ? roomName(chore.roomId) : "—",
      completedBy: c.completedBy,
    };
  });
  if (dayFilter) historyRows = historyRows.filter((r) => r.date === dayFilter);

  historyRows.sort((a, b) => {
    if (sortMode === "date") return b.date.localeCompare(a.date);
    if (sortMode === "room") return a.roomName.localeCompare(b.roomName) || b.date.localeCompare(a.date);
    if (sortMode === "chore") return a.choreName.localeCompare(b.choreName) || b.date.localeCompare(a.date);
    return 0;
  });

  const choresByRoom = rooms.map((room) => ({
    room,
    chores: chores.filter((c) => c.roomId === room.id),
  }));

  if (session === undefined) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: `linear-gradient(180deg, ${COLORS.bgTop} 0%, ${COLORS.bgBottom} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: COLORS.muted,
          fontFamily: "'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${COLORS.bgTop} 0%, ${COLORS.bgBottom} 100%)`,
        fontFamily: "'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        display: "flex",
        justifyContent: "center",
        padding: "24px 16px 100px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1.5,
              color: COLORS.accent,
              textTransform: "uppercase",
            }}
          >
            Household
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              color: COLORS.dark,
              letterSpacing: -0.5,
            }}
          >
            Chore Tracker
          </h1>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 6,
            }}
          >
            <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>
              Signed in as {currentName()}
            </span>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{
                border: "none",
                background: "transparent",
                color: COLORS.mutedLight,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        {tab === "rooms" && (
          <RoomsTab
            rooms={rooms}
            chores={chores}
            newRoomName={newRoomName}
            setNewRoomName={setNewRoomName}
            addRoom={addRoom}
            confirmDeleteRoom={confirmDeleteRoom}
            setConfirmDeleteRoom={setConfirmDeleteRoom}
            deleteRoom={deleteRoom}
            viewRoomId={viewRoomId}
            setViewRoomId={setViewRoomId}
          />
        )}

        {tab === "chores" && (
          <ChoresTab
            rooms={rooms}
            choresByRoom={choresByRoom}
            newChoreName={newChoreName}
            setNewChoreName={setNewChoreName}
            newChoreRoom={newChoreRoom}
            setNewChoreRoom={setNewChoreRoom}
            addChore={addChore}
            deleteChore={deleteChore}
            isDoneToday={isDoneToday}
            toggleDoneToday={toggleDoneToday}
            toggleStar={toggleStar}
            lastDone={lastDone}
            goToRooms={() => setTab("rooms")}
          />
        )}

        {tab === "history" && (
          <HistoryTab
            week={week}
            countsByDay={countsByDay}
            maxCount={maxCount}
            today={today}
            dayFilter={dayFilter}
            setDayFilter={setDayFilter}
            sortMode={sortMode}
            setSortMode={setSortMode}
            historyRows={historyRows}
          />
        )}
      </div>

      {viewRoomId && (
        <RoomChoresModal
          room={rooms.find((r) => r.id === viewRoomId)}
          chores={chores.filter((c) => c.roomId === viewRoomId)}
          isDoneToday={isDoneToday}
          toggleDoneToday={toggleDoneToday}
          toggleStar={toggleStar}
          lastDone={lastDone}
          onClose={() => setViewRoomId(null)}
        />
      )}

      {celebration && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: `linear-gradient(135deg, ${COLORS.primaryLight}, ${COLORS.primary})`,
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 16,
            fontSize: 14,
            fontWeight: 700,
            boxShadow: "0 8px 24px rgba(11,61,92,0.35)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            gap: 8,
            animation: "choreCelebrationPop 0.25s ease",
            maxWidth: "calc(100% - 32px)",
            textAlign: "center",
          }}
        >
          <style>{`
            @keyframes choreCelebrationPop {
              0% { opacity: 0; transform: translateX(-50%) translateY(-8px) scale(0.9); }
              100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
            }
          `}</style>
          ⭐ Nice one! "{celebration}" done
        </div>
      )}

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          padding: "10px 16px calc(env(safe-area-inset-bottom, 0px) + 10px)",
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(8px)",
          borderTop: `1px solid ${COLORS.border}`,
        }}
      >
        <div style={{ width: "100%", maxWidth: 420, display: "flex", gap: 8 }}>
          <NavButton label="Chores" icon="🧹" active={tab === "chores"} onClick={() => setTab("chores")} />
          <NavButton label="Rooms" icon="🏠" active={tab === "rooms"} onClick={() => setTab("rooms")} />
          <NavButton label="History" icon="📅" active={tab === "history"} onClick={() => setTab("history")} />
        </div>
      </div>
    </div>
  );
}

function NavButton({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        border: "none",
        background: active ? COLORS.primary : "transparent",
        color: active ? "#fff" : COLORS.mutedLight,
        borderRadius: 16,
        padding: "10px 0",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        transition: "background 0.15s ease, color 0.15s ease",
      }}
    >
      <span style={{ fontSize: 17 }}>{icon}</span>
      {label}
    </button>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: COLORS.card,
        borderRadius: 20,
        padding: "18px 16px",
        boxShadow: "0 4px 16px rgba(11,61,92,0.08)",
        marginBottom: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 0.8,
        color: COLORS.mutedLight,
        textTransform: "uppercase",
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function StarButton({ starred, onClick }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={starred ? "Unmark as important" : "Mark as important"}
      style={{
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontSize: 17,
        lineHeight: 1,
        padding: 2,
        flexShrink: 0,
        color: starred ? "#F5A623" : COLORS.border,
        filter: starred ? "drop-shadow(0 1px 2px rgba(245,166,35,0.4))" : "none",
        transition: "transform 0.15s ease",
        transform: starred ? "scale(1.05)" : "scale(1)",
      }}
    >
      {starred ? "★" : "☆"}
    </button>
  );
}

function RoomsTab({
  rooms,
  chores,
  newRoomName,
  setNewRoomName,
  addRoom,
  confirmDeleteRoom,
  setConfirmDeleteRoom,
  deleteRoom,
  viewRoomId,
  setViewRoomId,
}) {
  return (
    <>
      <Card>
        <SectionLabel>Add a room</SectionLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRoom()}
            placeholder="e.g. Kitchen"
            style={inputStyle}
          />
          <button onClick={addRoom} style={primaryBtnStyle}>
            Add
          </button>
        </div>
      </Card>

      <Card>
        <SectionLabel>Your rooms</SectionLabel>
        {rooms.length === 0 && (
          <div style={{ color: COLORS.muted, fontSize: 14, padding: "6px 0" }}>
            No rooms yet — add one above to get started.
          </div>
        )}
        {rooms.map((room) => {
          const choreCount = chores.filter((c) => c.roomId === room.id).length;
          const confirming = confirmDeleteRoom === room.id;
          return (
            <div
              key={room.id}
              onClick={() => !confirming && setViewRoomId(room.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 0",
                borderBottom: `1px solid ${COLORS.chip}`,
                cursor: confirming ? "default" : "pointer",
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.dark }}>
                  {room.name}
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>
                  {choreCount} chore{choreCount === 1 ? "" : "s"}
                </div>
              </div>
              {!confirming ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteRoom(room.id);
                  }}
                  style={ghostBtnStyle}
                  aria-label={`Delete ${room.name}`}
                >
                  Delete
                </button>
              ) : (
                <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => deleteRoom(room.id)} style={dangerBtnStyle}>
                    Confirm
                  </button>
                  <button onClick={() => setConfirmDeleteRoom(null)} style={ghostBtnStyle}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </>
  );
}

function RoomChoresModal({ room, chores, isDoneToday, toggleDoneToday, toggleStar, lastDone, onClose }) {
  if (!room) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,61,92,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
        boxSizing: "border-box",
        perspective: "900px",
        animation: "roomModalBackdropFade 0.2s ease",
      }}
    >
      <style>{`
        @keyframes roomModalBackdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes roomModalFlipIn {
          0% {
            opacity: 0;
            transform: rotateX(-70deg) scale(0.92) translateY(10px);
          }
          55% {
            opacity: 1;
            transform: rotateX(9deg) scale(1.015) translateY(0);
          }
          100% {
            opacity: 1;
            transform: rotateX(0deg) scale(1) translateY(0);
          }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          maxHeight: "75vh",
          background: COLORS.card,
          borderRadius: 24,
          padding: "20px 18px",
          boxShadow: "0 12px 40px rgba(11,61,92,0.30)",
          display: "flex",
          flexDirection: "column",
          transformOrigin: "center top",
          animation: "roomModalFlipIn 0.32s cubic-bezier(.25,.9,.35,1) both",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.8,
                color: COLORS.accent,
                textTransform: "uppercase",
              }}
            >
              Room
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.dark }}>
              {room.name}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: COLORS.chip,
              color: COLORS.mutedLight,
              width: 30,
              height: 30,
              borderRadius: "50%",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ overflowY: "auto" }}>
          {chores.length === 0 && (
            <div style={{ color: COLORS.muted, fontSize: 14, padding: "6px 0" }}>
              No chores in this room yet.
            </div>
          )}
          {chores.map((chore) => {
            const done = isDoneToday(chore.id);
            const last = lastDone(chore.id);
            return (
              <div
                key={chore.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: `1px solid ${COLORS.chip}`,
                }}
              >
                <div style={{ minWidth: 0, flex: 1, marginRight: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <StarButton starred={!!chore.starred} onClick={() => toggleStar(chore.id)} />
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: done ? COLORS.muted : COLORS.dark,
                        textDecoration: done ? "line-through" : "none",
                      }}
                    >
                      {chore.name}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2, marginLeft: 26 }}>
                    {last ? `Last done ${formatDate(last)}` : "Never done"}
                  </div>
                </div>
                <button
                  onClick={() => toggleDoneToday(chore.id)}
                  aria-label={done ? "Mark not done" : "Mark done today"}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    border: done ? "none" : `2px solid ${COLORS.border}`,
                    background: done
                      ? `linear-gradient(180deg, ${COLORS.primaryLight}, ${COLORS.primary})`
                      : "#fff",
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {done ? "✓" : ""}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ChoresTab({
  rooms,
  choresByRoom,
  newChoreName,
  setNewChoreName,
  newChoreRoom,
  setNewChoreRoom,
  addChore,
  deleteChore,
  isDoneToday,
  toggleDoneToday,
  toggleStar,
  lastDone,
  goToRooms,
}) {
  if (rooms.length === 0) {
    return (
      <Card>
        <SectionLabel>Get started</SectionLabel>
        <div style={{ color: COLORS.dark, fontSize: 14, marginBottom: 14, lineHeight: 1.5 }}>
          Create a room first, then you can add chores to it.
        </div>
        <button onClick={goToRooms} style={primaryBtnStyle}>
          Create a room
        </button>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <SectionLabel>Add a chore</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            value={newChoreName}
            onChange={(e) => setNewChoreName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addChore()}
            placeholder="e.g. Wipe down counters"
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={newChoreRoom}
              onChange={(e) => setNewChoreRoom(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button onClick={addChore} style={primaryBtnStyle}>
              Add
            </button>
          </div>
        </div>
      </Card>

      {choresByRoom.map(({ room, chores: roomChores }) => {
        if (roomChores.length === 0) return null;
        return (
          <Card key={room.id}>
            <SectionLabel>{room.name}</SectionLabel>
            {roomChores.map((chore) => {
              const done = isDoneToday(chore.id);
              const last = lastDone(chore.id);
              return (
                <div
                  key={chore.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: `1px solid ${COLORS.chip}`,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1, marginRight: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <StarButton starred={!!chore.starred} onClick={() => toggleStar(chore.id)} />
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: done ? COLORS.muted : COLORS.dark,
                          textDecoration: done ? "line-through" : "none",
                        }}
                      >
                        {chore.name}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2, marginLeft: 26 }}>
                      {last ? `Last done ${formatDate(last)}` : "Never done"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      onClick={() => toggleDoneToday(chore.id)}
                      aria-label={done ? "Mark not done" : "Mark done today"}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        border: done ? "none" : `2px solid ${COLORS.border}`,
                        background: done
                          ? `linear-gradient(180deg, ${COLORS.primaryLight}, ${COLORS.primary})`
                          : "#fff",
                        color: "#fff",
                        fontSize: 16,
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {done ? "✓" : ""}
                    </button>
                    <button
                      onClick={() => deleteChore(chore.id)}
                      aria-label={`Delete ${chore.name}`}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: COLORS.muted,
                        fontSize: 16,
                        cursor: "pointer",
                        padding: 4,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </Card>
        );
      })}
    </>
  );
}

function HistoryTab({
  week,
  countsByDay,
  maxCount,
  today,
  dayFilter,
  setDayFilter,
  sortMode,
  setSortMode,
  historyRows,
}) {
  return (
    <>
      <Card>
        <SectionLabel>Last 7 Days</SectionLabel>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {week.map((d) => {
            const count = countsByDay[d];
            const intensity = count === 0 ? 0 : count / maxCount;
            const isToday = d === today;
            const selected = dayFilter === d;
            return (
              <button
                key={d}
                onClick={() => setDayFilter(selected ? null : d)}
                style={{
                  border: "none",
                  background: "transparent",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background:
                      count === 0
                        ? COLORS.chip
                        : `linear-gradient(180deg, ${COLORS.primaryLight}, ${COLORS.primary})`,
                    opacity: count === 0 ? 1 : 0.4 + intensity * 0.6,
                    border: selected
                      ? `2px solid ${COLORS.dark}`
                      : isToday
                      ? `2px solid ${COLORS.primary}`
                      : "2px solid transparent",
                    color: count === 0 ? COLORS.muted : "#fff",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {count > 0 ? count : ""}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: isToday ? 800 : 600,
                    color: isToday ? COLORS.dark : COLORS.muted,
                  }}
                >
                  {dayLabel(d)}
                </span>
              </button>
            );
          })}
        </div>
        {dayFilter && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: COLORS.primary,
              fontWeight: 700,
              cursor: "pointer",
            }}
            onClick={() => setDayFilter(null)}
          >
            Showing {formatDate(dayFilter)} only — tap to clear ✕
          </div>
        )}
      </Card>

      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <SectionLabel>Activity Log</SectionLabel>
          <div style={{ display: "flex", gap: 4 }}>
            {["date", "room", "chore"].map((mode) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "capitalize",
                  cursor: "pointer",
                  background: sortMode === mode ? COLORS.primary : COLORS.chip,
                  color: sortMode === mode ? "#fff" : COLORS.mutedLight,
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {historyRows.length === 0 && (
          <div style={{ color: COLORS.muted, fontSize: 14, padding: "6px 0" }}>
            No chores logged yet.
          </div>
        )}

        {historyRows.map((row) => (
          <div
            key={row.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: `1px solid ${COLORS.chip}`,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.dark }}>
                {row.choreName}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.primary,
                  fontWeight: 600,
                  marginTop: 2,
                }}
              >
                {row.roomName}
                {row.completedBy ? ` · ${row.completedBy}` : ""}
              </div>
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 700, flexShrink: 0 }}>
              {formatDate(row.date)}
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

const inputStyle = {
  flex: 1,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
  padding: "11px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  color: COLORS.dark,
  outline: "none",
  background: COLORS.chip,
  boxSizing: "border-box",
};

const primaryBtnStyle = {
  background: `linear-gradient(180deg, ${COLORS.primaryLight} 0%, ${COLORS.primary} 100%)`,
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "11px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const ghostBtnStyle = {
  background: "transparent",
  border: "none",
  color: COLORS.mutedLight,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  padding: "6px 8px",
};

const dangerBtnStyle = {
  background: "#E0554F",
  border: "none",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  padding: "6px 10px",
  borderRadius: 8,
};
