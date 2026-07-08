import { useState } from "react";
import { supabase } from "./supabaseClient";

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

export default function Auth() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setInfo("");
    if (!email.trim() || !password) {
      setError("Please enter an email and password.");
      return;
    }
    if (mode === "signup" && !fullName.trim()) {
      setError("Please enter your name.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (signUpError) throw signUpError;
        setInfo("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${COLORS.bgTop} 0%, ${COLORS.bgBottom} 100%)`,
        fontFamily: "'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ marginBottom: 20, textAlign: "center" }}>
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
        </div>

        <div
          style={{
            background: COLORS.card,
            borderRadius: 20,
            padding: "20px 18px",
            boxShadow: "0 4px 16px rgba(11,61,92,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              background: COLORS.chip,
              borderRadius: 12,
              padding: 4,
              marginBottom: 16,
            }}
          >
            {["signin", "signup"].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError("");
                  setInfo("");
                }}
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: 9,
                  padding: "8px 0",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: mode === m ? COLORS.primary : "transparent",
                  color: mode === m ? "#fff" : COLORS.mutedLight,
                }}
              >
                {m === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mode === "signup" && (
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name (e.g. Mum, Jack)"
                style={inputStyle}
              />
            )}
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              style={inputStyle}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Password"
              type="password"
              style={inputStyle}
            />

            {error && (
              <div style={{ color: "#E0554F", fontSize: 13, fontWeight: 600 }}>
                {error}
              </div>
            )}
            {info && (
              <div style={{ color: COLORS.primary, fontSize: 13, fontWeight: 600 }}>
                {info}
              </div>
            )}

            <button
              onClick={submit}
              disabled={busy}
              style={{
                background: `linear-gradient(180deg, ${COLORS.primaryLight} 0%, ${COLORS.primary} 100%)`,
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "13px 0",
                fontSize: 15,
                fontWeight: 800,
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.7 : 1,
                marginTop: 4,
              }}
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </div>
        </div>

        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            color: COLORS.muted,
            marginTop: 14,
            lineHeight: 1.5,
          }}
        >
          Everyone in the house signs up with their own email — you'll all
          see and edit the same shared chore list.
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
  padding: "12px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  color: COLORS.dark,
  outline: "none",
  background: COLORS.chip,
  boxSizing: "border-box",
  width: "100%",
};
