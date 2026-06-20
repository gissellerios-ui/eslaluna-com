import { useState, useEffect, useCallback } from "react";

// ── Utilidades de fecha ──────────────────────────────────────────────────────
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_SHORT = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}
function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function today() {
  const d = new Date();
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

// ── Cálculo aproximado de fase lunar ────────────────────────────────────────
function getLunarPhase(dateStr) {
  const date = new Date(dateStr);
  const knownNewMoon = new Date("2000-01-06");
  const lunarCycle = 29.53058867;
  const diff = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
  const phase = ((diff % lunarCycle) + lunarCycle) % lunarCycle;
  if (phase < 1.85) return { name: "Luna Nueva", emoji: "🌑", pct: 0 };
  if (phase < 7.38) return { name: "Cuarto Creciente", emoji: "🌒", pct: 25 };
  if (phase < 11.08) return { name: "Cuarto Creciente", emoji: "🌓", pct: 40 };
  if (phase < 14.77) return { name: "Luna Llena", emoji: "🌕", pct: 100 };
  if (phase < 18.46) return { name: "Cuarto Menguante", emoji: "🌖", pct: 75 };
  if (phase < 22.15) return { name: "Cuarto Menguante", emoji: "🌗", pct: 60 };
  if (phase < 25.84) return { name: "Cuarto Menguante", emoji: "🌘", pct: 35 };
  return { name: "Luna Nueva", emoji: "🌑", pct: 5 };
}

function getLunarPhaseFull(dateStr) {
  const date = new Date(dateStr);
  const knownNewMoon = new Date("2000-01-06");
  const lunarCycle = 29.53058867;
  const diff = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
  const phase = ((diff % lunarCycle) + lunarCycle) % lunarCycle;
  return phase;
}

// ── Predicción de ciclo ──────────────────────────────────────────────────────
function predictCycleDays(lastPeriodStart, cycleLength, periodLength) {
  const days = {};
  const start = new Date(lastPeriodStart);
  for (let c = 0; c < 3; c++) {
    const cycleStart = new Date(start);
    cycleStart.setDate(cycleStart.getDate() + c * cycleLength);
    for (let d = 0; d < periodLength; d++) {
      const dd = new Date(cycleStart);
      dd.setDate(dd.getDate() + d);
      const key = dd.toISOString().split("T")[0];
      days[key] = "period";
    }
    // Ventana fértil (~día 10-16 del ciclo)
    for (let d = 10; d <= 16; d++) {
      const dd = new Date(cycleStart);
      dd.setDate(dd.getDate() + d);
      const key = dd.toISOString().split("T")[0];
      if (!days[key]) days[key] = "fertile";
    }
    // Ovulación (~día 14)
    const ov = new Date(cycleStart);
    ov.setDate(ov.getDate() + 14);
    const ovKey = ov.toISOString().split("T")[0];
    days[ovKey] = "ovulation";
  }
  return days;
}

// ── Datos de signos zodiacales ───────────────────────────────────────────────
function getZodiac(month, day) {
  const signs = [
    { name: "Capricornio", emoji: "♑", end: [1, 19] },
    { name: "Acuario", emoji: "♒", end: [2, 18] },
    { name: "Piscis", emoji: "♓", end: [3, 20] },
    { name: "Aries", emoji: "♈", end: [4, 19] },
    { name: "Tauro", emoji: "♉", end: [5, 20] },
    { name: "Géminis", emoji: "♊", end: [6, 20] },
    { name: "Cáncer", emoji: "♋", end: [7, 22] },
    { name: "Leo", emoji: "♌", end: [8, 22] },
    { name: "Virgo", emoji: "♍", end: [9, 22] },
    { name: "Libra", emoji: "♎", end: [10, 22] },
    { name: "Escorpio", emoji: "♏", end: [11, 21] },
    { name: "Sagitario", emoji: "♐", end: [12, 21] },
    { name: "Capricornio", emoji: "♑", end: [12, 31] },
  ];
  for (const s of signs) {
    if (month < s.end[0] || (month === s.end[0] && day <= s.end[1])) return s;
  }
  return signs[0];
}

// ── Síntomas disponibles ─────────────────────────────────────────────────────
const SYMPTOM_CATEGORIES = [
  {
    cat: "Estado de ánimo",
    emoji: "💫",
    items: ["Feliz", "Triste", "Ansiosa", "Irritable", "Sensible", "Calmada", "Energética", "Exhausta"],
  },
  {
    cat: "Síntomas físicos",
    emoji: "🌸",
    items: ["Cólicos", "Dolor de cabeza", "Hinchazón", "Sensibilidad en senos", "Náuseas", "Fatiga", "Acné", "Dolor de espalda"],
  },
  {
    cat: "Flujo",
    emoji: "💧",
    items: ["Ligero", "Moderado", "Abundante", "Con coágulos", "Sin flujo"],
  },
  {
    cat: "Actividad",
    emoji: "✨",
    items: ["Ejercicio", "Yoga", "Meditación", "Descanso", "Trabajo intenso", "Social"],
  },
];

// ── Datos de la Luna por fase ────────────────────────────────────────────────
const LUNA_INFO = [
  {
    phase: "Luna Nueva",
    emoji: "🌑",
    color: "#1a1a2e",
    title: "Tiempo de Intención",
    desc: "La Luna Nueva marca el inicio de un nuevo ciclo. Es el momento perfecto para establecer intenciones, sembrar nuevos proyectos y conectar con tus deseos más profundos. Tu energía está hacia adentro.",
    energy: "Introspectiva",
    ritual: "Escribe 3 intenciones para este ciclo lunar. Enciende una vela blanca y medita en silencio.",
    affirmation: "Soy un nuevo comienzo. Cada ciclo me trae nuevas oportunidades.",
  },
  {
    phase: "Cuarto Creciente",
    emoji: "🌓",
    color: "#2d1b69",
    title: "Tiempo de Acción",
    desc: "La Luna Creciente nos impulsa hacia adelante. Es momento de actuar sobre las intenciones sembradas. Tu energía aumenta y la creatividad florece. Aprovecha este impulso cósmico.",
    energy: "Activa y creativa",
    ritual: "Haz una lista de acciones concretas. Mueve tu cuerpo con intención — danza, camina, crea.",
    affirmation: "Avanzo con confianza hacia mis sueños. El universo me apoya.",
  },
  {
    phase: "Luna Llena",
    emoji: "🌕",
    color: "#4a0e8f",
    title: "Tiempo de Plenitud",
    desc: "La Luna Llena ilumina todo lo que has cultivado. Es momento de celebrar, agradecer y también de soltar lo que ya no te sirve. Tu intuición está en su punto más alto.",
    energy: "Intensa y magnética",
    ritual: "Sal a la luz de la luna. Escribe lo que quieres liberar y quémalo con seguridad. Agradece.",
    affirmation: "Estoy completa. Libero lo que no me sirve con amor y gratitud.",
  },
  {
    phase: "Cuarto Menguante",
    emoji: "🌗",
    color: "#1e3a5f",
    title: "Tiempo de Reflexión",
    desc: "La Luna Menguante nos invita a la reflexión y el descanso. Es momento de integrar las lecciones aprendidas y prepararse para el nuevo ciclo. Honra tu necesidad de descanso.",
    energy: "Reflexiva y restauradora",
    ritual: "Tómate un baño relajante. Journalea sobre lo aprendido. Descansa sin culpa.",
    affirmation: "Me permito descansar. Confío en los ciclos de la vida.",
  },
];

// ── Mensajes del ciclo ───────────────────────────────────────────────────────
function getCycleMessage(dayInCycle, cycleLength) {
  const pct = dayInCycle / cycleLength;
  if (dayInCycle <= 5) return { phase: "Menstruación", color: "#e05c8a", msg: "Tu cuerpo está en su fase de renovación. Descansa, date permiso de sentir. Eres poderosa incluso en tu vulnerabilidad." };
  if (pct <= 0.35) return { phase: "Fase Folicular", color: "#a78bfa", msg: "Tu energía regresa. La creatividad florece y te sientes más social. ¡Es tu momento de brillar!" };
  if (pct <= 0.55) return { phase: "Ovulación", color: "#f59e0b", msg: "Estás en tu pico de energía y magnetismo. Tu intuición y comunicación están al máximo. ¡Aprovecha esta energía!" };
  return { phase: "Fase Lútea", color: "#6366f1", msg: "Tu cuerpo se prepara para el próximo ciclo. Honra tu necesidad de introspección y descanso. Eres sabia." };
}

// ── Generador de estrellas ───────────────────────────────────────────────────
function generateStars(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2.5 + 0.5,
    opacity: Math.random() * 0.7 + 0.3,
    delay: Math.random() * 4,
  }));
}
const STARS = generateStars(80);

// ── App Principal ────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  // Perfil del usuario
  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("eslaluna_profile")) || null;
    } catch {
      return null;
    }
  });

  // Datos del ciclo
  const [cycleData, setCycleData] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("eslaluna_cycle")) || {
        lastPeriodStart: today(),
        cycleLength: 28,
        periodLength: 5,
      };
    } catch {
      return { lastPeriodStart: today(), cycleLength: 28, periodLength: 5 };
    }
  });

  // Síntomas registrados
  const [symptoms, setSymptoms] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("eslaluna_symptoms")) || {};
    } catch {
      return {};
    }
  });

  // Estado del calendario
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(today());

  // Modal de síntomas
  const [showSymModal, setShowSymModal] = useState(false);
  const [symDate, setSymDate] = useState(today());

  // Onboarding temp
  const [obName, setObName] = useState("");
  const [obBirthday, setObBirthday] = useState("");
  const [obLastPeriod, setObLastPeriod] = useState(today());
  const [obCycleLen, setObCycleLen] = useState(28);
  const [obPeriodLen, setObPeriodLen] = useState(5);

  // Persistencia
  useEffect(() => {
    if (profile) localStorage.setItem("eslaluna_profile", JSON.stringify(profile));
  }, [profile]);
  useEffect(() => {
    localStorage.setItem("eslaluna_cycle", JSON.stringify(cycleData));
  }, [cycleData]);
  useEffect(() => {
    localStorage.setItem("eslaluna_symptoms", JSON.stringify(symptoms));
  }, [symptoms]);

  // Mostrar onboarding si no hay perfil
  useEffect(() => {
    if (!profile) setShowOnboarding(true);
  }, []);

  // Cálculos del ciclo
  const cycleDayMap = predictCycleDays(
    cycleData.lastPeriodStart,
    cycleData.cycleLength,
    cycleData.periodLength
  );

  const todayStr = today();
  const startDate = new Date(cycleData.lastPeriodStart);
  const todayDate = new Date(todayStr);
  const diffMs = todayDate - startDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const dayInCycle = ((diffDays % cycleData.cycleLength) + cycleData.cycleLength) % cycleData.cycleLength + 1;
  const daysUntilNext = cycleData.cycleLength - dayInCycle + 1;
  const cycleInfo = getCycleMessage(dayInCycle, cycleData.cycleLength);
  const lunarToday = getLunarPhase(todayStr);
  const lunarInfoToday = LUNA_INFO.find(l => l.phase === lunarToday.name) || LUNA_INFO[0];

  // ── Completar onboarding ─────────────────────────────────────────────────
  function finishOnboarding() {
    const bday = new Date(obBirthday);
    const zodiac = obBirthday
      ? getZodiac(bday.getMonth() + 1, bday.getDate())
      : { name: "Desconocido", emoji: "⭐" };
    setProfile({ name: obName || "Lunita", birthday: obBirthday, zodiac });
    setCycleData({ lastPeriodStart: obLastPeriod, cycleLength: obCycleLen, periodLength: obPeriodLen });
    setShowOnboarding(false);
  }

  // ── Toggle síntoma ───────────────────────────────────────────────────────
  function toggleSymptom(dateStr, symptom) {
    setSymptoms(prev => {
      const existing = prev[dateStr] || [];
      const updated = existing.includes(symptom)
        ? existing.filter(s => s !== symptom)
        : [...existing, symptom];
      return { ...prev, [dateStr]: updated };
    });
  }

  // ── Estilos base ─────────────────────────────────────────────────────────
  const styles = {
    root: {
      minHeight: "100dvh",
      background: "linear-gradient(135deg, #0d0d1a 0%, #1a0a2e 40%, #0d1a2e 100%)",
      color: "#e8e0f5",
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      maxWidth: 430,
      margin: "0 auto",
      position: "relative",
      overflow: "hidden",
    },
    stars: {
      position: "fixed",
      top: 0, left: "50%",
      transform: "translateX(-50%)",
      width: "100%",
      maxWidth: 430,
      height: "100%",
      pointerEvents: "none",
      zIndex: 0,
    },
    content: {
      position: "relative",
      zIndex: 1,
      minHeight: "100dvh",
      paddingBottom: 80,
    },
    navbar: {
      position: "fixed",
      bottom: 0,
      left: "50%",
      transform: "translateX(-50%)",
      width: "100%",
      maxWidth: 430,
      background: "rgba(13,13,26,0.95)",
      backdropFilter: "blur(20px)",
      borderTop: "1px solid rgba(167,139,250,0.2)",
      display: "flex",
      justifyContent: "space-around",
      padding: "8px 0 12px",
      zIndex: 100,
    },
    navBtn: (active) => ({
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "4px 12px",
      borderRadius: 12,
      transition: "all 0.2s",
      color: active ? "#c084fc" : "#6b6b8a",
    }),
    navIcon: { fontSize: 22 },
    navLabel: (active) => ({
      fontSize: 10,
      fontWeight: active ? 700 : 400,
      color: active ? "#c084fc" : "#6b6b8a",
    }),
  };

  // ── Onboarding ───────────────────────────────────────────────────────────
  if (showOnboarding) {
    return (
      <div style={styles.root}>
        <StarField />
        <div style={{ ...styles.content, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: "24px 24px" }}>
          {onboardingStep === 0 && (
            <OnboardingWelcome onNext={() => setOnboardingStep(1)} />
          )}
          {onboardingStep === 1 && (
            <OnboardingName
              name={obName} setName={setObName}
              birthday={obBirthday} setBirthday={setObBirthday}
              onNext={() => setOnboardingStep(2)}
            />
          )}
          {onboardingStep === 2 && (
            <OnboardingCycle
              lastPeriod={obLastPeriod} setLastPeriod={setObLastPeriod}
              cycleLen={obCycleLen} setCycleLen={setObCycleLen}
              periodLen={obPeriodLen} setPeriodLen={setObPeriodLen}
              onFinish={finishOnboarding}
            />
          )}
          {/* Indicador de pasos */}
          <div style={{ display: "flex", gap: 8, marginTop: 32 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: i === onboardingStep ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === onboardingStep ? "#c084fc" : "rgba(192,132,252,0.3)",
                transition: "all 0.3s",
              }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <StarField />
      <div style={styles.content}>
        {screen === "home" && (
          <HomeScreen
            profile={profile}
            dayInCycle={dayInCycle}
            cycleData={cycleData}
            daysUntilNext={daysUntilNext}
            cycleInfo={cycleInfo}
            lunarToday={lunarToday}
            lunarInfoToday={lunarInfoToday}
            todayStr={todayStr}
            symptoms={symptoms}
            onLogSymptoms={() => { setSymDate(todayStr); setShowSymModal(true); }}
            onGoCalendar={() => setScreen("calendar")}
          />
        )}
        {screen === "calendar" && (
          <CalendarScreen
            calYear={calYear} calMonth={calMonth}
            setCalYear={setCalYear} setCalMonth={setCalMonth}
            cycleDayMap={cycleDayMap}
            todayStr={todayStr}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            symptoms={symptoms}
            onLogSymptoms={(d) => { setSymDate(d); setShowSymModal(true); }}
          />
        )}
        {screen === "symptoms" && (
          <SymptomsScreen
            symptoms={symptoms}
            todayStr={todayStr}
            onLogToday={() => { setSymDate(todayStr); setShowSymModal(true); }}
          />
        )}
        {screen === "luna" && (
          <LunaScreen lunarToday={lunarToday} lunarInfoToday={lunarInfoToday} />
        )}
        {screen === "profile" && (
          <ProfileScreen
            profile={profile}
            cycleData={cycleData}
            setCycleData={setCycleData}
            dayInCycle={dayInCycle}
            symptoms={symptoms}
            onResetOnboarding={() => { setShowOnboarding(true); setOnboardingStep(0); }}
          />
        )}
      </div>

      {/* Navbar */}
      <nav style={styles.navbar}>
        {[
          { id: "home", icon: "🌙", label: "Inicio" },
          { id: "calendar", icon: "📅", label: "Calendario" },
          { id: "symptoms", icon: "🌸", label: "Síntomas" },
          { id: "luna", icon: "✨", label: "Luna" },
          { id: "profile", icon: "👤", label: "Perfil" },
        ].map(n => (
          <button key={n.id} style={styles.navBtn(screen === n.id)} onClick={() => setScreen(n.id)}>
            <span style={styles.navIcon}>{n.icon}</span>
            <span style={styles.navLabel(screen === n.id)}>{n.label}</span>
          </button>
        ))}
      </nav>

      {/* Modal de síntomas */}
      {showSymModal && (
        <SymptomsModal
          dateStr={symDate}
          symptoms={symptoms[symDate] || []}
          onToggle={(s) => toggleSymptom(symDate, s)}
          onClose={() => setShowSymModal(false)}
        />
      )}
    </div>
  );
}

// ── Componente: Estrellas de fondo ───────────────────────────────────────────
function StarField() {
  return (
    <svg style={{
      position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 430, height: "100%",
      pointerEvents: "none", zIndex: 0,
    }}>
      {STARS.map(s => (
        <circle
          key={s.id}
          cx={`${s.x}%`} cy={`${s.y}%`}
          r={s.size}
          fill="white"
          opacity={s.opacity}
          style={{
            animation: `twinkle ${2 + s.delay}s ease-in-out infinite alternate`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes twinkle {
          from { opacity: 0.1; }
          to { opacity: 0.9; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(192,132,252,0.3); }
          50% { box-shadow: 0 0 40px rgba(192,132,252,0.7), 0 0 80px rgba(192,132,252,0.3); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(192,132,252,0.3); border-radius: 4px; }
        input, select, textarea { outline: none; }
      `}</style>
    </svg>
  );
}

// ── Componente: Card base ────────────────────────────────────────────────────
function Card({ children, style = {}, gradient }) {
  return (
    <div style={{
      background: gradient || "rgba(255,255,255,0.05)",
      backdropFilter: "blur(10px)",
      borderRadius: 20,
      border: "1px solid rgba(192,132,252,0.15)",
      padding: 20,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Componente: Botón primario ───────────────────────────────────────────────
function PrimaryBtn({ children, onClick, style = {}, disabled }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov
          ? "linear-gradient(135deg, #a855f7, #ec4899)"
          : "linear-gradient(135deg, #9333ea, #db2777)",
        color: "#fff",
        border: "none",
        borderRadius: 50,
        padding: "14px 32px",
        fontSize: 16,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.2s",
        transform: hov ? "scale(1.02)" : "scale(1)",
        boxShadow: hov ? "0 8px 30px rgba(147,51,234,0.5)" : "0 4px 20px rgba(147,51,234,0.3)",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── ONBOARDING: Bienvenida ───────────────────────────────────────────────────
function OnboardingWelcome({ onNext }) {
  return (
    <div style={{ textAlign: "center", animation: "fadeInUp 0.6s ease" }}>
      <div style={{
        fontSize: 80,
        animation: "float 3s ease-in-out infinite",
        display: "block",
        marginBottom: 24,
      }}>🌙</div>
      <h1 style={{
        fontSize: 38,
        fontWeight: 900,
        background: "linear-gradient(135deg, #c084fc, #f9a8d4, #60a5fa)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        marginBottom: 12,
        lineHeight: 1.2,
      }}>Es La Luna</h1>
      <p style={{ color: "#a78bfa", fontSize: 16, marginBottom: 8, fontWeight: 500 }}>by Multisensiversa</p>
      <p style={{
        color: "#c4b5fd",
        fontSize: 16,
        lineHeight: 1.7,
        maxWidth: 320,
        marginBottom: 40,
      }}>
        Conecta con los ciclos de tu cuerpo y la energía de la Luna. Tu compañera cósmica para el bienestar menstrual.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 280 }}>
        <div style={{ background: "rgba(192,132,252,0.1)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>🌸</span>
          <span style={{ color: "#e9d5ff", fontSize: 14 }}>Seguimiento de ciclo menstrual</span>
        </div>
        <div style={{ background: "rgba(192,132,252,0.1)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>🌕</span>
          <span style={{ color: "#e9d5ff", fontSize: 14 }}>Sincronización con fases lunares</span>
        </div>
        <div style={{ background: "rgba(192,132,252,0.1)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>💫</span>
          <span style={{ color: "#e9d5ff", fontSize: 14 }}>Registro de síntomas y estados</span>
        </div>
      </div>
      <PrimaryBtn onClick={onNext} style={{ marginTop: 40, width: "100%", maxWidth: 280 }}>
        Comenzar mi viaje ✨
      </PrimaryBtn>
    </div>
  );
}

// ── ONBOARDING: Nombre y cumpleaños ─────────────────────────────────────────
function OnboardingName({ name, setName, birthday, setBirthday, onNext }) {
  const inputStyle = {
    width: "100%",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(192,132,252,0.3)",
    borderRadius: 14,
    padding: "14px 18px",
    color: "#e8e0f5",
    fontSize: 16,
    outline: "none",
  };
  return (
    <div style={{ width: "100%", maxWidth: 340, animation: "fadeInUp 0.6s ease" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 50, marginBottom: 16 }}>🌟</div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: "#e9d5ff", marginBottom: 8 }}>Cuéntanos de ti</h2>
        <p style={{ color: "#a78bfa", fontSize: 14 }}>Personalizaremos tu experiencia lunar</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ color: "#c4b5fd", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>¿Cómo te llamas?</label>
          <input
            style={inputStyle}
            placeholder="Tu nombre o apodo"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div>
          <label style={{ color: "#c4b5fd", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
            Fecha de nacimiento <span style={{ color: "#7c6b9a", fontWeight: 400 }}>(opcional)</span>
          </label>
          <input
            style={inputStyle}
            type="date"
            value={birthday}
            onChange={e => setBirthday(e.target.value)}
          />
        </div>
        {birthday && (() => {
          const d = new Date(birthday);
          const z = getZodiac(d.getMonth() + 1, d.getDate());
          return (
            <div style={{
              background: "linear-gradient(135deg, rgba(147,51,234,0.2), rgba(219,39,119,0.2))",
              borderRadius: 14, padding: "12px 16px",
              border: "1px solid rgba(192,132,252,0.3)",
              textAlign: "center",
            }}>
              <span style={{ fontSize: 28 }}>{z.emoji}</span>
              <p style={{ color: "#e9d5ff", fontWeight: 600, marginTop: 4 }}>Eres {z.name}</p>
            </div>
          );
        })()}
        <PrimaryBtn onClick={onNext} style={{ marginTop: 8 }}>
          Continuar →
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ── ONBOARDING: Datos del ciclo ──────────────────────────────────────────────
function OnboardingCycle({ lastPeriod, setLastPeriod, cycleLen, setCycleLen, periodLen, setPeriodLen, onFinish }) {
  const inputStyle = {
    width: "100%",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(192,132,252,0.3)",
    borderRadius: 14,
    padding: "14px 18px",
    color: "#e8e0f5",
    fontSize: 16,
  };
  return (
    <div style={{ width: "100%", maxWidth: 340, animation: "fadeInUp 0.6s ease" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 50, marginBottom: 16 }}>🌸</div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: "#e9d5ff", marginBottom: 8 }}>Tu ciclo menstrual</h2>
        <p style={{ color: "#a78bfa", fontSize: 14 }}>Predeciremos tu próximo período</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ color: "#c4b5fd", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>¿Cuándo comenzó tu último período?</label>
          <input style={inputStyle} type="date" value={lastPeriod} onChange={e => setLastPeriod(e.target.value)} />
        </div>
        <div>
          <label style={{ color: "#c4b5fd", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
            Duración del ciclo: <span style={{ color: "#e9d5ff" }}>{cycleLen} días</span>
          </label>
          <input style={{ ...inputStyle, padding: "8px 18px" }} type="range" min={21} max={40} value={cycleLen} onChange={e => setCycleLen(+e.target.value)} />
          <div style={{ display: "flex", justifyContent: "space-between", color: "#7c6b9a", fontSize: 11, marginTop: 4 }}>
            <span>21 días</span><span>40 días</span>
          </div>
        </div>
        <div>
          <label style={{ color: "#c4b5fd", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
            Duración del período: <span style={{ color: "#e9d5ff" }}>{periodLen} días</span>
          </label>
          <input style={{ ...inputStyle, padding: "8px 18px" }} type="range" min={2} max={10} value={periodLen} onChange={e => setPeriodLen(+e.target.value)} />
          <div style={{ display: "flex", justifyContent: "space-between", color: "#7c6b9a", fontSize: 11, marginTop: 4 }}>
            <span>2 días</span><span>10 días</span>
          </div>
        </div>
        <PrimaryBtn onClick={onFinish} style={{ marginTop: 8 }}>
          🌙 Comenzar con Es La Luna
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ── PANTALLA: Inicio ─────────────────────────────────────────────────────────
function HomeScreen({ profile, dayInCycle, cycleData, daysUntilNext, cycleInfo, lunarToday, lunarInfoToday, todayStr, symptoms, onLogSymptoms, onGoCalendar }) {
  const todaySymptoms = symptoms[todayStr] || [];
  const todayDate = new Date();
  const dateLabel = todayDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{ padding: "0 16px", paddingTop: 0, overflowY: "auto", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{
        padding: "56px 4px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}>
        <div>
          <p style={{ color: "#a78bfa", fontSize: 13, textTransform: "capitalize" }}>{dateLabel}</p>
          <h1 style={{
            fontSize: 28,
            fontWeight: 900,
            background: "linear-gradient(135deg, #c084fc, #f9a8d4)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            Hola, {profile?.name || "Lunita"} {lunarToday.emoji}
          </h1>
        </div>
        {profile?.zodiac && (
          <div style={{
            background: "rgba(192,132,252,0.15)",
            borderRadius: 12,
            padding: "8px 12px",
            textAlign: "center",
            border: "1px solid rgba(192,132,252,0.2)",
          }}>
            <div style={{ fontSize: 22 }}>{profile.zodiac.emoji}</div>
            <div style={{ fontSize: 9, color: "#a78bfa", fontWeight: 600 }}>{profile.zodiac.name}</div>
          </div>
        )}
      </div>

      {/* Luna principal */}
      <Card style={{ textAlign: "center", marginBottom: 16, background: "linear-gradient(135deg, rgba(88,28,135,0.4), rgba(30,58,95,0.4))", padding: "32px 24px" }}>
        <div style={{ fontSize: 80, animation: "float 4s ease-in-out infinite", display: "block", marginBottom: 16 }}>
          {lunarToday.emoji}
        </div>
        <h2 style={{ color: "#e9d5ff", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{lunarToday.name}</h2>
        <p style={{ color: "#a78bfa", fontSize: 13 }}>{lunarInfoToday.energy}</p>
      </Card>

      {/* Estado del ciclo */}
      <Card style={{ marginBottom: 16, background: `linear-gradient(135deg, ${cycleInfo.color}33, rgba(13,13,26,0.8))`, border: `1px solid ${cycleInfo.color}44` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <p style={{ color: "#a78bfa", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Tu ciclo hoy</p>
            <h3 style={{ color: "#e9d5ff", fontSize: 20, fontWeight: 800 }}>{cycleInfo.phase}</h3>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%",
              background: `linear-gradient(135deg, ${cycleInfo.color}44, ${cycleInfo.color}88)`,
              border: `3px solid ${cycleInfo.color}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column",
              animation: "pulse-glow 3s ease-in-out infinite",
            }}>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 22, lineHeight: 1 }}>{dayInCycle}</span>
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 9 }}>día</span>
            </div>
          </div>
        </div>
        <p style={{ color: "#c4b5fd", fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{cycleInfo.msg}</p>
        {/* Barra de progreso */}
        <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, height: 8, marginBottom: 8 }}>
          <div style={{
            background: `linear-gradient(90deg, ${cycleInfo.color}, ${cycleInfo.color}aa)`,
            borderRadius: 8, height: 8,
            width: `${(dayInCycle / cycleData.cycleLength) * 100}%`,
            transition: "width 0.5s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#7c6b9a", fontSize: 12 }}>Día {dayInCycle} de {cycleData.cycleLength}</span>
          <span style={{ color: cycleInfo.color, fontSize: 12, fontWeight: 600 }}>
            {daysUntilNext <= 0 ? "¡Hoy comienza!" : `Próximo en ${daysUntilNext} días`}
          </span>
        </div>
      </Card>

      {/* Stats rápidas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <StatCard emoji="🌸" label="Período en" value={`${daysUntilNext <= 0 ? "Hoy" : daysUntilNext + "d"}`} color="#e05c8a" />
        <StatCard emoji="🌡️" label="Ciclo" value={`${cycleData.cycleLength}d`} color="#a78bfa" />
        <StatCard emoji={lunarToday.emoji} label="Luna" value={lunarToday.name.split(" ")[1] || lunarToday.name.split(" ")[0]} color="#60a5fa" />
      </div>

      {/* Registrar hoy */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ color: "#e9d5ff", fontWeight: 700, fontSize: 16 }}>¿Cómo te sientes hoy?</h3>
          {todaySymptoms.length > 0 && (
            <span style={{ background: "rgba(192,132,252,0.2)", color: "#c084fc", borderRadius: 20, padding: "2px 10px", fontSize: 12 }}>
              {todaySymptoms.length} registros
            </span>
          )}
        </div>
        {todaySymptoms.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {todaySymptoms.slice(0, 6).map(s => (
              <span key={s} style={{
                background: "rgba(192,132,252,0.15)",
                border: "1px solid rgba(192,132,252,0.3)",
                color: "#c084fc", borderRadius: 20, padding: "4px 10px", fontSize: 12,
              }}>{s}</span>
            ))}
          </div>
        ) : (
          <p style={{ color: "#6b6b8a", fontSize: 13, marginBottom: 12 }}>Aún no has registrado cómo te sientes</p>
        )}
        <PrimaryBtn onClick={onLogSymptoms} style={{ width: "100%", padding: "12px", fontSize: 14 }}>
          + Registrar síntomas y estado
        </PrimaryBtn>
      </Card>

      {/* Mensaje lunar del día */}
      <Card style={{ marginBottom: 16, background: "linear-gradient(135deg, rgba(88,28,135,0.3), rgba(20,20,40,0.5))" }}>
        <p style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>✨ Mensaje lunar del día</p>
        <p style={{ color: "#c4b5fd", fontSize: 14, lineHeight: 1.7, fontStyle: "italic" }}>
          "{lunarInfoToday.affirmation}"
        </p>
      </Card>

      {/* Acceso rápido al calendario */}
      <button onClick={onGoCalendar} style={{
        width: "100%",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(192,132,252,0.2)",
        borderRadius: 16,
        padding: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        marginBottom: 24,
        color: "#e9d5ff",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>📅</span>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontWeight: 700, fontSize: 14 }}>Ver calendario completo</p>
            <p style={{ color: "#7c6b9a", fontSize: 12 }}>Próximos ciclos y predicciones</p>
          </div>
        </div>
        <span style={{ color: "#a78bfa", fontSize: 20 }}>→</span>
      </button>
    </div>
  );
}

function StatCard({ emoji, label, value, color }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(192,132,252,0.15)",
      borderRadius: 16,
      padding: "14px 10px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{emoji}</div>
      <div style={{ color, fontWeight: 800, fontSize: 15 }}>{value}</div>
      <div style={{ color: "#6b6b8a", fontSize: 11, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── PANTALLA: Calendario ─────────────────────────────────────────────────────
function CalendarScreen({ calYear, calMonth, setCalYear, setCalMonth, cycleDayMap, todayStr, selectedDate, setSelectedDate, symptoms, onLogSymptoms }) {
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function prevMonth() {
    if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11); }
    else setCalMonth(calMonth - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0); }
    else setCalMonth(calMonth + 1);
  }

  const selSymptoms = symptoms[selectedDate] || [];
  const selCycleType = cycleDayMap[selectedDate];
  const selLunar = getLunarPhase(selectedDate);

  const cycleColor = (type) => {
    if (type === "period") return "#e05c8a";
    if (type === "ovulation") return "#f59e0b";
    if (type === "fertile") return "#34d399";
    return null;
  };

  return (
    <div style={{ padding: "0 16px", overflowY: "auto", minHeight: "100dvh" }}>
      <div style={{ paddingTop: 56, paddingBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#e9d5ff" }}>Calendario 📅</h1>
        <p style={{ color: "#7c6b9a", fontSize: 13 }}>Sigue tu ciclo mes a mes</p>
      </div>

      {/* Leyenda */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { color: "#e05c8a", label: "Período" },
          { color: "#34d399", label: "Fértil" },
          { color: "#f59e0b", label: "Ovulación" },
          { color: "#c084fc", label: "Hoy" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: l.color }} />
            <span style={{ color: "#7c6b9a", fontSize: 11 }}>{l.label}</span>
          </div>
        ))}
      </div>

      <Card style={{ marginBottom: 16 }}>
        {/* Nav mes */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button onClick={prevMonth} style={{ background: "rgba(192,132,252,0.15)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#c084fc", fontSize: 18 }}>‹</button>
          <h3 style={{ color: "#e9d5ff", fontWeight: 700, fontSize: 17 }}>{MONTHS[calMonth]} {calYear}</h3>
          <button onClick={nextMonth} style={{ background: "rgba(192,132,252,0.15)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#c084fc", fontSize: 18 }}>›</button>
        </div>

        {/* Días de semana */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 8 }}>
          {DAYS_SHORT.map(d => (
            <div key={d} style={{ textAlign: "center", color: "#6b6b8a", fontSize: 11, fontWeight: 700, padding: "4px 0" }}>{d}</div>
          ))}
        </div>

        {/* Días */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const ds = toDateStr(calYear, calMonth, d);
            const ctype = cycleDayMap[ds];
            const isToday = ds === todayStr;
            const isSel = ds === selectedDate;
            const hasSymptom = (symptoms[ds] || []).length > 0;
            const cc = cycleColor(ctype);

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(ds)}
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  borderRadius: "50%",
                  border: isSel ? "2px solid #c084fc" : isToday ? "2px solid #a78bfa" : "2px solid transparent",
                  background: isSel
                    ? "rgba(192,132,252,0.4)"
                    : cc
                      ? `${cc}33`
                      : "transparent",
                  cursor: "pointer",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 1,
                  transition: "all 0.15s",
                }}
              >
                <span style={{
                  color: cc ? cc : isToday ? "#c084fc" : "#d4c8f0",
                  fontWeight: isToday || isSel ? 800 : 400,
                  fontSize: 13,
                }}>{d}</span>
                {hasSymptom && (
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#60a5fa" }} />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Detalle del día seleccionado */}
      {selectedDate && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <p style={{ color: "#a78bfa", fontSize: 12, fontWeight: 600 }}>Día seleccionado</p>
              <h3 style={{ color: "#e9d5ff", fontWeight: 800, fontSize: 18 }}>
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
              </h3>
            </div>
            <span style={{ fontSize: 28 }}>{selLunar.emoji}</span>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {selCycleType && (
              <span style={{
                background: `${cycleColor(selCycleType)}22`,
                border: `1px solid ${cycleColor(selCycleType)}`,
                color: cycleColor(selCycleType),
                borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600,
              }}>
                {selCycleType === "period" ? "🩸 Período" : selCycleType === "ovulation" ? "🌟 Ovulación" : "🌿 Fértil"}
              </span>
            )}
            <span style={{
              background: "rgba(96,165,250,0.15)",
              border: "1px solid rgba(96,165,250,0.3)",
              color: "#60a5fa",
              borderRadius: 20, padding: "4px 12px", fontSize: 12,
            }}>
              {selLunar.name}
            </span>
          </div>

          {selSymptoms.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <p style={{ color: "#7c6b9a", fontSize: 12, marginBottom: 6 }}>Síntomas registrados:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {selSymptoms.map(s => (
                  <span key={s} style={{
                    background: "rgba(192,132,252,0.15)",
                    border: "1px solid rgba(192,132,252,0.3)",
                    color: "#c084fc", borderRadius: 20, padding: "3px 10px", fontSize: 12,
                  }}>{s}</span>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: "#6b6b8a", fontSize: 13, marginBottom: 12 }}>Sin síntomas registrados</p>
          )}

          <PrimaryBtn onClick={() => onLogSymptoms(selectedDate)} style={{ width: "100%", padding: "10px", fontSize: 13 }}>
            {selSymptoms.length > 0 ? "Editar registro" : "+ Registrar este día"}
          </PrimaryBtn>
        </Card>
      )}
    </div>
  );
}

// ── PANTALLA: Síntomas ───────────────────────────────────────────────────────
function SymptomsScreen({ symptoms, todayStr, onLogToday }) {
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });

  // Frecuencia de síntomas (todo el historial)
  const freq = {};
  Object.values(symptoms).flat().forEach(s => { freq[s] = (freq[s] || 0) + 1; });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const emojiForSymptom = (s) => {
    const map = {
      "Feliz": "😊", "Triste": "😢", "Ansiosa": "😰", "Irritable": "😤",
      "Sensible": "💧", "Calmada": "😌", "Energética": "⚡", "Exhausta": "😴",
      "Cólicos": "💢", "Dolor de cabeza": "🤕", "Hinchazón": "💨",
      "Sensibilidad en senos": "🌸", "Náuseas": "🤢", "Fatiga": "😴",
      "Acné": "🔴", "Dolor de espalda": "🔧", "Ligero": "💧", "Moderado": "💦",
      "Abundante": "🌊", "Con coágulos": "🩸", "Sin flujo": "⚪",
      "Ejercicio": "🏃", "Yoga": "🧘", "Meditación": "🕯️",
      "Descanso": "💤", "Trabajo intenso": "💼", "Social": "👥",
    };
    return map[s] || "✨";
  };

  return (
    <div style={{ padding: "0 16px", overflowY: "auto", minHeight: "100dvh" }}>
      <div style={{ paddingTop: 56, paddingBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#e9d5ff" }}>Síntomas 🌸</h1>
          <p style={{ color: "#7c6b9a", fontSize: 13 }}>Conoce tus patrones</p>
        </div>
        <PrimaryBtn onClick={onLogToday} style={{ padding: "10px 18px", fontSize: 13 }}>+ Hoy</PrimaryBtn>
      </div>

      {/* Últimos 7 días */}
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ color: "#e9d5ff", fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Últimos 7 días</h3>
        <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
          {last7.map(d => {
            const syms = symptoms[d] || [];
            const isToday = d === todayStr;
            const dateObj = new Date(d + "T12:00:00");
            return (
              <div key={d} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ color: "#6b6b8a", fontSize: 10, marginBottom: 4 }}>
                  {DAYS_SHORT[dateObj.getDay()]}
                </div>
                <div style={{
                  width: "100%",
                  aspectRatio: "1",
                  borderRadius: "50%",
                  background: syms.length > 0
                    ? "linear-gradient(135deg, #9333ea44, #db277744)"
                    : "rgba(255,255,255,0.05)",
                  border: isToday ? "2px solid #c084fc" : "2px solid transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: syms.length > 0 ? "#c084fc" : "#444",
                  fontWeight: 700,
                }}>
                  {syms.length > 0 ? syms.length : dateObj.getDate()}
                </div>
                <div style={{ color: "#6b6b8a", fontSize: 10, marginTop: 3 }}>{dateObj.getDate()}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Síntomas más frecuentes */}
      {sorted.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ color: "#e9d5ff", fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Tus síntomas más frecuentes</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sorted.map(([sym, count]) => {
              const maxCount = sorted[0][1];
              const pct = (count / maxCount) * 100;
              return (
                <div key={sym}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "#d4c8f0", fontSize: 13 }}>{emojiForSymptom(sym)} {sym}</span>
                    <span style={{ color: "#7c6b9a", fontSize: 12 }}>{count}×</span>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 6, height: 6 }}>
                    <div style={{
                      background: "linear-gradient(90deg, #9333ea, #ec4899)",
                      borderRadius: 6, height: 6, width: `${pct}%`,
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Historial */}
      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ color: "#e9d5ff", fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Historial reciente</h3>
        {Object.keys(symptoms).length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <p style={{ color: "#6b6b8a", fontSize: 14 }}>Aún no tienes registros</p>
            <p style={{ color: "#4a4a6a", fontSize: 12 }}>Empieza registrando cómo te sientes hoy</p>
          </div>
        ) : (
          Object.entries(symptoms)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 10)
            .map(([date, syms]) => {
              const d = new Date(date + "T12:00:00");
              return (
                <div key={date} style={{
                  borderBottom: "1px solid rgba(192,132,252,0.1)",
                  paddingBottom: 10,
                  marginBottom: 10,
                }}>
                  <p style={{ color: "#a78bfa", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    {d.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {syms.map(s => (
                      <span key={s} style={{
                        background: "rgba(192,132,252,0.1)",
                        color: "#c4b5fd",
                        borderRadius: 12, padding: "2px 8px", fontSize: 11,
                      }}>{emojiForSymptom(s)} {s}</span>
                    ))}
                  </div>
                </div>
              );
            })
        )}
      </Card>
    </div>
  );
}

// ── PANTALLA: Luna ───────────────────────────────────────────────────────────
function LunaScreen({ lunarToday, lunarInfoToday }) {
  const [selectedLuna, setSelectedLuna] = useState(lunarInfoToday);

  // Próximas fases lunares (simuladas)
  const nextPhases = [];
  const base = new Date();
  const lunarCycle = 29.53;
  for (let i = 0; i < 8; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + Math.round((i * lunarCycle) / 4));
    const ds = d.toISOString().split("T")[0];
    const phase = getLunarPhase(ds);
    nextPhases.push({ date: ds, ...phase, dateObj: d });
  }

  return (
    <div style={{ padding: "0 16px", overflowY: "auto", minHeight: "100dvh" }}>
      <div style={{ paddingTop: 56, paddingBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#e9d5ff" }}>La Luna ✨</h1>
        <p style={{ color: "#7c6b9a", fontSize: 13 }}>Conecta con la energía lunar</p>
      </div>

      {/* Luna actual grande */}
      <Card style={{
        textAlign: "center",
        marginBottom: 16,
        background: `linear-gradient(135deg, ${selectedLuna.color || "#2d1b69"}88, rgba(13,13,26,0.9))`,
        padding: "32px 20px",
      }}>
        <div style={{ fontSize: 90, animation: "float 4s ease-in-out infinite", marginBottom: 16 }}>
          {selectedLuna.emoji || lunarToday.emoji}
        </div>
        <h2 style={{ color: "#e9d5ff", fontWeight: 800, fontSize: 22, marginBottom: 4 }}>{selectedLuna.phase || lunarToday.name}</h2>
        <p style={{ color: "#a78bfa", fontSize: 14, marginBottom: 16 }}>{selectedLuna.energy}</p>
        <p style={{ color: "#c4b5fd", fontSize: 14, lineHeight: 1.7, maxWidth: 300, margin: "0 auto" }}>
          {selectedLuna.desc}
        </p>
      </Card>

      {/* Selector de fases */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
        {LUNA_INFO.map(l => (
          <button
            key={l.phase}
            onClick={() => setSelectedLuna(l)}
            style={{
              background: selectedLuna.phase === l.phase
                ? "linear-gradient(135deg, rgba(147,51,234,0.4), rgba(219,39,119,0.4))"
                : "rgba(255,255,255,0.05)",
              border: selectedLuna.phase === l.phase
                ? "2px solid #c084fc"
                : "2px solid rgba(192,132,252,0.1)",
              borderRadius: 14,
              padding: "12px 6px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: 26 }}>{l.emoji}</span>
            <span style={{ color: "#c4b5fd", fontSize: 9, fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>
              {l.phase.split(" ").slice(-1)[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Ritual */}
      <Card style={{ marginBottom: 16, background: "linear-gradient(135deg, rgba(88,28,135,0.25), rgba(13,13,26,0.7))" }}>
        <h3 style={{ color: "#e9d5ff", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>🕯️ Ritual sugerido</h3>
        <p style={{ color: "#c4b5fd", fontSize: 14, lineHeight: 1.7 }}>{selectedLuna.ritual}</p>
      </Card>

      {/* Afirmación */}
      <Card style={{ marginBottom: 16, background: "linear-gradient(135deg, rgba(30,58,95,0.4), rgba(13,13,26,0.7))" }}>
        <h3 style={{ color: "#e9d5ff", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>💫 Afirmación</h3>
        <p style={{ color: "#93c5fd", fontSize: 15, lineHeight: 1.7, fontStyle: "italic", fontWeight: 500 }}>
          "{selectedLuna.affirmation}"
        </p>
      </Card>

      {/* Próximas fases */}
      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ color: "#e9d5ff", fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🌙 Próximas fases lunares</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {nextPhases.slice(0, 6).map((p, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 0",
              borderBottom: i < 5 ? "1px solid rgba(192,132,252,0.08)" : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>{p.emoji}</span>
                <div>
                  <p style={{ color: "#d4c8f0", fontSize: 13, fontWeight: 600 }}>{p.name}</p>
                  <p style={{ color: "#6b6b8a", fontSize: 11 }}>
                    {p.dateObj.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                  </p>
                </div>
              </div>
              <span style={{
                background: "rgba(192,132,252,0.15)",
                color: "#a78bfa",
                borderRadius: 12, padding: "3px 10px", fontSize: 11,
              }}>
                {i === 0 ? "Hoy" : `en ${Math.round((p.dateObj - new Date()) / (1000 * 60 * 60 * 24))}d`}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── PANTALLA: Perfil ─────────────────────────────────────────────────────────
function ProfileScreen({ profile, cycleData, setCycleData, dayInCycle, symptoms, onResetOnboarding }) {
  const [editing, setEditing] = useState(false);
  const [editCycle, setEditCycle] = useState(cycleData.cycleLength);
  const [editPeriod, setEditPeriod] = useState(cycleData.periodLength);
  const [editLastPeriod, setEditLastPeriod] = useState(cycleData.lastPeriodStart);

  const totalDays = Object.keys(symptoms).length;
  const totalSymptoms = Object.values(symptoms).flat().length;

  function saveEdit() {
    setCycleData({ lastPeriodStart: editLastPeriod, cycleLength: editCycle, periodLength: editPeriod });
    setEditing(false);
  }

  const inputStyle = {
    width: "100%",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(192,132,252,0.3)",
    borderRadius: 12,
    padding: "12px 16px",
    color: "#e8e0f5",
    fontSize: 15,
    outline: "none",
  };

  return (
    <div style={{ padding: "0 16px", overflowY: "auto", minHeight: "100dvh" }}>
      <div style={{ paddingTop: 56, paddingBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#e9d5ff" }}>Mi Perfil 👤</h1>
        <p style={{ color: "#7c6b9a", fontSize: 13 }}>Tu espacio lunar personal</p>
      </div>

      {/* Avatar / Perfil */}
      <Card style={{ textAlign: "center", marginBottom: 16, padding: "28px 20px" }}>
        <div style={{
          width: 80, height: 80,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #9333ea, #ec4899)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 12px",
          fontSize: 36,
          animation: "pulse-glow 3s ease-in-out infinite",
        }}>
          🌙
        </div>
        <h2 style={{ color: "#e9d5ff", fontWeight: 800, fontSize: 22 }}>{profile?.name || "Lunita"}</h2>
        {profile?.zodiac && (
          <p style={{ color: "#a78bfa", fontSize: 14, marginTop: 4 }}>
            {profile.zodiac.emoji} {profile.zodiac.name}
          </p>
        )}
        {profile?.birthday && (
          <p style={{ color: "#6b6b8a", fontSize: 12, marginTop: 4 }}>
            🎂 {new Date(profile.birthday + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
          </p>
        )}
      </Card>

      {/* Estadísticas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <StatCard emoji="📅" label="Días registrados" value={totalDays} color="#c084fc" />
        <StatCard emoji="📊" label="Síntomas" value={totalSymptoms} color="#f9a8d4" />
        <StatCard emoji="🔄" label="Día del ciclo" value={dayInCycle} color="#60a5fa" />
      </div>

      {/* Ajustes del ciclo */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ color: "#e9d5ff", fontWeight: 700, fontSize: 15 }}>⚙️ Configuración del ciclo</h3>
          <button
            onClick={() => setEditing(!editing)}
            style={{
              background: "rgba(192,132,252,0.15)",
              border: "1px solid rgba(192,132,252,0.3)",
              color: "#c084fc", borderRadius: 10, padding: "6px 14px",
              cursor: "pointer", fontSize: 13,
            }}
          >
            {editing ? "Cancelar" : "Editar"}
          </button>
        </div>

        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ color: "#a78bfa", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Último período</label>
              <input style={inputStyle} type="date" value={editLastPeriod} onChange={e => setEditLastPeriod(e.target.value)} />
            </div>
            <div>
              <label style={{ color: "#a78bfa", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Duración del ciclo: {editCycle} días
              </label>
              <input style={{ ...inputStyle, padding: "6px 16px" }} type="range" min={21} max={40} value={editCycle} onChange={e => setEditCycle(+e.target.value)} />
            </div>
            <div>
              <label style={{ color: "#a78bfa", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Duración del período: {editPeriod} días
              </label>
              <input style={{ ...inputStyle, padding: "6px 16px" }} type="range" min={2} max={10} value={editPeriod} onChange={e => setEditPeriod(+e.target.value)} />
            </div>
            <PrimaryBtn onClick={saveEdit} style={{ width: "100%", padding: "12px", fontSize: 14 }}>
              💾 Guardar cambios
            </PrimaryBtn>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <InfoRow label="Último período" value={new Date(cycleData.lastPeriodStart + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })} />
            <InfoRow label="Duración del ciclo" value={`${cycleData.cycleLength} días`} />
            <InfoRow label="Duración del período" value={`${cycleData.periodLength} días`} />
          </div>
        )}
      </Card>

      {/* Privacidad */}
      <Card style={{ marginBottom: 16, background: "linear-gradient(135deg, rgba(20,40,20,0.4), rgba(13,13,26,0.7))" }}>
        <h3 style={{ color: "#e9d5ff", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>🔒 Privacidad y datos</h3>
        <p style={{ color: "#c4b5fd", fontSize: 13, lineHeight: 1.7 }}>
          Todos tus datos se almacenan localmente en tu dispositivo. Es La Luna no vende tus datos ni usa publicidad. Tu privacidad es sagrada para nosotros. 💜
        </p>
      </Card>

      {/* Acerca de */}
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ color: "#e9d5ff", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>🌙 Acerca de Es La Luna</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <InfoRow label="Desarrollado por" value="Multisensiversa" />
          <InfoRow label="Versión" value="1.0.0" />
          <InfoRow label="Idioma" value="Español" />
        </div>
        <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(239,68,68,0.1)", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)" }}>
          <p style={{ color: "#fca5a5", fontSize: 12, lineHeight: 1.6 }}>
            ⚠️ Esta app no debe usarse como método anticonceptivo. No sustituye el asesoramiento médico profesional.
          </p>
        </div>
      </Card>

      {/* Reiniciar */}
      <button
        onClick={onResetOnboarding}
        style={{
          width: "100%",
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 14,
          padding: 14,
          color: "#fca5a5",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 30,
        }}
      >
        🔄 Restablecer configuración inicial
      </button>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
      <span style={{ color: "#7c6b9a", fontSize: 13 }}>{label}</span>
      <span style={{ color: "#d4c8f0", fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ── MODAL: Registro de síntomas ──────────────────────────────────────────────
function SymptomsModal({ dateStr, symptoms, onToggle, onClose }) {
  const dateLabel = new Date(dateStr + "T12:00:00").toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(8px)",
      zIndex: 200,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "linear-gradient(180deg, #1a0a2e 0%, #0d0d1a 100%)",
        borderTop: "1px solid rgba(192,132,252,0.3)",
        borderRadius: "24px 24px 0 0",
        width: "100%",
        maxWidth: 430,
        maxHeight: "85dvh",
        overflowY: "auto",
        padding: "24px 20px 40px",
        animation: "fadeInUp 0.3s ease",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ color: "#e9d5ff", fontWeight: 800, fontSize: 18 }}>Registrar</h2>
            <p style={{ color: "#a78bfa", fontSize: 13, textTransform: "capitalize" }}>{dateLabel}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(192,132,252,0.15)",
              border: "none",
              borderRadius: "50%",
              width: 36, height: 36,
              cursor: "pointer",
              color: "#c084fc",
              fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>

        {/* Categorías */}
        {SYMPTOM_CATEGORIES.map(cat => (
          <div key={cat.cat} style={{ marginBottom: 20 }}>
            <h3 style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {cat.emoji} {cat.cat}
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {cat.items.map(item => {
                const active = symptoms.includes(item);
                return (
                  <button
                    key={item}
                    onClick={() => onToggle(item)}
                    style={{
                      background: active
                        ? "linear-gradient(135deg, rgba(147,51,234,0.5), rgba(219,39,119,0.5))"
                        : "rgba(255,255,255,0.05)",
                      border: active
                        ? "2px solid #c084fc"
                        : "2px solid rgba(192,132,252,0.15)",
                      borderRadius: 20,
                      padding: "8px 14px",
                      color: active ? "#e9d5ff" : "#7c6b9a",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      transition: "all 0.2s",
                      transform: active ? "scale(1.05)" : "scale(1)",
                    }}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Botón guardar */}
        <PrimaryBtn onClick={onClose} style={{ width: "100%", marginTop: 8 }}>
          ✓ Guardar registro ({symptoms.length} síntomas)
        </PrimaryBtn>
      </div>
    </div>
  );
}