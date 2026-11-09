import React, { useState, useMemo, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import demo from "./demo.json";
const EXAMPLE = `[Verse 1]
Neon rain on a midnight train
Silver light in the window pane
I chase the day as it fades away
You keep the beat of a distant street

[Verse 2]
Slow roads roll where the cold wind goes
Blue moons bloom over broken homes
A quiet fire in a rising sky
We ride the night till the morning light`;
const MODES = [
  ["stressed", "Stressed vowels"],
  ["all", "All vowels"],
  ["primary", "Primary stress only"],
];
async function api(path, options) {
  const r = await fetch(path, options);
  let data;
  try {
    data = await r.json();
  } catch {
    throw Error("The API returned an unreadable response. Is FastAPI running?");
  }
  if (!r.ok)
    throw Error(
      typeof data.detail === "string"
        ? data.detail
        : "Check the input and try again.",
    );
  return data;
}
function save(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Score({ data, family, selected, setSelected }) {
  return (
    <div className="score">
      {data.lines.map((line) => (
        <div key={line.index} className={`lyric-row ${line.kind}`}>
          <span className="line-number">{line.index + 1}</span>
          {line.kind === "lyrics" ? (
            <div className="word-flow">
              {line.tokens.map((id, i) => {
                const token = data.tokens[id],
                  vowels = token.vowels.map((e) => data.events[e]),
                  matches = vowels.some(
                    (e) => e.active && (!family || e.vowel === family),
                  );
                const before = i ? data.tokens[line.tokens[i - 1]].end : 0;
                return (
                  <React.Fragment key={id}>
                    <span className="punctuation">
                      {line.text.slice(before, token.start)}
                    </span>
                    <button
                      className={`word ${selected === id ? "selected" : ""} ${token.source === "unknown" ? "unknown" : ""} ${family && !matches ? "dim" : ""}`}
                      title={
                        token.phones ||
                        "Unknown pronunciation — click to add one"
                      }
                      onClick={() => setSelected(id)}
                    >
                      <span>
                        {token.word}
                        {token.variants.length > 1 &&
                          token.source !== "override" && <sup>•</sup>}
                      </span>
                      <span className="vowel-bars">
                        {vowels.map((e) => (
                          <i
                            key={e.id}
                            style={{
                              background: data.families.find(
                                (f) => f.id === e.vowel,
                              ).color,
                              opacity:
                                e.active && (!family || family === e.vowel)
                                  ? 1
                                  : 0.13,
                              height: e.stress === 1 ? 5 : 3,
                            }}
                          />
                        ))}
                      </span>
                    </button>
                  </React.Fragment>
                );
              })}
              <span className="punctuation">
                {line.text.slice(data.tokens[line.tokens.at(-1)]?.end || 0)}
              </span>
            </div>
          ) : (
            <span className="section-title">{line.text || " "}</span>
          )}
          {line.kind === "lyrics" && (
            <span
              className="line-syllables"
              title="Dictionary vowel nuclei, including unstressed vowels"
            >
              {line.events.length} syl
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
function Threads({ data, family, setSelected, svgRef }) {
  const rows = data.lines.filter((l) => l.kind === "lyrics"),
    maxEvents = Math.max(12, ...rows.map((l) => l.events.length));
  const width = Math.max(1050, maxEvents * 68 + 130),
    height = rows.length * 125 + 60;
  const positions = {};
  rows.forEach((line, row) =>
    line.events.forEach(
      (id, i) => (positions[id] = { x: 100 + i * 68, y: 75 + row * 125 }),
    ),
  );
  const links = data.links.filter((l) => !family || family === l.vowel);
  const shown = links.slice(0, 1200);
  return (
    <>
      <p className="view-caption">
        A syllable ribbon, not a timeline. Each dot is a vowel nucleus; arcs
        connect the nearest eligible earlier match. Hover for pronunciation,
        click to inspect.
      </p>
      <div className="svg-scroll">
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Vowel threads by lyric line"
          style={{ background: "#171a26", fontFamily: "system-ui" }}
        >
          <rect width={width} height={height} fill="#171a26" />
          {rows.map((line, i) => (
            <g key={line.index}>
              <text x="20" y={80 + i * 125} fill="#7b819b" fontSize="11">
                L{line.index + 1}
              </text>
              <line
                x1="80"
                y1={75 + i * 125}
                x2={width - 30}
                y2={75 + i * 125}
                stroke="#2c3043"
              />
            </g>
          ))}
          {shown.map((l, i) => {
            const a = positions[l.source],
              b = positions[l.target],
              same = a.y === b.y;
            return (
              <path
                key={i}
                d={
                  same
                    ? `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${a.y - Math.min(65, 20 + (b.x - a.x) * 0.2)} ${b.x} ${b.y}`
                    : `M ${a.x} ${a.y} C ${a.x} ${a.y + 55}, ${b.x} ${b.y - 55}, ${b.x} ${b.y}`
                }
                stroke={data.families.find((f) => f.id === l.vowel).color}
                fill="none"
                strokeWidth={family ? 2 : 1.3}
                opacity={family ? 0.7 : 0.28}
              />
            );
          })}
          {rows.flatMap((line) =>
            line.events.map((id) => {
              const e = data.events[id],
                p = positions[id],
                f = data.families.find((v) => v.id === e.vowel),
                bright = e.active && (!family || family === e.vowel);
              return (
                <g
                  key={id}
                  role="button"
                  tabIndex="0"
                  aria-label={`${e.word}, ${e.vowel}, line ${line.index + 1}`}
                  onClick={() => setSelected(e.token)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(e.token);
                    }
                  }}
                  style={{ cursor: "pointer", opacity: bright ? 1 : 0.16 }}
                >
                  <title>{`${e.word} · ${e.vowel}${e.stress} · ${data.tokens[e.token].phones}`}</title>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={e.stress === 1 ? 10 : 6}
                    fill={f.color}
                    fillOpacity={0.2}
                    stroke={f.color}
                  />
                  <circle cx={p.x} cy={p.y} r="2" fill={f.color} />
                  <text
                    x={p.x}
                    y={p.y + 28}
                    textAnchor="middle"
                    fontSize="10"
                    fill={f.color}
                  >
                    {e.vowel}
                    {e.stress}
                  </text>
                  <text
                    x={p.x}
                    y={p.y + 44}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#bfc0cf"
                  >
                    {e.word.length > 10 ? e.word.slice(0, 9) + "…" : e.word}
                  </text>
                </g>
              );
            }),
          )}
        </svg>
      </div>
      {links.length > 1200 && (
        <p className="note">
          Showing the first 1,200 threads. Export JSON contains all{" "}
          {links.length}.
        </p>
      )}
    </>
  );
}
function Similarity({ data }) {
  const [pair, setPair] = useState(null);
  const { matrix, line_indices: ids } = data.similarity;
  const size = 24,
    w = ids.length * size + 55;
  return (
    <>
      <p className="view-caption">
        Which lines use similar vowel palettes? Cosine similarity compares vowel
        counts, ignoring word order. It is not a rhyme or quality score. Click a
        cell to compare.
      </p>
      <div className="matrix-layout">
        <div className="svg-scroll">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={w}
            height={w}
            role="img"
            aria-label="Line vowel distribution cosine similarity matrix"
          >
            {ids.map((id, i) => (
              <g key={id}>
                <text
                  x={47 + i * size}
                  y="23"
                  textAnchor="middle"
                  fill="#8e94ac"
                  fontSize="9"
                >
                  {id + 1}
                </text>
                <text
                  x="22"
                  y={51 + i * size}
                  textAnchor="middle"
                  fill="#8e94ac"
                  fontSize="9"
                >
                  {id + 1}
                </text>
              </g>
            ))}
            {matrix.flatMap((row, i) =>
              row.map((v, j) => (
                <rect
                  key={`${i}-${j}`}
                  x={35 + j * size}
                  y={35 + i * size}
                  width={size - 2}
                  height={size - 2}
                  rx="3"
                  fill={v === null ? "#2c3040" : `hsl(167 45% ${12 + v * 54}%)`}
                  role="button"
                  tabIndex="0"
                  aria-label={`Lines ${ids[i] + 1} and ${ids[j] + 1}: ${v === null ? "no vowel data" : Math.round(v * 100) + " percent similarity"}`}
                  onClick={() => setPair([i, j])}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setPair([i, j]);
                    }
                  }}
                >
                  <title>{`Lines ${ids[i] + 1} × ${ids[j] + 1}: ${v === null ? "no data" : v.toFixed(2)}`}</title>
                </rect>
              )),
            )}
          </svg>
        </div>
        <div className="comparison">
          <span className="eyebrow">LINE COMPARISON</span>
          {pair ? (
            <>
              {pair.map((index, k) => (
                <blockquote key={k}>
                  <small>LINE {ids[index] + 1}</small>
                  {data.lines[ids[index]].text}
                </blockquote>
              ))}
              <strong className="comparison-value">
                {matrix[pair[0]][pair[1]] === null
                  ? "No active vowels"
                  : Math.round(matrix[pair[0]][pair[1]] * 100) + "% similarity"}
              </strong>
            </>
          ) : (
            <p>Select a square to see both lines.</p>
          )}
          <div className="gradient" />
          <small>
            0 · Different palette <span>1 · Same proportions</span>
          </small>
        </div>
      </div>
    </>
  );
}
function Inspector({ data, selected, overrides, onApply, busy }) {
  const token = data?.tokens[selected];
  const [draft, setDraft] = useState("");
  useEffect(() => setDraft(token?.phones || ""), [token]);
  if (!token)
    return (
      <div className="inspector-empty">
        <span>⌁</span>
        <h3>Look a little closer.</h3>
        <p>
          Click any word or vowel dot to inspect its sounds and tune its
          pronunciation.
        </p>
      </div>
    );
  return (
    <div className="inspector">
      <div className="eyebrow">PRONUNCIATION LAB · LINE {token.line + 1}</div>
      <h3>{token.word}</h3>
      <span className={`badge ${token.source}`}>
        {token.source === "unknown"
          ? "Not in dictionary"
          : token.source === "override"
            ? "Your pronunciation"
            : "CMU dictionary"}
      </span>
      <div className="phone-display">{token.phones || "—"}</div>
      <p>
        Vowels:{" "}
        {token.vowels
          .map((id) => {
            const e = data.events[id];
            return `${e.vowel}${e.stress}`;
          })
          .join(" · ") || "Unknown"}
      </p>
      {token.variants.length > 1 && (
        <label>
          Dictionary alternatives
          <select
            aria-label="Dictionary pronunciation"
            value={token.variants.includes(draft) ? draft : ""}
            onChange={(e) => setDraft(e.target.value)}
          >
            <option value="" disabled>
              Custom pronunciation
            </option>
            {token.variants.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        ARPAbet override
        <input
          aria-label="ARPAbet override"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. S K AY1"
        />
      </label>
      <p className="note">
        Vowel stress: 0 unstressed · 1 primary · 2 secondary. Applies to every
        occurrence of “{token.normalized}”.
      </p>
      <button
        className="primary"
        disabled={busy || !draft.trim()}
        onClick={() => {
          const next = { ...overrides, [token.normalized]: draft };
          onApply(next);
        }}
      >
        Apply & reanalyze ↗
      </button>
      {overrides[token.normalized] && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            const next = { ...overrides };
            delete next[token.normalized];
            onApply(next);
          }}
        >
          Reset to dictionary
        </button>
      )}
      <p className="note">
        Dictionary stress is a starting point. Singing, accent, and context can
        change the sound.
      </p>
    </div>
  );
}
function App() {
  const [text, setText] = useState(EXAMPLE),
    [title, setTitle] = useState("Midnight in color"),
    [data, setData] = useState(demo),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [mode, setMode] = useState("stressed"),
    [gap, setGap] = useState(2),
    [repeats, setRepeats] = useState(false),
    [overrides, setOverrides] = useState({}),
    [family, setFamily] = useState(null),
    [view, setView] = useState("score"),
    [selected, setSelected] = useState(null),
    [sourceOpen, setSourceOpen] = useState(false),
    [dirty, setDirty] = useState(false);
  const input = useRef(),
    svgRef = useRef();
  async function build(
    nextOverrides = overrides,
    content = text,
    nextTitle = title,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: content,
          title: nextTitle,
          stress: mode,
          line_gap: gap,
          repeats,
          overrides: nextOverrides,
        }),
      });
      setData(result);
      setOverrides(nextOverrides);
      setSelected(null);
      setDirty(false);
      setFamily(null);
    } catch (e) {
      setError(
        e.message === "Failed to fetch"
          ? "Cannot reach FastAPI. Start the backend on port 8000."
          : e.message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function ingest(file) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await api("/api/ingest", { method: "POST", body: form });
      setText(result.text);
      setTitle(result.title);
      setOverrides({});
      setSelected(null);
      setDirty(true);
      setSourceOpen(true);
    } catch (e) {
      setError(
        e.message === "Failed to fetch"
          ? "Cannot reach FastAPI. Start the backend on port 8000."
          : e.message,
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  const activeFamily = data?.families.find((f) => f.id === family);
  const distribution = useMemo(
    () =>
      data
        ? [...data.families]
            .filter((f) => f.count > 0)
            .sort((a, b) => b.count - a.count)
        : [],
    [data],
  );
  function exportSvg() {
    if (svgRef.current) {
      const copy = svgRef.current.cloneNode(true);
      copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      save(
        new XMLSerializer().serializeToString(copy),
        "image/svg+xml",
        "voweltrace-threads.svg",
      );
    }
  }
  return (
    <div className="app">
      <header>
        <a className="brand" href="/">
          ⌁ <strong>voweltrace</strong>
          <span>SEE THE SOUND</span>
        </a>
        <div className="header-right">
          <span className="status-dot" /> English · CMUdict{" "}
          <button className="outline" onClick={() => setSourceOpen((s) => !s)}>
            {sourceOpen ? "Hide editor" : "Edit lyrics"}
          </button>
          <button
            className="upload"
            disabled={busy}
            onClick={() => input.current.click()}
          >
            ↑ Upload lyrics
          </button>
          <input
            ref={input}
            aria-label="Upload document"
            className="file-input"
            type="file"
            disabled={busy}
            accept=".txt,.md,.pdf,.docx"
            onChange={(e) => ingest(e.target.files[0])}
          />
        </div>
      </header>
      <main>
        <section className="hero">
          <div>
            <div className="eyebrow">A LENS FOR LYRICS & LANGUAGE</div>
            <h1>
              Every lyric has a <em>color.</em>
            </h1>
            <p>Follow the vowel sounds woven through your words.</p>
          </div>
          <div className="hero-note">
            <span>
              NOT THE LETTER.
              <br />
              THE SOUND.
            </span>
            <div>
              <b style={{ color: "#7bdbb6" }}>night</b>
              <span> ↔ </span>
              <b style={{ color: "#7bdbb6" }}>sky</b>
              <small>/aɪ/ · AY</small>
            </div>
          </div>
        </section>
        {sourceOpen && (
          <section className="editor">
            <div>
              <label>
                Document title
                <input
                  disabled={busy}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              <p>
                Paste lyrics, preserve line breaks, and use [Verse] or blank
                lines to separate sections. Upload PDF, DOCX, TXT, or Markdown.
              </p>
              <button
                className="outline"
                disabled={busy}
                onClick={() => {
                  setText(EXAMPLE);
                  setTitle("Midnight in color");
                  setOverrides({});
                  setDirty(true);
                }}
              >
                Load original demo
              </button>
            </div>
            <label className="lyrics-label">
              Lyrics
              <textarea
                disabled={busy}
                value={text}
                maxLength={100000}
                onChange={(e) => {
                  setText(e.target.value);
                  setDirty(true);
                }}
                rows="10"
                spellCheck="false"
              />
            </label>
          </section>
        )}
        <div className="settings">
          <label>
            Listen for
            <select
              disabled={busy}
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setDirty(true);
              }}
            >
              {MODES.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Connect across
            <select
              disabled={busy}
              value={gap}
              onChange={(e) => {
                setGap(+e.target.value);
                setDirty(true);
              }}
            >
              {[0, 1, 2, 4, 8].map((v) => (
                <option key={v} value={v}>
                  {v === 0
                    ? "Same line only"
                    : `${v} ${v === 1 ? "line" : "lines"}`}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              disabled={busy}
              checked={repeats}
              onChange={(e) => {
                setRepeats(e.target.checked);
                setDirty(true);
              }}
            />{" "}
            Connect repeated words
          </label>
          <button
            className="primary"
            disabled={busy || !text.trim()}
            onClick={() => build()}
          >
            {busy
              ? "Tracing sounds…"
              : dirty
                ? "Update analysis ↗"
                : "Analyze lyrics ↗"}
          </button>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {dirty && data && (
          <div className="pending" role="status">
            Input changed. The visualization below shows the last successful
            analysis; click Update analysis.
          </div>
        )}
        {data ? (
          <>
            <div className="summary">
              <div>
                <span className="eyebrow">CURRENT ANALYSIS</span>
                <h2>{data.title}</h2>
              </div>
              <div className="stats">
                <span>
                  <b>{data.stats.words}</b>words
                </span>
                <span>
                  <b>{data.stats.active_vowels}</b>vowels in view
                </span>
                <span>
                  <b>{data.stats.threads}</b>threads
                </span>
                <span>
                  <b>{data.stats.coverage}%</b>pronounced
                </span>
              </div>
            </div>
            <div className="workspace">
              <section className="canvas">
                <nav className="view-tabs" aria-label="Visualization">
                  <div>
                    {[
                      ["score", "01", "Lyric score"],
                      ["threads", "02", "Vowel threads"],
                      ["similarity", "03", "Line echoes"],
                    ].map(([id, num, label]) => (
                      <button
                        key={id}
                        aria-pressed={view === id}
                        className={view === id ? "active" : ""}
                        onClick={() => setView(id)}
                      >
                        <small>{num}</small>
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    className="export"
                    onClick={() =>
                      save(
                        JSON.stringify(data, null, 2),
                        "application/json",
                        "voweltrace.json",
                      )
                    }
                  >
                    ↓ JSON
                  </button>
                  {view === "threads" && (
                    <button className="export" onClick={exportSvg}>
                      ↓ SVG
                    </button>
                  )}
                </nav>
                <div className="legend-header">
                  <span>
                    {view === "similarity"
                      ? "VOWEL DISTRIBUTION SIMILARITY"
                      : "FOLLOW A VOWEL"}
                  </span>
                  <button
                    className="text-button"
                    onClick={() => setFamily(null)}
                  >
                    Show all sounds
                  </button>
                </div>
                <div className="legend">
                  {data.families
                    .filter((f) => f.count > 0)
                    .map((f) => (
                      <button
                        key={f.id}
                        aria-pressed={family === f.id}
                        className={
                          family === f.id ? "active" : family ? "muted" : ""
                        }
                        onClick={() => setFamily(family === f.id ? null : f.id)}
                        title={`${f.ipa} as in ${f.example} · ${f.count} occurrences`}
                        style={{ "--vowel": f.color }}
                      >
                        <i />
                        {f.id}
                        <small>{f.example.split(" / ")[0]}</small>
                      </button>
                    ))}
                </div>
                {family && view !== "similarity" && (
                  <div className="filter-note">
                    Following{" "}
                    <b style={{ color: activeFamily.color }}>
                      {activeFamily.ipa}
                    </b>{" "}
                    as in {activeFamily.example}. Click its color again to
                    clear.
                  </div>
                )}
                {view === "score" ? (
                  <Score
                    data={data}
                    family={family}
                    selected={selected}
                    setSelected={setSelected}
                  />
                ) : view === "threads" ? (
                  <Threads
                    data={data}
                    family={family}
                    setSelected={setSelected}
                    svgRef={svgRef}
                  />
                ) : (
                  <Similarity data={data} />
                )}
                <div className="canvas-footer">
                  <span>● One color per vowel family</span>
                  <span>
                    {view === "score"
                      ? "Bars show each vowel · tall = primary stress · • = alternatives"
                      : view === "threads"
                        ? "Large dots = primary stress · dim = filtered vowels"
                        : "0 = different proportions · 1 = same proportions"}
                  </span>
                </div>
              </section>
              <aside>
                <Inspector
                  data={data}
                  selected={selected}
                  overrides={overrides}
                  onApply={(next) => build(next)}
                  busy={busy}
                />
                <section className="palette">
                  <span className="eyebrow">THE VOWEL PALETTE</span>
                  <h3>Sounds that carry the piece.</h3>
                  {distribution.slice(0, 6).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFamily(family === f.id ? null : f.id)}
                    >
                      <span style={{ color: f.color }}>
                        {f.id}
                        <small>/{f.ipa}/</small>
                      </span>
                      <i
                        style={{
                          width: `${Math.max(5, (100 * f.count) / (distribution[0]?.count || 1))}%`,
                          background: f.color,
                        }}
                      />
                      <b>{f.count}</b>
                    </button>
                  ))}
                </section>
                <section className="coverage">
                  <span className="eyebrow">PRONUNCIATION CHECK</span>
                  <p>
                    {data.stats.ambiguous_words} words have dictionary
                    alternatives. Review the ones where context or delivery
                    matters.
                  </p>
                  {data.unknown_words.length ? (
                    <>
                      <p>
                        {data.unknown_words.length} words need a pronunciation:
                      </p>
                      <div>
                        {data.unknown_words.map((u) => (
                          <button
                            key={u.word}
                            onClick={() =>
                              setSelected(
                                data.tokens.find((t) => t.normalized === u.word)
                                  .id,
                              )
                            }
                          >
                            {u.word} <small>×{u.count}</small>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="good">✓ Every word has a pronunciation.</p>
                  )}
                </section>
              </aside>
            </div>
            <footer>
              <span>ASSonance, made visible.</span>
              <p>
                Exact English vowel-family matches, not an audio transcription.
                CMUdict defaults to its first pronunciation; review alternatives
                and overrides. AH and ER include stressed and reduced vowels.
                Repeated-word links are{" "}
                {data.settings.repeats ? "included" : "excluded"}; full rhymes
                can also match. Threads stop at section breaks.
              </p>
              <div>
                <a
                  href="https://aclanthology.org/W15-0702/"
                  target="_blank"
                  rel="noreferrer"
                >
                  RhymeDesign ↗
                </a>
                <a
                  href="https://pubmed.ncbi.nlm.nih.gov/26529714/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Poemage ↗
                </a>
                <a
                  href="https://github.com/cmusphinx/cmudict"
                  target="_blank"
                  rel="noreferrer"
                >
                  CMUdict ↗
                </a>
              </div>
            </footer>
          </>
        ) : (
          <div className="no-data">
            <span>⌁</span>
            <h2>
              {busy
                ? "Finding the sounds between the words…"
                : "Ready when you are."}
            </h2>
            <p>
              Start FastAPI, then analyze the demo or upload your own lyrics.
            </p>
            <button className="outline" onClick={() => setSourceOpen(true)}>
              Open lyric editor
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
