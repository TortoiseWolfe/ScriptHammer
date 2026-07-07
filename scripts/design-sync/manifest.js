/**
 * manifest.js — the curated component manifest for the ScriptHammer design-sync bundle.
 *
 * Each entry's class strings are copied verbatim from the component source so the
 * preview cards stay faithful to the real components:
 *   Button     -> src/components/atomic/Button/Button.tsx (variantClasses/sizeClasses)
 *   Card       -> src/components/atomic/Card/Card.tsx
 *   TagBadge   -> src/components/atomic/TagBadge/TagBadge.tsx
 *   Tooltip    -> src/components/atomic/Tooltip/Tooltip.tsx
 *   Text       -> src/components/subatomic/Text/Text.tsx (variantStyles)
 *   NetworkStatus / TypingIndicator -> atomic status atoms
 *
 * `render(h)` returns the inner markup for ONE theme wrapper. `h` is a tiny
 * helper { esc } passed by the generator. Markup uses real DaisyUI classes.
 */

// ---- Button (9 variants x 4 sizes + modifiers) ----
const BTN_VARIANTS = [
  'primary',
  'secondary',
  'accent',
  'ghost',
  'link',
  'info',
  'success',
  'warning',
  'error',
];
const BTN_SIZES = [
  ['xs', 'btn-xs min-w-11 min-h-11'],
  ['sm', 'btn-sm min-w-11 min-h-11'],
  ['md', 'min-w-11 min-h-11'],
  ['lg', 'btn-lg'],
];

function buttonCard() {
  let out = '';
  // variant rows
  out += '<div class="flex flex-col gap-3">';
  for (const v of BTN_VARIANTS) {
    out += '<div class="flex flex-wrap items-center gap-2">';
    out += `<span class="text-base-content/70 text-xs w-20 inline-block">${v}</span>`;
    for (const [, sizeCls] of BTN_SIZES) {
      out += `<button class="btn btn-${v} ${sizeCls}">Button</button>`;
    }
    out += '</div>';
  }
  // modifiers
  out += '<div class="flex flex-wrap items-center gap-2 pt-2">';
  out +=
    '<span class="text-base-content/70 text-xs w-20 inline-block">modifiers</span>';
  out +=
    '<button class="btn btn-primary btn-outline min-w-11 min-h-11">Outline</button>';
  out +=
    '<button class="btn btn-primary min-w-11 min-h-11" aria-busy="true"><span class="loading loading-spinner"></span>Loading</button>';
  out +=
    '<button class="btn btn-primary btn-wide min-w-11 min-h-11">Wide</button>';
  out +=
    '<button class="btn btn-primary glass min-w-11 min-h-11">Glass</button>';
  out +=
    '<button class="btn btn-primary min-w-11 min-h-11" disabled>Disabled</button>';
  out += '</div>';
  out += '</div>';
  return out;
}

// ---- Card ----
function cardCard() {
  return `
<div class="flex flex-wrap gap-4">
  <article class="card bg-base-100 w-64">
    <div class="card-body">
      <header><h2 class="card-title">Card title</h2><p class="text-base-content/85 text-sm">Supporting subtitle</p></header>
      <p class="text-base-content">A standard card with a body, title and actions.</p>
      <div class="card-actions justify-end"><button class="btn btn-primary btn-sm min-w-11 min-h-11">Action</button></div>
    </div>
  </article>
  <article class="card card-border bg-base-100 w-64">
    <div class="card-body">
      <header><h2 class="card-title">Bordered</h2></header>
      <p class="text-base-content">A bordered card variant.</p>
    </div>
  </article>
  <article class="card card-sm bg-base-100 w-64">
    <div class="card-body">
      <header><h2 class="card-title">Compact</h2></header>
      <p class="text-base-content">A compact card with tighter padding.</p>
    </div>
  </article>
</div>`;
}

// ---- TagBadge (3 sizes x 4 variants) ----
const TAG_SIZES = [
  ['sm', 'badge-sm text-xs'],
  ['md', 'badge-md text-sm'],
  ['lg', 'badge-lg text-base'],
];
const TAG_VARIANTS = [
  ['default', 'badge-outline'],
  ['primary', 'badge-primary'],
  ['secondary', 'badge-secondary'],
  ['accent', 'badge-accent'],
];
function tagBadgeCard() {
  let out = '<div class="flex flex-col gap-3">';
  for (const [vname, vcls] of TAG_VARIANTS) {
    out += '<div class="flex flex-wrap items-center gap-2">';
    out += `<span class="text-base-content/70 text-xs w-20 inline-block">${vname}</span>`;
    for (const [, scls] of TAG_SIZES) {
      out += `<span class="badge ${scls} ${vcls}">tag</span>`;
    }
    out += '</div>';
  }
  out +=
    '<div class="flex flex-wrap items-center gap-2 pt-2"><span class="text-base-content/70 text-xs w-20 inline-block">with count</span>';
  out +=
    '<span class="badge badge-md text-sm badge-primary">react <span class="text-base-content/85 ml-1">(12)</span></span>';
  out +=
    '<span class="badge badge-md text-sm badge-primary ring-2 ring-primary ring-offset-1">active</span></div>';
  out += '</div>';
  return out;
}

// ---- Tooltip (data-tip; force-open via tooltip-open so it shows in a static card) ----
function tooltipCard() {
  return `
<div class="flex flex-wrap gap-10 pt-8">
  <div class="tooltip tooltip-open tooltip-top" data-tip="Top tooltip"><button class="btn btn-sm min-w-11 min-h-11">top</button></div>
  <div class="tooltip tooltip-open tooltip-bottom" data-tip="Bottom tooltip"><button class="btn btn-sm min-w-11 min-h-11">bottom</button></div>
  <div class="tooltip tooltip-open tooltip-left" data-tip="Left tooltip"><button class="btn btn-sm min-w-11 min-h-11">left</button></div>
  <div class="tooltip tooltip-open tooltip-right" data-tip="Right tooltip"><button class="btn btn-sm min-w-11 min-h-11">right</button></div>
</div>`;
}

// ---- Text (variant scale; verbatim from variantStyles) ----
const TEXT_VARIANTS = [
  ['h1', 'text-5xl font-bold text-base-content', 'Heading 1'],
  ['h2', 'text-4xl font-bold text-base-content', 'Heading 2'],
  ['h3', 'text-3xl font-semibold text-base-content', 'Heading 3'],
  ['h4', 'text-2xl font-semibold text-base-content', 'Heading 4'],
  ['h5', 'text-xl font-medium text-base-content', 'Heading 5'],
  ['h6', 'text-lg font-medium text-base-content', 'Heading 6'],
  ['lead', 'text-xl text-base-content/85', 'Lead paragraph text'],
  [
    'body',
    'text-base text-base-content',
    'Body text — the default paragraph style.',
  ],
  ['small', 'text-sm text-base-content/85', 'Small text'],
  ['caption', 'text-xs text-base-content', 'Caption text'],
  ['emphasis', 'text-base italic text-base-content', 'Emphasised text'],
  [
    'code',
    'font-mono text-sm bg-base-200 px-1 py-0.5 rounded',
    'const code = true',
  ],
];
function textCard() {
  let out = '<div class="flex flex-col gap-2">';
  for (const [name, cls, sample] of TEXT_VARIANTS) {
    out += `<div class="flex items-baseline gap-3"><span class="text-base-content/50 text-xs w-16 inline-block shrink-0">${name}</span><span class="${cls}">${sample}</span></div>`;
  }
  out += '</div>';
  return out;
}

// ---- NetworkStatus + TypingIndicator (small status atoms) ----
function statusCard() {
  return `
<div class="flex flex-col gap-4">
  <div class="flex items-center gap-2"><span class="text-base-content/70 text-xs w-28 inline-block">online</span>
    <div class="flex items-center gap-2"><div class="bg-success h-2 w-2 rounded-full"></div><span class="text-success text-sm">Online</span></div></div>
  <div class="flex items-center gap-2"><span class="text-base-content/70 text-xs w-28 inline-block">offline</span>
    <div class="flex items-center gap-2"><div class="bg-error h-2 w-2 animate-pulse rounded-full"></div><span class="text-error text-sm">Offline</span></div></div>
  <div class="flex items-center gap-2"><span class="text-base-content/70 text-xs w-28 inline-block">typing</span>
    <div class="flex items-center gap-2 px-4 py-2 text-sm text-base-content/85">
      <div class="flex gap-1"><div class="bg-primary h-2 w-2 animate-bounce rounded-full"></div><div class="bg-primary h-2 w-2 animate-bounce rounded-full"></div><div class="bg-primary h-2 w-2 animate-bounce rounded-full"></div></div>
      <span>Alex is typing...</span></div></div>
</div>`;
}

// ---- Token cards ----
// OKLCH values per theme, copied verbatim from globals.css.
const SEMANTIC_COLORS = [
  'primary',
  'secondary',
  'accent',
  'neutral',
  'info',
  'success',
  'warning',
  'error',
];
const BASES = ['base-100', 'base-200', 'base-300', 'base-content'];

function colorsCard() {
  let out = '<div class="flex flex-col gap-4">';
  out += '<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">';
  for (const c of SEMANTIC_COLORS) {
    out += `<div class="rounded-box overflow-hidden border border-base-300">
      <div class="bg-${c} text-${c}-content flex h-16 items-center justify-center text-sm font-medium">${c}</div>
      <div class="bg-base-200 text-base-content/70 px-2 py-1 text-[10px]">${c} / ${c}-content</div>
    </div>`;
  }
  out += '</div>';
  out += '<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">';
  for (const c of BASES) {
    out += `<div class="rounded-box overflow-hidden border border-base-300">
      <div class="bg-${c} flex h-12 items-center justify-center text-xs ${c === 'base-content' ? 'text-base-100' : 'text-base-content'}">${c}</div>
    </div>`;
  }
  out += '</div></div>';
  return out;
}

function shapeCard() {
  const radii = [
    ['radius-selector', '0.75rem', 'rounded-selector'],
    ['radius-field', '0.5rem', 'rounded-field'],
    ['radius-box', '1.5rem', 'rounded-box'],
  ];
  let out = '<div class="flex flex-col gap-4">';
  out += '<div class="flex flex-wrap gap-4">';
  for (const [name, val, cls] of radii) {
    out += `<div class="flex flex-col items-center gap-1">
      <div class="bg-primary ${cls} h-16 w-16"></div>
      <span class="text-base-content/70 text-[10px]">${name}</span><span class="text-base-content/50 text-[10px]">${val}</span>
    </div>`;
  }
  out += '</div>';
  out += '<div class="flex flex-wrap items-end gap-4">';
  out +=
    '<div class="flex flex-col items-center gap-1"><div class="bg-base-200 border border-base-content h-12 w-12 rounded-field"></div><span class="text-base-content/70 text-[10px]">--border 1px</span></div>';
  out +=
    '<div class="flex flex-col items-center gap-1"><div class="bg-base-100 card h-12 w-12"></div><span class="text-base-content/70 text-[10px]">--depth shadow</span></div>';
  out += '</div></div>';
  return out;
}

function typographyTokenCard() {
  // reuse the Text scale but framed as type tokens
  return textCard();
}

// ---- AvatarDisplay (4 sizes; image + initials fallback) ----
// sizeClasses/ringClasses copied verbatim from AvatarDisplay.tsx
const AVATAR_SIZES = [
  [
    'sm',
    'w-8 h-8 text-sm',
    'ring-1 ring-base-content/20 ring-offset-1 ring-offset-base-100',
  ],
  [
    'md',
    'w-12 h-12 text-base',
    'ring-2 ring-base-content/25 ring-offset-2 ring-offset-base-100',
  ],
  [
    'lg',
    'w-16 h-16 text-lg',
    'ring-2 ring-base-content/25 ring-offset-2 ring-offset-base-100',
  ],
  [
    'xl',
    'w-24 h-24 text-2xl',
    'ring-2 ring-base-content/25 ring-offset-2 ring-offset-base-100',
  ],
];
function avatarCard() {
  let out = '<div class="flex flex-col gap-5">';
  out +=
    '<div class="flex items-end gap-4"><span class="text-base-content/70 text-xs w-20 inline-block">initials</span>';
  for (const [, size, ring] of AVATAR_SIZES) {
    out += `<div class="avatar"><div class="${size} overflow-hidden rounded-full ${ring}"><div class="bg-primary text-primary-content flex h-full w-full items-center justify-center font-semibold">JD</div></div></div>`;
  }
  out += '</div>';
  out +=
    '<div class="flex items-end gap-4"><span class="text-base-content/70 text-xs w-20 inline-block">accent</span>';
  for (const [, size, ring] of AVATAR_SIZES) {
    out += `<div class="avatar"><div class="${size} overflow-hidden rounded-full ${ring}"><div class="bg-accent text-accent-content flex h-full w-full items-center justify-center font-semibold">SH</div></div></div>`;
  }
  out += '</div></div>';
  return out;
}

// ---- PasswordStrengthIndicator (3 strengths) ----
// strengthConfig copied verbatim from PasswordStrengthIndicator.tsx
const PW_STRENGTHS = [
  [
    'Weak',
    'bg-error',
    'text-error',
    '33%',
    'Add more characters, uppercase, numbers, and symbols',
  ],
  [
    'Medium',
    'bg-warning',
    'text-warning',
    '66%',
    'Good! Consider adding more variety',
  ],
  ['Strong', 'bg-success', 'text-success', '100%', 'Excellent password!'],
];
function passwordStrengthCard() {
  let out = '<div class="flex flex-col gap-5 w-full max-w-sm">';
  for (const [label, color, textColor, width, desc] of PW_STRENGTHS) {
    out += `<div>
      <div class="bg-base-300 h-2 w-full overflow-hidden rounded-full"><div class="h-full ${color}" style="width:${width}"></div></div>
      <div class="mt-2 flex items-center justify-between"><span class="text-sm font-medium ${textColor}">${label}</span><span class="text-base-content/85 text-xs">${desc}</span></div>
    </div>`;
  }
  out += '</div>';
  return out;
}

// ---- ReadReceipt (sent / delivered / read) ----
function check(cls) {
  return `<svg class="${cls} h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
}
function readReceiptCard() {
  return `
<div class="flex flex-col gap-4">
  <div class="flex items-center gap-3"><span class="text-base-content/70 text-xs w-24 inline-block">sent</span><div class="inline-flex items-center">${check('text-base-content')}</div></div>
  <div class="flex items-center gap-3"><span class="text-base-content/70 text-xs w-24 inline-block">delivered</span><div class="inline-flex items-center"><div class="relative h-4 w-5">${check('text-base-content absolute left-0')}${check('text-base-content absolute left-1')}</div></div></div>
  <div class="flex items-center gap-3"><span class="text-base-content/70 text-xs w-24 inline-block">read</span><div class="inline-flex items-center"><div class="relative h-4 w-5">${check('text-primary absolute left-0')}${check('text-primary absolute left-1')}</div></div></div>
</div>`;
}

// ---- Pagination (join pattern, verbatim classes) ----
function paginationCard() {
  return `
<div class="flex flex-col gap-4 items-center">
  <nav class="flex items-center justify-center gap-2 py-2">
    <div class="join">
      <button class="btn btn-sm join-item min-h-11 min-w-11" disabled aria-label="Previous page">«</button>
      <span class="btn btn-sm join-item btn-disabled min-h-11 !text-base-content">Page 1 of 8</span>
      <button class="btn btn-sm join-item min-h-11 min-w-11" aria-label="Next page">»</button>
    </div>
  </nav>
  <nav class="flex items-center justify-center gap-2 py-2">
    <div class="join">
      <button class="btn btn-sm join-item min-h-11 min-w-11" aria-label="Previous page">«</button>
      <span class="btn btn-sm join-item btn-disabled min-h-11 !text-base-content">Page 4 of 8</span>
      <button class="btn btn-sm join-item min-h-11 min-w-11" aria-label="Next page">»</button>
    </div>
  </nav>
</div>`;
}

// ---- Form inputs (ValidatedInput states + FormField wrapper) ----
const INPUT_SIZES = [
  ['xs', 'input-xs min-h-11'],
  ['sm', 'input-sm min-h-11'],
  ['md', 'input-md min-h-11'],
  ['lg', 'input-lg'],
];
function errIcon() {
  return '<svg class="text-error h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>';
}
function okIcon() {
  return '<svg class="text-success h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>';
}
function inputsCard() {
  let out = '<div class="flex flex-col gap-5 w-full max-w-sm">';
  // sizes
  out += '<div class="flex flex-col gap-2">';
  for (const [name, cls] of INPUT_SIZES) {
    out += `<div class="relative w-full"><input class="input ${cls} w-full" placeholder="${name} input" /></div>`;
  }
  out += '</div>';
  // states via FormField wrapper (DaisyUI v5: no form-control/label-text; .label + text utilities)
  out += `<div class="flex flex-col gap-1"><label class="text-sm font-medium text-base-content">Email address<span class="text-error ml-1">*</span></label>
    <div class="relative w-full"><input class="input input-md min-h-11 input-success w-full" value="dev@scripthammer.com" /><div class="absolute top-1/2 right-3 -translate-y-1/2">${okIcon()}</div></div>
    <div class="text-base-content/85 text-xs">Looks good.</div></div>`;
  out += `<div class="flex flex-col gap-1"><label class="text-sm font-medium text-base-content">Password<span class="text-error ml-1">*</span></label>
    <div class="relative w-full"><input class="input input-md min-h-11 input-error w-full" value="short" type="password" /><div class="absolute top-1/2 right-3 -translate-y-1/2">${errIcon()}</div></div>
    <div class="text-error text-xs">Must be at least 8 characters.</div></div>`;
  out += `<div class="flex flex-col gap-1"><label class="text-sm font-medium text-base-content">Loading</label>
    <div class="relative w-full"><input class="input input-md min-h-11 opacity-75 w-full" value="checking..." /><div class="absolute top-1/2 right-3 -translate-y-1/2"><span class="loading loading-spinner loading-xs text-base-content"></span></div></div></div>`;
  out += '</div>';
  return out;
}

// ---- SocialIcon (configured platforms) ----
const SOCIAL = {
  github:
    '<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>',
  twitter:
    '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>',
  linkedin:
    '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>',
  twitch:
    '<path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>',
};
// ---- Sparkline (SVG, theme-reactive via var() tokens; verbatim geometry) ----
const VB_W = 100,
  VB_H = 24,
  PAD_Y = 1,
  PLOT_H = VB_H - PAD_Y * 2;
const SPARK_TOKENS = {
  primary: 'var(--color-primary)',
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  info: 'var(--color-info)',
};
function sparklineSvg(data, tone) {
  const maxY = Math.max(1, ...data);
  const xStep = VB_W / (data.length - 1);
  const yOf = (v) => PAD_Y + PLOT_H - (v / maxY) * PLOT_H;
  const points = data
    .map((v, i) => `${(i * xStep).toFixed(1)},${yOf(v).toFixed(1)}`)
    .join(' ');
  const areaPath = `M 0,${VB_H} L ${points.replace(/ /g, ' L ')} L ${VB_W},${VB_H} Z`;
  const stroke = SPARK_TOKENS[tone];
  return `<svg viewBox="0 0 ${VB_W} ${VB_H}" width="100%" preserveAspectRatio="none" class="w-40 h-10" role="img" aria-label="${tone} trend">
    <path d="${areaPath}" fill="${stroke}" fill-opacity="0.15"></path>
    <polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"></polyline>
  </svg>`;
}
function sparklineCard() {
  const series = {
    primary: [3, 5, 4, 8, 6, 9, 7, 11, 10, 14],
    success: [2, 3, 5, 4, 6, 7, 6, 9, 11, 13],
    error: [12, 10, 11, 8, 9, 6, 7, 4, 5, 2],
    info: [5, 6, 5, 7, 6, 8, 7, 8, 9, 8],
  };
  let out = '<div class="flex flex-col gap-4">';
  for (const [tone, data] of Object.entries(series)) {
    out += `<div class="flex items-center gap-3"><span class="text-base-content/70 text-xs w-20 inline-block">${tone}</span>${sparklineSvg(data, tone)}</div>`;
  }
  out += '</div>';
  return out;
}

// ---- MessageBubble (chat-start/chat-end, markdown; verbatim chat-* classes) ----
function messageBubbleCard() {
  return `
<div class="flex flex-col gap-3 w-full max-w-md">
  <div class="chat chat-start">
    <div class="chat-header mb-1"><span class="text-xs opacity-70">Alex</span></div>
    <div class="chat-bubble chat-bubble-secondary"><p>Hey! Did you see the <strong>new design system</strong>?</p></div>
  </div>
  <div class="chat chat-end">
    <div class="chat-header mb-1"><span class="text-xs opacity-70">You</span></div>
    <div class="chat-bubble chat-bubble-primary"><p>Yes — it has <em>both themes</em> and <code class="bg-base-300 rounded px-1">tokens</code>.</p></div>
    <div class="chat-footer mt-1 flex items-center gap-1"><span class="text-xs opacity-60">12:04</span>
      <div class="relative h-4 w-5">${check('text-primary absolute left-0')}${check('text-primary absolute left-1')}</div></div>
  </div>
</div>`;
}

// ---- QueuedMessageBubble (pending + failed; verbatim classes) ----
function queuedMessageBubbleCard() {
  return `
<div class="flex flex-col gap-3 w-full max-w-md">
  <div class="chat chat-end">
    <div class="chat-bubble chat-bubble-primary opacity-70"><p class="break-words whitespace-pre-wrap">Sending this one now…</p></div>
    <div class="chat-footer mt-1 flex items-center gap-2"><span class="loading loading-spinner loading-xs" aria-hidden="true"></span><span class="text-base-content text-xs">Sending...</span></div>
  </div>
  <div class="chat chat-end">
    <div class="chat-bubble chat-bubble-error"><p class="break-words whitespace-pre-wrap">This one failed to send.</p></div>
    <div class="chat-footer mt-1 flex items-center gap-2">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-error h-4 w-4" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span class="text-error text-xs">Failed to send (1 retry)</span>
      <button class="btn btn-xs btn-outline btn-error min-h-11 min-w-11">Retry</button>
    </div>
  </div>
</div>`;
}

function socialIconCard() {
  let out = '<div class="flex flex-col gap-4">';
  const rows = [
    ['base-content', 'text-base-content'],
    ['primary', 'text-primary'],
    ['accent', 'text-accent'],
  ];
  for (const [label, color] of rows) {
    out += `<div class="flex items-center gap-4"><span class="text-base-content/70 text-xs w-24 inline-block">${label}</span>`;
    for (const [, path] of Object.entries(SOCIAL)) {
      out += `<svg class="h-6 w-6 ${color}" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
    }
    out += '</div>';
  }
  out += '</div>';
  return out;
}

module.exports = {
  // group names map to Design System pane sections
  tokens: [
    { slug: 'colors', group: 'Tokens', title: 'Colors', render: colorsCard },
    {
      slug: 'shape',
      group: 'Tokens',
      title: 'Shape & radius',
      render: shapeCard,
    },
    {
      slug: 'typography',
      group: 'Tokens',
      title: 'Typography scale',
      render: typographyTokenCard,
    },
  ],
  components: [
    { slug: 'button', group: 'Buttons', title: 'Button', render: buttonCard },
    { slug: 'card', group: 'Cards', title: 'Card', render: cardCard },
    {
      slug: 'tag-badge',
      group: 'Badges',
      title: 'TagBadge',
      render: tagBadgeCard,
    },
    {
      slug: 'tooltip',
      group: 'Overlays',
      title: 'Tooltip',
      render: tooltipCard,
    },
    { slug: 'text', group: 'Typography', title: 'Text', render: textCard },
    {
      slug: 'status',
      group: 'Status',
      title: 'Network & typing status',
      render: statusCard,
    },
    {
      slug: 'avatar',
      group: 'Media',
      title: 'AvatarDisplay',
      render: avatarCard,
    },
    {
      slug: 'inputs',
      group: 'Forms',
      title: 'Form inputs',
      render: inputsCard,
    },
    {
      slug: 'password-strength',
      group: 'Forms',
      title: 'PasswordStrengthIndicator',
      render: passwordStrengthCard,
    },
    {
      slug: 'pagination',
      group: 'Navigation',
      title: 'Pagination',
      render: paginationCard,
    },
    {
      slug: 'read-receipt',
      group: 'Status',
      title: 'ReadReceipt',
      render: readReceiptCard,
    },
    {
      slug: 'social-icon',
      group: 'Media',
      title: 'SocialIcon',
      render: socialIconCard,
    },
    {
      slug: 'sparkline',
      group: 'Data',
      title: 'Sparkline',
      render: sparklineCard,
    },
    {
      slug: 'message-bubble',
      group: 'Messaging',
      title: 'MessageBubble',
      render: messageBubbleCard,
    },
    {
      slug: 'queued-message-bubble',
      group: 'Messaging',
      title: 'QueuedMessageBubble',
      render: queuedMessageBubbleCard,
    },
  ],
};
