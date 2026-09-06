import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SketchHighlight from "../../../components/ui/SketchHighlight.jsx";
import ChakraBackground from "../../dashboard/components/ui/ChakraBackground.jsx";

const dealFlowText = "DealFlow360";

function Chakra({ reverse = false, speed = 46 }) {
  return (
    <div
      className="chakra-wheel absolute left-1/2 top-1/2 rounded-full"
      style={{
        width: "max(100vw, 100vh)",
        height: "max(100vw, 100vh)",
        marginLeft: "calc(max(100vw, 100vh) / -2)",
        marginTop: "calc(max(100vw, 100vh) / -2)",
        animationName: reverse ? "chakraSpinReverse" : "chakraSpin",
        animationDuration: `${speed}s`,
        animationTimingFunction: "linear",
        animationIterationCount: "infinite",
        willChange: "transform",
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
  const [scrollBoost, setScrollBoost] = useState(1);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const handleMotionPreference = () => {
      setReducedMotion(mediaQuery.matches);
    };

    handleMotionPreference();

    mediaQuery.addEventListener?.("change", handleMotionPreference);

    return () => {
      mediaQuery.removeEventListener?.("change", handleMotionPreference);
    };
  }, []);

  /*
   * Detect scrolling / wheel / touch movement.
   *
   * The chakra speed is increased while the user is actively
   * scrolling, then returns to normal shortly after scrolling stops.
   */
  useEffect(() => {
    let stopTimer;

    const handleScrollIntent = () => {
      setScrollBoost(2.2);

      window.clearTimeout(stopTimer);

      stopTimer = window.setTimeout(() => {
        setScrollBoost(1);
      }, 180);
    };

    const handleWheelIntent = () => {
      handleScrollIntent();
    };

    const handleTouchMove = () => {
      handleScrollIntent();
    };

    window.addEventListener("scroll", handleScrollIntent, {
      passive: true,
    });

    window.addEventListener("wheel", handleWheelIntent, {
      passive: true,
    });

    window.addEventListener("touchmove", handleTouchMove, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScrollIntent);
      window.removeEventListener("wheel", handleWheelIntent);
      window.removeEventListener("touchmove", handleTouchMove);

      window.clearTimeout(stopTimer);
    };
  }, []);

  /*
   * Lower animation duration = faster rotation.
   *
   * Normal:
   *   Chakra 1 = 46s
   *   Chakra 2 = 52s
   *
   * During scroll:
   *   duration is divided by 2.2
   */
  const chakraSpeed = reducedMotion ? 1 : scrollBoost;

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
    <main className="landing-main-viewport">
     
      <ChakraBackground />
      {/* PAGE CONTENT */}
      <section className="landing relative z-10" style={{ margin: 0 }}>
        {/* <p className="eyebrow">Deal operating system</p> */}

        <h1 className="display-title">
          Close cleaner deals with{" "}
          <span className="relative inline-block whitespace-nowrap">
            <SketchHighlight>
              <span className="relative inline-flex">
                {dealFlowText
                  .slice(0, visibleCharacters)
                  .split("")
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
                  isTextComplete ? "is-drawn" : ""
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
                  isTextComplete ? "is-drawn" : ""
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
                  animationDelay: isTextComplete
                    ? "120ms"
                    : "0ms",
                }}
              />
            </svg>
          </span>
        </h1>

        <p className="subheading">
          Built for sales teams that need control, not clutter.
        </p>

        <p className="body-copy landing-copy">
          Registration and access are limited to{" "}
          <SketchHighlight delay={2} speed={1.25}>
            Sales Representatives
          </SketchHighlight>
          . Choose how you want to continue.
        </p>

        <div className="landing-actions">
          <Link
            to="/login"
            className="btn btn-primary btn-xl"
          >
            Login
          </Link>

          <Link
            to="/register"
            className="btn btn-outline btn-xl"
          >
            Register
          </Link>
        </div>
      </section>
    </main>
  );
}