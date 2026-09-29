'use client';

import React from 'react';

const DEFAULT_ACCENT = '#D8D9DE';
const BASE_DARK = '#0A0A0B';
const BASE_MID = '#17181C';
const BASE_EDGE = '#24262C';

function hashString(value) {
  const input = String(value || 'street platinum');
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function normaliseHex(hex) {
  if (typeof hex !== 'string') return DEFAULT_ACCENT;
  const trimmed = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  return DEFAULT_ACCENT;
}

function initialsFrom(name) {
  const words = String(name || 'Street Platinum')
    .replace(/[^a-zA-Z0-9\s/-]/g, ' ')
    .split(/[\s/-]+/)
    .filter(Boolean);
  if (words.length === 0) return 'SP';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function ProductArtwork({
  name = 'STREET/PLATINUM piece',
  accentHex = DEFAULT_ACCENT,
  category = 'streetwear',
  ratio = '4/5',
}) {
  const accent = normaliseHex(accentHex);
  const seed = hashString(`${name}|${category}`);
  const initials = initialsFrom(name);

  const streakOffset = 12 + (seed % 26); // 12 – 37
  const streakWidth = 14 + ((seed >> 3) % 18); // 14 – 31
  const streakTilt = -28 + ((seed >> 5) % 22); // -28 – -7
  const glowX = 22 + ((seed >> 7) % 56);
  const glowY = 18 + ((seed >> 9) % 40);
  const gridStep = 16 + ((seed >> 11) % 10);
  const gradientId = `art-grad-${seed}`;
  const streakId = `art-streak-${seed}`;
  const glowId = `art-glow-${seed}`;
  const gridId = `art-grid-${seed}`;

  const label = `${name} — ${category} artwork`;

  return (
    <div
      className="product-artwork"
      data-category={category}
      style={{ ['--artwork-ratio']: ratio }}
    >
      <svg
        className="product-artwork__svg"
        viewBox="0 0 400 500"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={label}
        focusable="false"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={BASE_EDGE} />
            <stop offset="45%" stopColor={BASE_MID} />
            <stop offset="100%" stopColor={BASE_DARK} />
          </linearGradient>

          <linearGradient id={streakId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={accent} stopOpacity="0" />
            <stop offset="45%" stopColor={accent} stopOpacity="0.85" />
            <stop offset="65%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>

          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.32" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>

          <pattern
            id={gridId}
            width={gridStep}
            height={gridStep}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`}
              fill="none"
              stroke={accent}
              strokeOpacity="0.08"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <rect x="0" y="0" width="400" height="500" fill={`url(#${gradientId})`} />
        <rect x="0" y="0" width="400" height="500" fill={`url(#${gridId})`} />

        <ellipse
          cx={glowX * 4}
          cy={glowY * 5}
          rx="210"
          ry="210"
          fill={`url(#${glowId})`}
        />

        <g transform={`rotate(${streakTilt} 200 250)`}>
          <rect
            x={streakOffset * 4}
            y="-160"
            width={streakWidth * 4}
            height="820"
            fill={`url(#${streakId})`}
          />
          <rect
            x={streakOffset * 4 + streakWidth * 4 + 18}
            y="-160"
            width="6"
            height="820"
            fill={accent}
            fillOpacity="0.35"
          />
        </g>

        <g opacity="0.92">
          <text
            x="200"
            y="268"
            textAnchor="middle"
            fontFamily="var(--font-display, ui-sans-serif, system-ui, sans-serif)"
            fontSize="132"
            fontWeight="700"
            letterSpacing="-6"
            fill={accent}
            fillOpacity="0.9"
          >
            {initials}
          </text>
          <text
            x="200"
            y="318"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize="18"
            fontWeight="600"
            letterSpacing="7"
            fill="#FFFFFF"
            fillOpacity="0.55"
          >
            STREET/PLATINUM
          </text>
        </g>

        <rect
          x="14"
          y="14"
          width="372"
          height="472"
          fill="none"
          stroke={accent}
          strokeOpacity="0.22"
          strokeWidth="1.5"
          rx="10"
        />
      </svg>
    </div>
  );
}