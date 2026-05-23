import { useState, useEffect, useRef, useCallback } from "react";

const STEPS_PER_KM = 1312;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function App() {
  const [screen, setScreen] = useState("home"); // home | walking | summary
  const [name, setName] = useState("");
  const [steps, setSteps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [finalData, setFinalData] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [motionAvailable, setMotionAvailable] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [myRank, setMyRank] = useState(null);

  const stepsRef = useRef(0);
  const timerRef = useRef(null);
  const lastStepTimeRef = useRef(0);
  const peakRef = useRef(false);
  const valleyRef = useRef(true);
  const smoothedRef = useRef(0);

  const handleMotion = useCallback((e) => {
    const acc = e.accelerationIncludingGravity || e.acceleration;
    if (!acc) return;
    const x = acc.x || 0, y = acc.y || 0, z = acc.z || 0;
    const mag = Math.sqrt(x * x + y * y + z * z);
    const alpha = 0.15;
    smoothedRef.current = alpha * mag + (1 - alpha) * smoothedRef.current;
    const s = smoothedRef.current;
    const now = Date.now();
    if (!peakRef.current && s > 12.5 && valleyRef.current) {
      peakRef.current = true;
      valleyRef.current = false;
      if (now - lastStepTimeRef.current > 280) {
        lastStepTimeRef.current = now;
        stepsRef.current += 1;
        setSteps(stepsRef.current);
      }
    } else if (s < 10) {
      peakRef.current = false;
      valleyRef.current = true;
    }
  }, []);

  const startListening = useCallback(async () => {
    if (typeof DeviceMotionEvent === "undefined") { setMotionAvailable(false); return false; }
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      try {
        const res = await DeviceMotionEvent.requestPermission();
        if (res !== "granted") { setPermissionDenied(true); return false; }
      } catch { setPermissionDenied(true); return false; }
    }
    window.addEventListener("devicemotion", handleMotion, { passive: true });
    return true;
  }, [handleMotion]);

  const stopListening = useCallback(() => {
    window.removeEventListener("devicemotion", handleMotion);
  }, [handleMotion]);

  const handleStart = async () => {
    if (!name.trim()) return;
    const ok = await startListening();
    stepsRef.current = 0;
    setSteps(0);
    setElapsed(0);
    setScreen("walking");
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    if (!ok) setMotionAvailable(false);
  };

  const saveToLeaderboard = useCallback(async (walkerName, walkerSteps, walkerTime) => {
    setLbLoading(true);
    try {
      // Load existing leaderboard
      let entries = [];
      try {
        const result = await window.storage.get("walkathon_leaderboard", true);
        if (result && result.value) entries = JSON.parse(result.value);
      } catch {}

      // If this name already exists, only update if new steps are higher
      const existingIdx = entries.findIndex(e => e.name.toLowerCase() === walkerName.toLowerCase());
      const newEntry = { name: walkerName, steps: walkerSteps, time: walkerTime, ts: Date.now() };

      if (existingIdx >= 0) {
        if (walkerSteps > entries[existingIdx].steps) entries[existingIdx] = newEntry;
      } else {
        entries.push(newEntry);
      }

      // Sort descending by steps
      entries.sort((a, b) => b.steps - a.steps);

      await window.storage.set("walkathon_leaderboard", JSON.stringify(entries), true);

      setLeaderboard(entries);
      const rank = entries.findIndex(e => e.name.toLowerCase() === walkerName.toLowerCase()) + 1;
      setMyRank(rank);
    } catch (err) {
      console.error("Leaderboard error:", err);
    }
    setLbLoading(false);
  }, []);

  const handleEnd = async () => {
    clearInterval(timerRef.current);
    stopListening();
    const finalSteps = stepsRef.current;
    const finalTime = elapsed;
    const dist = (finalSteps / STEPS_PER_KM).toFixed(2);
    const cal = Math.round(finalSteps * 0.04);
    setFinalData({ steps: finalSteps, time: finalTime, dist, cal });
    setScreen("summary");
    await saveToLeaderboard(name, finalSteps, finalTime);
  };

  const handleRestart = () => {
    setName(""); setSteps(0); setElapsed(0);
    setFinalData(null); setPermissionDenied(false);
    setMotionAvailable(true); setMyRank(null);
    setScreen("home");
  };

  useEffect(() => () => { clearInterval(timerRef.current); stopListening(); }, [stopListening]);

  const pulse = steps > 0 ? "pulse-ring" : "";

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .app{min-height:100dvh;background:#0a0a14;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px;font-family:'DM Sans',sans-serif;color:#fff;overflow-x:hidden;position:relative;}
        .bg-orb{position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none;}
        .orb1{width:320px;height:320px;background:rgba(99,168,255,0.12);top:-80px;right:-80px;}
        .orb2{width:260px;height:260px;background:rgba(120,255,180,0.08);bottom:60px;left:-60px;}
        .card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:32px 24px;width:100%;max-width:400px;position:relative;z-index:1;}
        .logo{font-family:'Bebas Neue',cursive;font-size:15px;letter-spacing:3px;color:rgba(255,255,255,0.4);text-align:center;margin-bottom:32px;}
        .logo span{color:#63a8ff;}
        h1{font-family:'Bebas Neue',cursive;font-size:48px;line-height:1;color:#fff;margin-bottom:8px;}
        .sub{font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:32px;}
        .input-wrap{margin-bottom:20px;}
        .input-wrap input{width:100%;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:16px 20px;font-size:16px;font-family:'DM Sans',sans-serif;color:#fff;outline:none;transition:border 0.2s;}
        .input-wrap input::placeholder{color:rgba(255,255,255,0.3);}
        .input-wrap input:focus{border-color:rgba(99,168,255,0.6);}
        .btn-start{width:100%;padding:18px;background:linear-gradient(135deg,#63a8ff,#4d8de8);border:none;border-radius:14px;font-family:'DM Sans',sans-serif;font-size:17px;font-weight:600;color:#fff;cursor:pointer;transition:transform 0.15s,opacity 0.15s;letter-spacing:0.5px;}
        .btn-start:active{transform:scale(0.97);}
        .btn-start:disabled{opacity:0.35;cursor:not-allowed;}
        .step-counter-wrap{display:flex;flex-direction:column;align-items:center;margin:12px 0 28px;}
        .step-number{font-family:'Bebas Neue',cursive;font-size:96px;line-height:1;color:#fff;position:relative;z-index:2;}
        .step-label{font-size:13px;letter-spacing:3px;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-top:-4px;}
        .ring-wrap{position:relative;display:flex;align-items:center;justify-content:center;width:200px;height:200px;margin:0 auto 8px;}
        .ring-bg{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(255,255,255,0.06);}
        .ring-pulse{position:absolute;inset:-12px;border-radius:50%;border:2px solid rgba(99,168,255,0.25);animation:none;}
        .ring-pulse.pulse-ring{animation:ripple 0.4s ease-out;}
        @keyframes ripple{0%{transform:scale(1);opacity:0.6;}100%{transform:scale(1.15);opacity:0;}}
        .greeting{font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:4px;text-align:center;}
        .walker-name{font-family:'Bebas Neue',cursive;font-size:28px;text-align:center;color:#63a8ff;margin-bottom:20px;}
        .stats-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;}
        .stat-box{background:rgba(255,255,255,0.05);border-radius:14px;padding:14px 16px;text-align:center;}
        .stat-val{font-family:'Bebas Neue',cursive;font-size:28px;color:#fff;}
        .stat-unit{font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;margin-top:2px;}
        .btn-end{width:100%;padding:18px;background:rgba(255,80,80,0.15);border:1px solid rgba(255,100,100,0.3);border-radius:14px;font-family:'DM Sans',sans-serif;font-size:17px;font-weight:600;color:#ff6b6b;cursor:pointer;transition:background 0.2s,transform 0.15s;}
        .btn-end:active{transform:scale(0.97);background:rgba(255,80,80,0.25);}
        .notice{font-size:12px;color:rgba(255,200,80,0.7);text-align:center;margin-top:16px;padding:10px 14px;background:rgba(255,200,80,0.07);border-radius:10px;border:1px solid rgba(255,200,80,0.15);line-height:1.5;}
        /* Summary */
        .summary-icon{font-size:52px;text-align:center;margin-bottom:16px;}
        .summary-steps{font-family:'Bebas Neue',cursive;font-size:80px;line-height:1;color:#63a8ff;text-align:center;}
        .summary-step-label{font-size:13px;letter-spacing:3px;color:rgba(255,255,255,0.4);text-transform:uppercase;text-align:center;margin-bottom:20px;}
        .summary-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;}
        .summary-stat{background:rgba(255,255,255,0.05);border-radius:14px;padding:14px 10px;text-align:center;}
        .summary-stat-val{font-family:'Bebas Neue',cursive;font-size:26px;color:#fff;}
        .summary-stat-label{font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;margin-top:2px;}
        /* Rank banner */
        .rank-banner{border-radius:14px;padding:14px 18px;text-align:center;margin-bottom:20px;background:rgba(99,168,255,0.1);border:1px solid rgba(99,168,255,0.2);}
        .rank-banner.top1{background:rgba(255,200,60,0.1);border-color:rgba(255,200,60,0.3);}
        .rank-banner.top2{background:rgba(180,180,200,0.1);border-color:rgba(180,180,200,0.3);}
        .rank-banner.top3{background:rgba(200,140,80,0.1);border-color:rgba(200,140,80,0.3);}
        .rank-num{font-family:'Bebas Neue',cursive;font-size:36px;color:#63a8ff;}
        .rank-banner.top1 .rank-num{color:#ffd966;}
        .rank-banner.top2 .rank-num{color:#c0c0d0;}
        .rank-banner.top3 .rank-num{color:#cd7f42;}
        .rank-label{font-size:12px;color:rgba(255,255,255,0.45);letter-spacing:2px;text-transform:uppercase;}
        /* Leaderboard */
        .lb-section{margin-bottom:20px;}
        .lb-title{font-family:'Bebas Neue',cursive;font-size:20px;letter-spacing:2px;color:rgba(255,255,255,0.6);margin-bottom:12px;text-align:center;}
        .lb-loading{text-align:center;font-size:13px;color:rgba(255,255,255,0.3);padding:20px 0;}
        .lb-row{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;margin-bottom:6px;background:rgba(255,255,255,0.04);transition:background 0.15s;}
        .lb-row.me{background:rgba(99,168,255,0.12);border:1px solid rgba(99,168,255,0.2);}
        .lb-rank{font-family:'Bebas Neue',cursive;font-size:18px;color:rgba(255,255,255,0.3);min-width:22px;text-align:center;}
        .lb-medal{font-size:18px;min-width:22px;text-align:center;}
        .lb-name{flex:1;font-size:14px;font-weight:500;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .lb-name.me-name{color:#63a8ff;}
        .lb-steps{font-family:'Bebas Neue',cursive;font-size:18px;color:rgba(255,255,255,0.7);}
        .lb-steps-unit{font-size:10px;color:rgba(255,255,255,0.3);margin-left:2px;letter-spacing:1px;}
        /* Buttons */
        .btn-again{width:100%;padding:18px;background:rgba(99,168,255,0.12);border:1px solid rgba(99,168,255,0.25);border-radius:14px;font-family:'DM Sans',sans-serif;font-size:17px;font-weight:600;color:#63a8ff;cursor:pointer;transition:background 0.2s,transform 0.15s;}
        .btn-again:active{transform:scale(0.97);}
        .divider{border:none;border-top:1px solid rgba(255,255,255,0.07);margin:20px 0;}
        .congrats{font-family:'Bebas Neue',cursive;font-size:32px;color:#fff;text-align:center;margin-bottom:4px;}
        .congrats-sub{font-size:13px;color:rgba(255,255,255,0.45);text-align:center;margin-bottom:20px;}
        .event-badge{display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;color:rgba(255,255,255,0.3);letter-spacing:2px;text-transform:uppercase;margin-top:24px;}
        .dot{width:5px;height:5px;border-radius:50%;background:rgba(99,168,255,0.4);}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        .lb-row{animation:fadeInUp 0.3s ease both;}
      `}</style>

      <div className="bg-orb orb1" />
      <div className="bg-orb orb2" />

      {/* HOME */}
      {screen === "home" && (
        <div className="card">
          <div className="logo">WALK<span>A</span>THON 2026</div>
          <h1>Ready to Walk?</h1>
          <p className="sub">Enter your name and start tracking your steps</p>
          <div className="input-wrap">
            <input
              type="text"
              placeholder="Your name..."
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && name.trim() && handleStart()}
              autoFocus
            />
          </div>
          <button className="btn-start" onClick={handleStart} disabled={!name.trim()}>
            Start Walk →
          </button>
          <div className="event-badge"><span className="dot"/>Live Step Tracker<span className="dot"/></div>
        </div>
      )}

      {/* WALKING */}
      {screen === "walking" && (
        <div className="card">
          <p className="greeting">You're walking,</p>
          <p className="walker-name">{name}</p>
          <div className="ring-wrap">
            <div className="ring-bg" />
            <div className={`ring-pulse ${pulse}`} key={steps} />
            <div className="step-counter-wrap">
              <div className="step-number">{steps}</div>
              <div className="step-label">Steps</div>
            </div>
          </div>
          <div className="stats-row">
            <div className="stat-box">
              <div className="stat-val">{formatTime(elapsed)}</div>
              <div className="stat-unit">Time</div>
            </div>
            <div className="stat-box">
              <div className="stat-val">{(steps / STEPS_PER_KM).toFixed(2)}</div>
              <div className="stat-unit">KM</div>
            </div>
          </div>
          <button className="btn-end" onClick={handleEnd}>End Walk</button>
          {!motionAvailable && (
            <div className="notice">⚠️ Motion sensor unavailable. Try on a mobile device for best results.</div>
          )}
          {permissionDenied && (
            <div className="notice">⚠️ Motion access was denied. Enable it in your browser settings and reload.</div>
          )}
          {motionAvailable && !permissionDenied && (
            <div className="notice" style={{color:"rgba(100,220,150,0.7)",background:"rgba(100,220,150,0.05)",borderColor:"rgba(100,220,150,0.15)"}}>
              ✓ Keep your phone in your pocket or hand while walking
            </div>
          )}
        </div>
      )}

      {/* SUMMARY + LEADERBOARD */}
      {screen === "summary" && finalData && (
        <div className="card">
          <div className="summary-icon">🎉</div>
          <div className="congrats">Great Walk, {name}!</div>
          <div className="congrats-sub">Here's how you did</div>

          <div className="summary-steps">{finalData.steps}</div>
          <div className="summary-step-label">Total Steps</div>

          <div className="summary-grid">
            <div className="summary-stat">
              <div className="summary-stat-val">{formatTime(finalData.time)}</div>
              <div className="summary-stat-label">Time</div>
            </div>
            <div className="summary-stat">
              <div className="summary-stat-val">{finalData.dist}</div>
              <div className="summary-stat-label">KM</div>
            </div>
            <div className="summary-stat">
              <div className="summary-stat-val">{finalData.cal}</div>
              <div className="summary-stat-label">Kcal</div>
            </div>
          </div>

          {/* Rank badge */}
          {!lbLoading && myRank && (
            <div className={`rank-banner${myRank === 1 ? " top1" : myRank === 2 ? " top2" : myRank === 3 ? " top3" : ""}`}>
              <div className="rank-num">{myRank <= 3 ? MEDALS[myRank - 1] : `#${myRank}`}</div>
              <div className="rank-label">{myRank === 1 ? "You're leading the pack!" : myRank <= 3 ? `You're #${myRank} on the leaderboard` : `Your rank on the leaderboard`}</div>
            </div>
          )}
          {lbLoading && (
            <div className="rank-banner">
              <div className="rank-label">Saving to leaderboard…</div>
            </div>
          )}

          {/* Leaderboard */}
          <div className="lb-section">
            <div className="lb-title">🏆 Leaderboard</div>
            {lbLoading && <div className="lb-loading">Loading…</div>}
            {!lbLoading && leaderboard.length === 0 && (
              <div className="lb-loading">No entries yet</div>
            )}
            {!lbLoading && leaderboard.slice(0, 10).map((entry, i) => {
              const isMe = entry.name.toLowerCase() === name.toLowerCase();
              return (
                <div key={entry.name + i} className={`lb-row${isMe ? " me" : ""}`} style={{animationDelay:`${i * 0.05}s`}}>
                  {i < 3
                    ? <span className="lb-medal">{MEDALS[i]}</span>
                    : <span className="lb-rank">{i + 1}</span>
                  }
                  <span className={`lb-name${isMe ? " me-name" : ""}`}>{entry.name}{isMe ? " (you)" : ""}</span>
                  <span className="lb-steps">{entry.steps.toLocaleString()}</span>
                  <span className="lb-steps-unit">steps</span>
                </div>
              );
            })}
          </div>

          <hr className="divider" />
          <button className="btn-again" onClick={handleRestart}>← Start a New Walk</button>
          <div className="event-badge"><span className="dot"/>Walkathon 2026<span className="dot"/></div>
        </div>
      )}
    </div>
  );
}
