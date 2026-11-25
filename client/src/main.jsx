import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import QRCode from "qrcode";
import "./style.css";

const FORM_BASE = "https://docs.google.com/forms/d/e/1FAIpQLSeAFi_xfSSocH_NdOWYXkw0cF0_gHYQkEhr3lpXSgZmGCOxkQ/viewform?usp=pp_url";
const REGISTRATION_ENTRY_ID = "1612857634";
const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? window.location.origin : "http://localhost:4000");
const socket = io(API, { autoConnect: true });

function speak(text, onEnd) {
  if (!("speechSynthesis" in window)) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.94;
  utterance.pitch = 0.92;
  const voices = window.speechSynthesis.getVoices();
  const english = voices.find(v => /en-US|en-GB/i.test(v.lang) && /male|david|mark|guy/i.test(v.name))
    || voices.find(v => /en/i.test(v.lang));
  if (english) utterance.voice = english;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

function Robot() {
  const [qr, setQr] = useState("");
  const [status, setStatus] = useState("Tap anywhere to begin");
  const [expression, setExpression] = useState("idle");
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState("");
  const [reply, setReply] = useState("");
  const activeCode = useRef(null);

  useEffect(() => {
    const onComplete = ({ registrationCode }) => {
      if (!registrationCode || registrationCode !== activeCode.current) return;
      activeCode.current = null;
      setBusy(false);
      setQr("");
      setExpression("happy");
      setStatus("Registration complete!");
      speak("Thank you for registering! Please collect your goodies at the counter. Have a wonderful day!");
      setTimeout(() => { setExpression("idle"); setStatus("Tap anywhere for the next visitor"); }, 7000);
    };
    socket.on("registration:complete", onComplete);
    return () => socket.off("registration:complete", onComplete);
  }, []);

  async function startRegistration() {
    if (busy) return;
    setBusy(true);
    setExpression("welcome");
    setStatus("Welcome! Scan this QR code to register and claim your goodies.");
    speak("Hello! Welcome. Scan this QR code to register and claim your goodies.");
    const code = crypto.randomUUID();
    activeCode.current = code;
    const url = new URL(FORM_BASE);
    url.searchParams.set(`entry.${REGISTRATION_ENTRY_ID}`, code);
    try {
      const dataUrl = await QRCode.toDataURL(url.toString(), { width: 320, margin: 2, errorCorrectionLevel: "M" });
      setQr(dataUrl);
      setExpression("waiting");
      setStatus("Please scan the QR code and submit your registration.");
      fetch(`${API}/api/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationCode: code })
      }).then(r => { if (!r.ok) throw new Error("Session could not be started"); })
        .catch(() => setStatus("Connection issue: check the tablet's internet and server connection."));
    } catch {
      setBusy(false);
      setStatus("Could not create QR code. Please try again.");
    }
  }

  async function askMirai(e) {
    e?.preventDefault();
    if (!chat.trim()) return;
    const question = chat;
    setChat("");
    setReply("Thinking…");
    try {
      const r = await fetch(`${API}/api/chat`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({message:question}) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "AI request failed");
      setReply(data.reply);
      speak(data.reply);
    } catch (err) { setReply(err.message); }
  }

  return <main className="screen">
    <header><div className="brand-mark">M</div><div><div className="brand">MIRAI</div><div className="subbrand">SMART EXHIBITION ASSISTANT</div></div><span className="live">● ONLINE</span></header>
    <section className="hero">
      <div className={`robot ${expression}`} onClick={startRegistration} role="button" tabIndex="0" onKeyDown={e => (e.key==="Enter" || e.key===" ") && startRegistration()}>
        <div className="antenna"/><div className="head"><div className="eyes"><i/><i/></div><div className="mouth"/></div><div className="neck"/><div className="body"><span>MIRAI</span></div>
      </div>
      <div className="welcome-copy"><p className="eyebrow">YOUR FRIENDLY AI GUIDE</p><h1>{expression==="happy" ? "Thank you!" : "Hello, I'm MIRAI."}</h1><p className="status">{status}</p></div>
      {qr && <div className="qr-panel"><img src={qr} alt="Visitor registration QR code"/><div><strong>Scan to register</strong><small>Complete the form on your phone</small></div></div>}
      {!qr && !busy && <button className="primary" onClick={startRegistration}>Tap to register <span>→</span></button>}
      {busy && qr && <button className="secondary" onClick={()=>{activeCode.current=null;setQr("");setBusy(false);setExpression("idle");setStatus("Ready for the next visitor");}}>Cancel / Next visitor</button>}
    </section>
    <section className="assistant"><form onSubmit={askMirai}><input value={chat} onChange={e=>setChat(e.target.value)} placeholder="Ask MIRAI a question…"/><button>Ask</button></form>{reply && <p className="reply">{reply}</p>}</section>
    <footer>Powered by MIRAI · AI + IoT Exhibition</footer>
  </main>;
}

function Admin() {
  const [key,setKey]=useState(""); const [rows,setRows]=useState([]); const [error,setError]=useState("");
  async function load(e){e.preventDefault();try{const r=await fetch(`${API}/api/admin/registrations`,{headers:{"x-admin-key":key}});const d=await r.json();if(!r.ok)throw new Error(d.error);setRows(d.registrations);setError("");}catch(err){setError(err.message);}}
  useEffect(()=>{const handler=row=>setRows(old=>[row,...old]);socket.on("admin:registration",handler);return()=>socket.off("admin:registration",handler);},[]);
  return <main className="admin"><h1>MIRAI Registration Dashboard</h1><form onSubmit={load}><input type="password" placeholder="Admin key" value={key} onChange={e=>setKey(e.target.value)}/><button>Load registrations</button></form>{error&&<p>{error}</p>}<p>{rows.length} recent registrations on this server</p><div className="table-wrap"><table><thead><tr><th>Name</th><th>Company</th><th>Designation</th><th>Favourite</th><th>Submitted</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.registrationCode+i}><td>{r.name}</td><td>{r.company}</td><td>{r.designation}</td><td>{r.favorite}</td><td>{new Date(r.submittedAt).toLocaleString()}</td></tr>)}</tbody></table></div><p className="note">Google Sheets remains the permanent response record. This dashboard shows events received by the running server.</p></main>;
}

function App(){return location.pathname==="/admin"?<Admin/>:<Robot/>}
createRoot(document.getElementById("root")).render(<App/>);
