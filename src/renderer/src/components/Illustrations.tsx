/* Themed SVG illustrations shared by onboarding and the launcher. */

export function IlloApp(): JSX.Element {
  return (
    <svg viewBox="0 0 460 180">
      <rect x="30" y="14" width="400" height="152" rx="12" fill="var(--glass)" stroke="var(--glass-border)" />
      <circle cx="48" cy="30" r="4" fill="var(--danger)" opacity="0.8" />
      <circle cx="62" cy="30" r="4" fill="var(--warn)" opacity="0.8" />
      <circle cx="76" cy="30" r="4" fill="var(--ok)" opacity="0.8" />
      <rect x="30" y="42" width="86" height="124" fill="var(--hover)" />
      {[58, 80, 102].map((y, i) => (
        <g key={y}>
          <circle cx="48" cy={y} r="4" fill={['var(--claude)', 'var(--codex)', 'var(--text-dim)'][i]} />
          <rect x="58" y={y - 3} width="46" height="6" rx="3" fill="var(--hover-strong)" />
        </g>
      ))}
      {[
        { x: 124, y: 50, c: 'var(--claude)', g: '✳' },
        { x: 280, y: 50, c: 'var(--claude)', g: '✳' },
        { x: 124, y: 110, c: 'var(--codex)', g: '⬡' },
        { x: 280, y: 110, c: 'var(--shell)', g: '❯' }
      ].map((p) => (
        <g key={`${p.x}${p.y}`}>
          <rect x={p.x} y={p.y} width="148" height="52" rx="6" fill="var(--pane-bg)" stroke="var(--glass-border)" />
          <rect x={p.x} y={p.y} width="148" height="3" rx="1.5" fill={p.c} />
          <text x={p.x + 10} y={p.y + 22} fill={p.c} fontSize="12" fontFamily="var(--mono)">{p.g}</text>
          <rect x={p.x + 10} y={p.y + 32} width="86" height="5" rx="2.5" fill="var(--hover-strong)" />
          <rect x={p.x + 10} y={p.y + 41} width="58" height="5" rx="2.5" fill="var(--hover)" />
        </g>
      ))}
    </svg>
  )
}

export function IlloAgents(): JSX.Element {
  const cells = [
    { x: 96, label: 'alpha', c: 'var(--claude)', g: '✳' },
    { x: 188, label: 'bravo', c: 'var(--claude)', g: '✳' },
    { x: 280, label: 'charlie', c: 'var(--codex)', g: '⬡' },
    { x: 372, label: 'delta', c: 'var(--shell)', g: '❯' }
  ]
  return (
    <svg viewBox="0 0 460 180">
      {cells.map((cell, i) => (
        <g key={cell.label}>
          <rect x={cell.x - 40} y="46" width="80" height="88" rx="10" fill="var(--glass)" stroke={cell.c} />
          <text x={cell.x} y="84" textAnchor="middle" fill={cell.c} fontSize="20" fontFamily="var(--mono)">{cell.g}</text>
          <text x={cell.x} y="108" textAnchor="middle" fill="var(--text)" fontSize="11" fontFamily="var(--mono)" fontWeight="700">{cell.label}</text>
          <text x={cell.x} y="123" textAnchor="middle" fill="var(--text-dim)" fontSize="8.5">{i === 0 ? 'main checkout' : 'worktree'}</text>
        </g>
      ))}
    </svg>
  )
}

export function IlloBranches(): JSX.Element {
  return (
    <svg viewBox="0 0 460 180">
      <line x1="60" y1="90" x2="400" y2="90" stroke="var(--text-dim)" strokeWidth="2.5" />
      {[90, 150, 210, 270, 330].map((x) => (
        <circle key={x} cx={x} cy="90" r="5" fill="var(--glass-strong)" stroke="var(--text-dim)" strokeWidth="2" />
      ))}
      <path d="M150 90 C 190 90 180 46 230 46 L 385 46" fill="none" stroke="var(--claude)" strokeWidth="2.5" />
      <circle cx="290" cy="46" r="5" fill="var(--claude)" />
      <circle cx="350" cy="46" r="5" fill="var(--claude)" />
      <text x="395" y="50" fill="var(--claude)" fontSize="10.5" fontFamily="var(--mono)">bravo</text>
      <path d="M210 90 C 250 90 240 134 290 134 L 380 134" fill="none" stroke="var(--codex)" strokeWidth="2.5" />
      <circle cx="330" cy="134" r="5" fill="var(--codex)" />
      <text x="390" y="138" fill="var(--codex)" fontSize="10.5" fontFamily="var(--mono)">charlie</text>
      <text x="60" y="112" fill="var(--text-dim)" fontSize="10.5" fontFamily="var(--mono)">main</text>
    </svg>
  )
}

/** Shared-checkout mode: everyone in one folder, one pane branching off on demand. */
export function IlloIsolationShared(): JSX.Element {
  return (
    <svg viewBox="0 0 460 180">
      <rect x="70" y="28" width="210" height="124" rx="10" fill="var(--glass)" stroke="var(--glass-border)" />
      <text x="86" y="50" fill="var(--text-dim)" fontSize="10.5" fontFamily="var(--mono)">~/project · main</text>
      {[
        { y: 74, c: 'var(--claude)', g: '✳', label: 'alpha' },
        { y: 100, c: 'var(--claude)', g: '✳', label: 'bravo' },
        { y: 126, c: 'var(--codex)', g: '⬡', label: 'charlie' }
      ].map((r) => (
        <g key={r.y}>
          <text x="92" y={r.y + 4} fill={r.c} fontSize="12" fontFamily="var(--mono)">{r.g}</text>
          <text x="114" y={r.y + 4} fill="var(--text)" fontSize="10" fontFamily="var(--mono)">{r.label}</text>
          <rect x="176" y={r.y - 3} width="86" height="6" rx="3" fill="var(--hover-strong)" />
        </g>
      ))}
      <path d="M280 100 C 316 100 310 118 344 118" fill="none" stroke="var(--claude)" strokeWidth="2" strokeDasharray="5 4" />
      <rect x="344" y="96" width="104" height="44" rx="8" fill="var(--pane-bg)" stroke="var(--claude)" strokeDasharray="5 4" />
      <text x="356" y="114" fill="var(--claude)" fontSize="10" fontFamily="var(--mono)">⑂ fix-login</text>
      <text x="356" y="129" fill="var(--text-dim)" fontSize="8" fontFamily="var(--mono)">.worktrees/ · on demand</text>
    </svg>
  )
}

/** Eager mode: alpha keeps the checkout, other agents in detached worktrees. */
export function IlloIsolationWorktrees(): JSX.Element {
  return (
    <svg viewBox="0 0 460 180">
      <rect x="52" y="52" width="130" height="76" rx="10" fill="var(--glass)" stroke="var(--claude)" />
      <text x="68" y="84" fill="var(--claude)" fontSize="13" fontFamily="var(--mono)">✳ alpha</text>
      <text x="68" y="104" fill="var(--text-dim)" fontSize="9" fontFamily="var(--mono)">main checkout</text>
      <line x1="182" y1="90" x2="228" y2="90" stroke="var(--text-dim)" strokeWidth="2" />
      <circle cx="236" cy="90" r="5" fill="var(--glass-strong)" stroke="var(--text-dim)" strokeWidth="2" />
      <text x="222" y="112" fill="var(--text-dim)" fontSize="9" fontFamily="var(--mono)">base</text>
      <path d="M241 86 C 266 60 266 48 290 48" fill="none" stroke="var(--claude)" strokeWidth="2" strokeDasharray="5 4" />
      <path d="M241 94 C 266 120 266 132 290 132" fill="none" stroke="var(--codex)" strokeWidth="2" strokeDasharray="5 4" />
      <rect x="290" y="28" width="146" height="42" rx="8" fill="var(--pane-bg)" stroke="var(--claude)" strokeDasharray="5 4" />
      <text x="302" y="46" fill="var(--claude)" fontSize="10" fontFamily="var(--mono)">✳ .worktrees/bravo</text>
      <text x="302" y="60" fill="var(--text-dim)" fontSize="8" fontFamily="var(--mono)">detached @ base</text>
      <rect x="290" y="112" width="146" height="42" rx="8" fill="var(--pane-bg)" stroke="var(--codex)" strokeDasharray="5 4" />
      <text x="302" y="130" fill="var(--codex)" fontSize="10" fontFamily="var(--mono)">⬡ .worktrees/charlie</text>
      <text x="302" y="144" fill="var(--text-dim)" fontSize="8" fontFamily="var(--mono)">detached @ base</text>
    </svg>
  )
}

export function IlloViews(): JSX.Element {
  return (
    <svg viewBox="0 0 460 180">
      <rect x="52" y="24" width="150" height="132" rx="10" fill="var(--glass)" stroke="var(--glass-border)" />
      {[
        { y: 44, w: 70, c: 'var(--text-dim)' },
        { y: 64, w: 92, c: 'var(--warn)' },
        { y: 84, w: 60, c: 'var(--ok)' },
        { y: 104, w: 84, c: 'var(--text-dim)' },
        { y: 124, w: 52, c: 'var(--text-dim)' }
      ].map((r, i) => (
        <g key={r.y}>
          <rect x={68 + (i % 2) * 10} y={r.y - 4} width="9" height="9" rx="2" fill={r.c} opacity="0.85" />
          <rect x={84 + (i % 2) * 10} y={r.y - 2} width={r.w} height="5" rx="2.5" fill={r.c === 'var(--text-dim)' ? 'var(--hover-strong)' : r.c} opacity={r.c === 'var(--text-dim)' ? 1 : 0.75} />
        </g>
      ))}
      <rect x="238" y="24" width="170" height="132" rx="10" fill="var(--pane-bg)" stroke="var(--glass-border)" />
      {[
        { y: 44, c: 'var(--hover-strong)', w: 120 },
        { y: 62, c: 'var(--danger)', w: 108 },
        { y: 78, c: 'var(--danger)', w: 84 },
        { y: 96, c: 'var(--ok)', w: 124 },
        { y: 112, c: 'var(--ok)', w: 96 },
        { y: 130, c: 'var(--hover-strong)', w: 110 }
      ].map((r) => (
        <g key={r.y}>
          <rect x="252" y={r.y - 4} width="8" height="8" rx="2" fill={r.c} opacity="0.6" />
          <rect x="268" y={r.y - 2} width={r.w} height="5" rx="2.5" fill={r.c} opacity={r.c === 'var(--hover-strong)' ? 1 : 0.45} />
        </g>
      ))}
    </svg>
  )
}

export function IlloMemory(): JSX.Element {
  const nodes = [
    { x: 150, y: 60, c: 'var(--claude)', r: 11 },
    { x: 250, y: 42, c: 'var(--codex)', r: 8 },
    { x: 320, y: 92, c: 'var(--claude)', r: 9 },
    { x: 200, y: 128, c: 'var(--warn)', r: 8 },
    { x: 116, y: 118, c: 'var(--codex)', r: 7 }
  ]
  const edges = [
    [0, 1],
    [0, 3],
    [1, 2],
    [2, 3],
    [0, 4]
  ]
  return (
    <svg viewBox="0 0 460 180">
      {edges.map(([a, b]) => (
        <line key={`${a}${b}`} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke="var(--glass-border)" strokeWidth="1.5" />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={n.c} opacity="0.9" />
      ))}
      <text x="343" y="96" fill="var(--text-dim)" fontSize="9.5" fontFamily="var(--mono)">[[decision]]</text>
      <text x="150" y="42" fill="var(--text-dim)" fontSize="9.5" fontFamily="var(--mono)">auth-gotcha</text>
    </svg>
  )
}

export function IlloTools(): JSX.Element {
  return (
    <svg viewBox="0 0 460 180">
      <rect x="60" y="70" width="112" height="40" rx="10" fill="var(--glass)" stroke="var(--glass-border)" />
      <text x="76" y="95" fill="var(--claude)" fontSize="13" fontFamily="var(--mono)">✳</text>
      <rect x="94" y="82" width="42" height="4" rx="2" fill="var(--hover-strong)" />
      <rect x="94" y="82" width="26" height="4" rx="2" fill="var(--warn)" />
      <rect x="94" y="92" width="42" height="4" rx="2" fill="var(--hover-strong)" />
      <rect x="94" y="92" width="34" height="4" rx="2" fill="var(--danger)" />
      <text x="146" y="95" fill="var(--text-dim)" fontSize="11" fontFamily="var(--mono)">61%</text>
      <circle cx="230" cy="90" r="22" fill="var(--glass)" stroke="var(--danger)" />
      <path d="M230 78a5 5 0 0 0-5 5v8a5 5 0 0 0 10 0v-8a5 5 0 0 0-5-5Z M240 88v3a10 10 0 0 1-20 0v-3 M230 103v4" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" />
      {['var(--claude)', 'var(--codex)', '#b083f0', 'var(--ok)', 'var(--warn)'].map((c, i) => (
        <circle key={c} cx={306 + i * 22} cy="90" r="8" fill={c} opacity="0.9" />
      ))}
    </svg>
  )
}
