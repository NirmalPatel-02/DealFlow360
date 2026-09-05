import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SketchHighlight from '../../../components/ui/SketchHighlight.jsx';

const dealFlowText = 'DealFlow360';

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
      <div className="absolute inset-0 rounded-full border border-yellow-400/30 shadow-[0_0_55px_rgba(234,179,8,0.13),inset_0_0_35px_rgba(234,179,8,0.06)]" />

      {/* Decorative spokes */}
      {Array.from({ length: 16 }).map((_, index) => (
        <span
          key={index}
          className="absolute left-1/2 top-1/2 h-[49%] w-px origin-bottom bg-gradient-to-t from-yellow-300/5 via-yellow-300/15 to-yellow-300/35"
          style={{
            transform: `translateX(-50%) translateY(-100%) rotate(${
              index * 22.5
            }deg)`,
          }}
        />
      ))}

      {/* Circular rings */}
      <div className="absolute inset-[7%] rounded-full border border-yellow-400/20" />
      <div className="absolute inset-[15%] rounded-full border border-yellow-300/15" />
      <div className="absolute inset-[25%] rounded-full border border-dashed border-yellow-300/20" />
      <div className="absolute inset-[38%] rounded-full border border-yellow-300/20" />

      {/* Center */}
      <div className="absolute left-1/2 top-1/2 h-[16%] w-[16%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-300/30 shadow-[0_0_28px_rgba(234,179,8,0.16)]" />
    </div>
  );
}

export default function LandingPage() {
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const [isTextComplete, setIsTextComplete] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleMotionPreference = () => {
      setReducedMotion(mediaQuery.matches);
    };

    handleMotionPreference();
    mediaQuery.addEventListener?.('change', handleMotionPreference);

    return () => {
      mediaQuery.removeEventListener?.('change', handleMotionPreference);
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setVisibleCharacters(dealFlowText.length);
      setIsTextComplete(true);
      return undefined;
    }

    let characterIndex = 0;
    let typingInterval;

    const startDelay = setTimeout(() => {
      typingInterval = setInterval(() => {
        characterIndex += 1;
        setVisibleCharacters(characterIndex);

        if (characterIndex >= dealFlowText.length) {
          clearInterval(typingInterval);
          setIsTextComplete(true);
        }
      }, 105);
    }, 180);

    return () => {
      clearTimeout(startDelay);
      clearInterval(typingInterval);
    };
  }, [reducedMotion]);

  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      <style>{`
        /*
          BOTH CHAKRAS HAVE THEIR ORBIT CENTER AT THE
          EXACT CENTER OF THE PAGE.

          Their centers travel around the same central point,
          allowing them to naturally cross and intersect.
        */

        @keyframes chakraOrbitOne {
          0% {
            transform:
              translate(-50%, -50%)
              rotate(0deg)
              translateX(180px)
              rotate(0deg);
          }

          25% {
            transform:
              translate(-50%, -50%)
              rotate(90deg)
              translateX(180px)
              rotate(-90deg);
          }

          50% {
            transform:
              translate(-50%, -50%)
              rotate(180deg)
              translateX(180px)
              rotate(-180deg);
          }

          75% {
            transform:
              translate(-50%, -50%)
              rotate(270deg)
              translateX(180px)
              rotate(-270deg);
          }

          100% {
            transform:
              translate(-50%, -50%)
              rotate(360deg)
              translateX(180px)
              rotate(-360deg);
          }
        }

        @keyframes chakraOrbitTwo {
          0% {
            transform:
              translate(-50%, -50%)
              rotate(180deg)
              translateX(180px)
              rotate(180deg);
          }

          25% {
            transform:
              translate(-50%, -50%)
              rotate(90deg)
              translateX(180px)
              rotate(-90deg);
          }

          50% {
            transform:
              translate(-50%, -50%)
              rotate(0deg)
              translateX(180px)
              rotate(0deg);
          }

          75% {
            transform:
              translate(-50%, -50%)
              rotate(-90deg)
              translateX(180px)
              rotate(90deg);
          }

          100% {
            transform:
              translate(-50%, -50%)
              rotate(-180deg)
              translateX(180px)
              rotate(180deg);
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

        @keyframes characterReveal {
          from {
            opacity: 0;
            transform: translate3d(-2px, 0, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes handDrawStroke {
          from {
            stroke-dashoffset: 1;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        .chakra-one-orbit {
          animation:
            chakraOrbitOne 38s cubic-bezier(0.45, 0.05, 0.55, 0.95)
            infinite;
          will-change: transform;
        }

        .chakra-two-orbit {
          animation:
            chakraOrbitTwo 38s cubic-bezier(0.45, 0.05, 0.55, 0.95)
            infinite;
          will-change: transform;
        }

        .dealflow-character {
          display: inline-block;
          animation:
            characterReveal 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
          will-change: opacity, transform;
        }

        .hand-drawn-stroke {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
        }

        .hand-drawn-stroke.is-drawn {
          animation:
            handDrawStroke 1.25s cubic-bezier(0.22, 1, 0.36, 1)
            forwards;
        }

        @media (max-width: 768px) {
          @keyframes chakraOrbitOne {
            0% {
              transform:
                translate(-50%, -50%)
                rotate(0deg)
                translateX(90px)
                rotate(0deg);
            }
            100% {
              transform:
                translate(-50%, -50%)
                rotate(360deg)
                translateX(90px)
                rotate(-360deg);
            }
          }

          @keyframes chakraOrbitTwo {
            0% {
              transform:
                translate(-50%, -50%)
                rotate(180deg)
                translateX(90px)
                rotate(180deg);
            }
            100% {
              transform:
                translate(-50%, -50%)
                rotate(-180deg)
                translateX(90px)
                rotate(180deg);
            }
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .chakra-one-orbit,
          .chakra-two-orbit {
            animation: none !important;
          }

          .chakra-one-orbit *,
          .chakra-two-orbit * {
            animation: none !important;
          }

          .dealflow-character,
          .hand-drawn-stroke.is-drawn {
            animation: none !important;
          }

          .hand-drawn-stroke {
            stroke-dashoffset: 0;
          }
        }
      `}</style>

      {/* CHAKRA BACKGROUND */}
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        {/* Center reference point */}
        <div className="absolute left-1/2 top-1/2 h-0 w-0">
          {/* Chakra 1 */}
          <div
            className="chakra-one-orbit absolute left-0 top-0"
            style={{
              width: 'min(62vw, 780px)',
              height: 'min(62vw, 780px)',
              minWidth: '500px',
              minHeight: '500px',
            }}
          >
            <Chakra />
          </div>

          {/* Chakra 2 - opposite orbit direction */}
          <div
            className="chakra-two-orbit absolute left-0 top-0"
            style={{
              width: 'min(62vw, 780px)',
              height: 'min(62vw, 780px)',
              minWidth: '500px',
              minHeight: '500px',
            }}
          >
            <Chakra reverse />
          </div>
        </div>

        {/* Very subtle central glow */}
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400/[0.02] blur-3xl" />
      </div>

      {/* PAGE CONTENT */}
      <section className="landing relative z-10">
        <p className="eyebrow">Deal operating system</p>

        <h1 className="display-title">
          Close cleaner deals with{' '}
          <span className="relative inline-block whitespace-nowrap">
            <SketchHighlight>
              <span className="relative inline-flex">
                {dealFlowText
                  .slice(0, visibleCharacters)
                  .split('')
                  .map((character, index) => (
                    <span
                      key={`${character}-${index}`}
                      className="dealflow-character"
                      style={{
                        animationDelay: `${index * 18}ms`,
                      }}
                    >
                      {character}
                    </span>
                  ))}

                <span
                  className="pointer-events-none invisible absolute left-0 top-0"
                  aria-hidden="true"
                >
                  {dealFlowText}
                </span>
              </span>
            </SketchHighlight>

            {/* Hand-drawn underline */}
            <svg
              className="pointer-events-none absolute -bottom-[0.42em] left-[-7%] h-[0.85em] w-[114%] overflow-visible"
              viewBox="0 0 300 55"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                className={`hand-drawn-stroke ${
                  isTextComplete ? 'is-drawn' : ''
                }`}
                pathLength="1"
                d="M8,27 C18,45 55,51 105,48 C155,53 238,50 291,24"
                fill="none"
                stroke="#eab308"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />

              <path
                className={`hand-drawn-stroke ${
                  isTextComplete ? 'is-drawn' : ''
                }`}
                pathLength="1"
                d="M13,31 C48,51 95,52 145,49 C197,52 253,47 286,28"
                fill="none"
                stroke="#facc15"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.38"
                style={{
                  animationDelay: isTextComplete ? '120ms' : '0ms',
                }}
              />
            </svg>
          </span>
        </h1>

        <p className="subheading">
          Built for sales teams that need control, not clutter.
        </p>

        <p className="body-copy landing-copy">
          Registration and access are limited to{' '}
          <SketchHighlight>Sales Representatives</SketchHighlight>. Choose how
          you want to continue.
        </p>

        <div className="landing-actions">
          <Link to="/login" className="btn btn-primary btn-xl">
            Login
          </Link>

          <Link to="/register" className="btn btn-outline btn-xl">
            Register
          </Link>
        </div>
      </section>
    </main>
  );
}