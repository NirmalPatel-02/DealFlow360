export default function SketchHighlight({ children, className = '' }) {
  return (
    <span className={`sketch-highlight ${className}`.trim()}>
      <span className="sketch-highlight-text">{children}</span>
      <svg className="sketch-circle" viewBox="0 0 220 64" fill="none" aria-hidden="true">
        <path
          d="M18 34c8-16 48-24 96-24 54-1 92 10 99 26 6 14-18 22-62 26-42 4-96 1-118-12-10-6-8-18 6-22 18-5 62-8 108-4"
          stroke="#E6C229"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
