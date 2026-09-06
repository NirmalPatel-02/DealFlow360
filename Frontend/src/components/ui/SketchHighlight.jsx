import { useEffect, useState } from 'react';

export default function SketchHighlight({
  children,
  className = '',
  speed = 1.25, // Animation duration in seconds
  delay = 0,    // Start delay in seconds
}) {
  const [isDrawn, setIsDrawn] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsDrawn(true);
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <span
      className={`relative inline-block ${className}`}
      style={{ isolation: 'isolate' }}
    >
      <span className="relative z-10">{children}</span>

      <svg
        className="pointer-events-none absolute -inset-[0.28em] z-0 h-[calc(100%+0.56em)] w-[calc(100%+0.56em)] overflow-visible"
        viewBox="0 0 300 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* Main hand-drawn circle */}
        <path
          className={`sketch-highlight-stroke ${
            isDrawn ? 'is-drawn' : ''
          }`}
          pathLength="1"
          d="
            M 150 7
            C 205 7, 274 18, 291 46
            C 308 73, 251 94, 151 95
            C 54 96, -2 75, 9 48
            C 20 20, 85 7, 150 7
          "
          fill="none"
          stroke="#eab308"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />

        {/* Slight secondary sketch stroke */}
        <path
          className={`sketch-highlight-stroke sketch-highlight-secondary ${
            isDrawn ? 'is-drawn' : ''
          }`}
          pathLength="1"
          d="
            M 147 11
            C 201 10, 265 21, 285 47
            C 300 69, 246 89, 151 91
            C 62 93, 8 72, 18 48
            C 29 25, 88 11, 147 11
          "
          fill="none"
          stroke="#facc15"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.38"
          style={{
            animationDelay: isDrawn ? `${Math.min(speed * 1000, 120)}ms` : '0ms',
          }}
        />
      </svg>

      <style>{`
        @keyframes sketchHighlightDraw {
          from {
            stroke-dashoffset: 1;
          }

          to {
            stroke-dashoffset: 0;
          }
        }

        .sketch-highlight-stroke {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
        }

        .sketch-highlight-stroke.is-drawn {
          animation:
            sketchHighlightDraw ${speed}s
            cubic-bezier(0.22, 1, 0.36, 1)
            forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .sketch-highlight-stroke {
            stroke-dashoffset: 0;
            animation: none !important;
          }
        }
      `}</style>
    </span>
  );
}
