import React from 'react';

function Chakra({ reverse = false }) {
  return (
    <div
      className="absolute inset-0 rounded-full"
      style={{
        animation: `${reverse ? 'chakraSpinReverse' : 'chakraSpin'} ${
          reverse ? '52s' : '46s'
        } linear infinite`,
        willChange: 'transform',
      }}
    >
      {/* Outer wheel */}
      <div className="absolute inset-0 rounded-full border border-yellow-400/30 shadow-[0_0_40px_rgba(234,179,8,0.12),inset_0_0_25px_rgba(234,179,8,0.05)]" />

      {/* Spokes */}
      {Array.from({ length: 16 }).map((_, index) => (
        <span
          key={index}
          className="absolute left-1/2 top-1/2 h-[49%] w-px origin-bottom bg-gradient-to-t from-yellow-300/5 via-yellow-300/15 to-yellow-300/30"
          style={{
            transform: `translateX(-50%) translateY(-100%) rotate(${
              index * 22.5
            }deg)`,
          }}
        />
      ))}

      {/* Inner rings */}
      <div className="absolute inset-[8%] rounded-full border border-yellow-400/20" />
      <div className="absolute inset-[18%] rounded-full border border-yellow-300/15" />
      <div className="absolute inset-[28%] rounded-full border border-dashed border-yellow-300/20" />
      <div className="absolute inset-[40%] rounded-full border border-yellow-300/20" />

      {/* Center */}
      <div className="absolute left-1/2 top-1/2 h-[16%] w-[16%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-300/30 shadow-[0_0_20px_rgba(234,179,8,0.14)]" />
    </div>
  );
}

export default function ChakraBackground({
  className = '',
  chakraSize = 'min(42vw, 42vh, 460px)',
}) {
  return (
    <>
      <style>{`
        @keyframes chakraTopMotionOne {
          0% {
            transform: translate(-50%, -50%) translate3d(-50px, -40px, 0) rotate(-18deg);
          }
          25% {
            transform: translate(-50%, -50%) translate3d(40px, -60px, 0) rotate(90deg);
          }
          50% {
            transform: translate(-50%, -50%) translate3d(60px, 30px, 0) rotate(180deg);
          }
          75% {
            transform: translate(-50%, -50%) translate3d(-40px, 50px, 0) rotate(270deg);
          }
          100% {
            transform: translate(-50%, -50%) translate3d(-50px, -40px, 0) rotate(360deg);
          }
        }

        @keyframes chakraTopMotionTwo {
          0% {
            transform: translate(-50%, -50%) translate3d(50px, 40px, 0) rotate(18deg);
          }
          25% {
            transform: translate(-50%, -50%) translate3d(-40px, 60px, 0) rotate(-90deg);
          }
          50% {
            transform: translate(-50%, -50%) translate3d(-60px, -30px, 0) rotate(-180deg);
          }
          75% {
            transform: translate(-50%, -50%) translate3d(40px, -50px, 0) rotate(-270deg);
          }
          100% {
            transform: translate(-50%, -50%) translate3d(50px, 40px, 0) rotate(-360deg);
          }
        }

        @keyframes chakraSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes chakraSpinReverse {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(-360deg);
          }
        }

        .chakra-one-orbit {
          animation: chakraTopMotionOne 28s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
          will-change: transform;
        }

        .chakra-two-orbit {
          animation: chakraTopMotionTwo 28s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
          will-change: transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .chakra-one-orbit,
          .chakra-two-orbit,
          .chakra-one-orbit *,
          .chakra-two-orbit * {
            animation: none !important;
          }
        }
      `}</style>

      <div
        className={`pointer-events-none absolute inset-0 z-0 overflow-hidden w-full h-full max-w-full max-h-full ${className}`}
        aria-hidden="true"
        style={{ containment: 'strict' }}
      >
        {/* Center point of both chakra movements */}
        <div className="absolute left-1/2 top-1/2 h-0 w-0">
          {/* Chakra 1 */}
          <div
            className="chakra-one-orbit absolute left-0 top-0"
            style={{
              width: chakraSize,
              height: chakraSize,
            }}
          >
            <Chakra />
          </div>

          {/* Chakra 2 */}
          <div
            className="chakra-two-orbit absolute left-0 top-0"
            style={{
              width: chakraSize,
              height: chakraSize,
            }}
          >
            <Chakra reverse />
          </div>
        </div>

        {/* Subtle ambient glow */}
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400/[0.02] blur-3xl" />
      </div>
    </>
  );
}
