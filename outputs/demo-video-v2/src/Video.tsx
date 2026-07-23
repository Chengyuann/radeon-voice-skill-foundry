import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import { Audio, Video } from "@remotion/media";
import type { Scene, Timeline } from "./types";

const palette = {
  bg: "#171A1C",
  surface: "#F5F6F6",
  ink: "#252A2D",
  muted: "#757D81",
  accent: "#C23A35",
  verified: "#2F6A4F",
  compiled: "#345F78",
  line: "#CDD2D4"
};

const assetPath = (path: string): string => path.replace(/^public\//, "");

const stageLabels = [
  "BASELINE",
  "CORRECT",
  "VERIFY",
  "CONTINUE",
  "REOPEN GATE"
];

const stageNumbers = ["01", "02", "03", "04", "05"];

const sceneStatus = ["COMPILED", "CHILD CREATED", "VERIFIED", "REVISION 3", "VERIFY AGAIN"];

const endTagline = "One workspace for the full AMD AI development journey.";

const journeySteps = [
  ["01", "SPEAK", "INTENT"],
  ["02", "COMPILE", "WORKFLOW"],
  ["03", "VERIFY", "PROOF"],
  ["04", "REVISE", "LINEAGE"]
];

const BrandMark: React.FC = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      color: "white",
      fontFamily: "Arial, sans-serif",
      fontSize: 18,
      fontWeight: 800
    }}
  >
    <div
      style={{
        width: 34,
        height: 34,
        display: "grid",
        placeItems: "center",
        background: palette.accent,
        fontFamily: "Menlo, monospace",
        fontSize: 17
      }}
    >
      RV
    </div>
    RADEON VOICE SKILL FOUNDRY
  </div>
);

const TitleScene: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1)
  });
  const exit = interpolate(frame, [duration - 10, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  return (
    <AbsoluteFill style={{ background: palette.bg, overflow: "hidden" }}>
      <Video
        src={staticFile("video/01-baseline.mp4")}
        muted
        objectFit="cover"
        style={{ width: "100%", height: "100%", scale: 1.04 }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(18,20,22,0.97) 0%, rgba(18,20,22,0.91) 47%, rgba(18,20,22,0.52) 100%)"
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "64px 92px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          opacity: Math.min(enter, exit)
        }}
      >
        <BrandMark />
        <div style={{ maxWidth: 1260 }}>
          <div
            style={{
              color: palette.accent,
              fontFamily: "Menlo, monospace",
              fontSize: 23,
              fontWeight: 700,
              marginBottom: 22
            }}
          >
            TRACK 2 · SMOOTH MULTI-TURN INTERACTION
          </div>
          <div
            style={{
              color: "white",
              fontFamily: "Arial, sans-serif",
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: 0,
              translate: `0 ${interpolate(enter, [0, 1], [28, 0])}px`
            }}
          >
            Governed revisions.
            <br />
            Proof on every turn.
          </div>
        </div>
        <div
          style={{
            color: "#C6CCCF",
            fontFamily: "Arial, sans-serif",
            fontSize: 23,
            fontWeight: 700
          }}
        >
          31-second product evidence walkthrough
        </div>
      </div>
    </AbsoluteFill>
  );
};

const EndScene: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1)
  });
  const exit = interpolate(frame, [duration - 12, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  return (
    <AbsoluteFill
      style={{ background: "#111416", overflow: "hidden", opacity: exit }}
    >
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(rgba(255,255,255,0.026) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.026) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          translate: `${interpolate(frame, [0, duration], [0, -18], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp"
          })}px 0`
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, #111416 0%, rgba(17,20,22,0.98) 50%, rgba(17,20,22,0.78) 72%, rgba(194,58,53,0.12) 100%)"
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -160,
          right: -40,
          width: 620,
          height: 1320,
          borderLeft: "1px solid rgba(194,58,53,0.5)",
          borderRight: "1px solid rgba(194,58,53,0.18)",
          background:
            "repeating-linear-gradient(135deg, rgba(194,58,53,0.08) 0 2px, transparent 2px 28px)",
          rotate: "18deg",
          translate: `${interpolate(frame, [0, duration], [52, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp"
          })}px 0`,
          opacity: enter
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: `${interpolate(frame, [0, 26], [0, 100], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1)
          })}%`,
          height: 6,
          background: palette.accent
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "58px 92px 54px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          opacity: enter
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <BrandMark />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              color: "#B8C0C4",
              fontFamily: "Menlo, monospace",
              fontSize: 16,
              fontWeight: 700
            }}
          >
            <span>AMD AI DEVMASTER</span>
            <span style={{ color: palette.accent }}>TRACK 2</span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.35fr) minmax(430px, 0.65fr)",
            gap: 96,
            alignItems: "center"
          }}
        >
          <div
            style={{
              maxWidth: 1040,
              translate: `${interpolate(enter, [0, 1], [-30, 0])}px 0`
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                color: palette.accent,
                fontFamily: "Menlo, monospace",
                fontSize: 21,
                fontWeight: 700,
                marginBottom: 26
              }}
            >
              <span style={{ width: 46, height: 4, background: palette.accent }} />
              ONE WORKSPACE
            </div>
            <div
              style={{
                color: "white",
                fontFamily: "Arial, sans-serif",
                fontSize: 80,
                fontWeight: 800,
                lineHeight: 1.04,
                letterSpacing: 0,
                maxWidth: 1020
              }}
            >
              {endTagline}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                marginTop: 36,
                color: "#C8CED1",
                fontFamily: "Arial, sans-serif",
                fontSize: 23,
                fontWeight: 700
              }}
            >
              <span style={{ color: palette.accent }}>Speak.</span>
              <span>Compile.</span>
              <span>Verify.</span>
              <span>Revise.</span>
            </div>
          </div>

          <div
            style={{
              position: "relative",
              minHeight: 500,
              paddingLeft: 58,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between"
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 13,
                top: 32,
                bottom: 32,
                width: 3,
                background: "rgba(255,255,255,0.14)"
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: `${interpolate(frame, [10, 52], [0, 100], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1, 0.3, 1)
                  })}%`,
                  background: palette.accent
                }}
              />
            </div>

            {journeySteps.map(([number, label, detail], index) => (
              <div
                key={number}
                style={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "92px 1fr",
                  alignItems: "center",
                  minHeight: 92,
                  opacity: interpolate(
                    frame,
                    [12 + index * 7, 24 + index * 7],
                    [0, 1],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: Easing.bezier(0.16, 1, 0.3, 1)
                    }
                  ),
                  translate: `${interpolate(
                    frame,
                    [12 + index * 7, 24 + index * 7],
                    [24, 0],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: Easing.bezier(0.16, 1, 0.3, 1)
                    }
                  )}px 0`
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: -58,
                    width: 30,
                    height: 30,
                    border: `3px solid ${
                      index === journeySteps.length - 1
                        ? palette.accent
                        : "#7F898E"
                    }`,
                    background: "#111416",
                    rotate: "45deg"
                  }}
                />
                <div
                  style={{
                    color:
                      index === journeySteps.length - 1
                        ? palette.accent
                        : "#8E979C",
                    fontFamily: "Menlo, monospace",
                    fontSize: 18,
                    fontWeight: 700
                  }}
                >
                  {number}
                </div>
                <div
                  style={{
                    padding: "15px 0 14px",
                    borderBottom: "1px solid rgba(255,255,255,0.15)"
                  }}
                >
                  <div
                    style={{
                      color: "white",
                      fontFamily: "Arial, sans-serif",
                      fontSize: 30,
                      fontWeight: 800
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      marginTop: 5,
                      color: "#8E979C",
                      fontFamily: "Menlo, monospace",
                      fontSize: 14,
                      fontWeight: 700
                    }}
                  >
                    {detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.17)",
            paddingTop: 22,
            opacity: interpolate(frame, [24, 38], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp"
            })
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              color: "white",
              fontFamily: "Arial, sans-serif",
              fontSize: 21,
              fontWeight: 800
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                display: "grid",
                placeItems: "center",
                background: palette.accent,
                fontSize: 24
              }}
            >
              →
            </span>
            GET STARTED TODAY
          </div>
          <div
            style={{
              color: "#AAB2B6",
              fontFamily: "Menlo, monospace",
              fontSize: 16,
              fontWeight: 700
            }}
          >
            RADEON-VOICE-SKILL-FOUNDRY.PAGES.DEV
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CaptionLayer: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1)
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 118,
        right: 118,
        bottom: 48,
        display: "flex",
        justifyContent: "center",
        opacity: enter,
        translate: `0 ${interpolate(enter, [0, 1], [18, 0])}px`
      }}
    >
      <div
        style={{
          maxWidth: 1450,
          padding: "18px 28px",
          color: "white",
          borderLeft: `5px solid ${palette.accent}`,
          background: "rgba(23,26,28,0.92)",
          boxShadow: "0 18px 52px rgba(0,0,0,0.34)",
          fontFamily: "Arial, sans-serif",
          fontSize: 35,
          fontWeight: 700,
          lineHeight: 1.18,
          letterSpacing: 0,
          textAlign: "center"
        }}
      >
        {scene.voiceover}
      </div>
    </div>
  );
};

const EvidenceScene: React.FC<{ scene: Scene; index: number }> = ({
  scene,
  index
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = scene.duration_frames;
  const enter = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1)
  });
  const exit = interpolate(frame, [duration - 12, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const zoom = interpolate(frame, [0, duration], [1.015, 1.065], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const source = scene.visual?.asset_refs?.[0] || "";
  const localSeconds = frame / fps;
  const accentPulse = interpolate(
    localSeconds,
    [0, 0.2, 0.65],
    [0.2, 1, 0.2],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp"
    }
  );

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background: palette.bg,
        opacity: Math.min(enter, exit)
      }}
    >
      <Video
        src={staticFile(assetPath(source))}
        muted
        objectFit="cover"
        style={{
          width: "100%",
          height: "100%",
          scale: zoom
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(15,17,18,0.62) 0%, rgba(15,17,18,0.05) 26%, rgba(15,17,18,0.02) 68%, rgba(15,17,18,0.55) 100%)"
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 54,
          top: 44,
          display: "flex",
          alignItems: "stretch",
          opacity: enter
        }}
      >
        <div
          style={{
            width: 76,
            display: "grid",
            placeItems: "center",
            color: "white",
            background: palette.accent,
            fontFamily: "Menlo, monospace",
            fontSize: 23,
            fontWeight: 700
          }}
        >
          {stageNumbers[index]}
        </div>
        <div
          style={{
            minWidth: 390,
            padding: "13px 18px 12px",
            color: "white",
            background: "rgba(23,26,28,0.94)",
            borderRight: `1px solid rgba(255,255,255,0.16)`,
            fontFamily: "Arial, sans-serif"
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: "#AEB5B8" }}>
            SMOOTH MULTI-TURN INTERACTION · 20 POINTS
          </div>
          <div style={{ marginTop: 4, fontSize: 27, fontWeight: 800 }}>
            {stageLabels[index]}
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 56,
          top: 49,
          minWidth: 176,
          padding: "12px 16px",
          color: "white",
          border: "1px solid rgba(255,255,255,0.22)",
          background:
            index === 2
              ? `rgba(47,106,79,${0.78 + accentPulse * 0.12})`
              : index === 4
                ? `rgba(194,58,53,${0.76 + accentPulse * 0.14})`
                : `rgba(52,95,120,${0.76 + accentPulse * 0.14})`,
          fontFamily: "Menlo, monospace",
          fontSize: 17,
          fontWeight: 700,
          textAlign: "center"
        }}
      >
        {sceneStatus[index]}
      </div>

      <div
        style={{
          position: "absolute",
          left: 54,
          right: 54,
          bottom: 0,
          height: 4,
          background: "rgba(255,255,255,0.16)"
        }}
      >
        <div
          style={{
            width: `${interpolate(frame, [0, duration], [0, 100], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp"
            })}%`,
            height: "100%",
            background: palette.accent
          }}
        />
      </div>

      <CaptionLayer scene={scene} />
    </AbsoluteFill>
  );
};

export const DemoVideo: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const introFrames = timeline.intro_frames ?? 0;
  const outroFrames = timeline.outro_frames ?? 0;
  const bodyFrames = timeline.scenes.reduce(
    (maximum, scene) =>
      Math.max(maximum, scene.start_frame + scene.duration_frames),
    0
  );
  const outroStart = introFrames + bodyFrames;

  return (
    <AbsoluteFill style={{ background: palette.bg }}>
      {timeline.background_music ? (
        <Audio
          src={staticFile(assetPath(timeline.background_music.path))}
          volume={(frame) =>
            interpolate(
              frame,
              [
                0,
                timeline.background_music?.fade_in_frames ?? 24,
                timeline.duration_frames -
                  (timeline.background_music?.fade_out_frames ?? 30),
                timeline.duration_frames
              ],
              [0, timeline.background_music?.volume ?? 0.34, timeline.background_music?.volume ?? 0.34, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp"
              }
            )
          }
        />
      ) : null}
      {timeline.audio_mix ? (
        <Sequence from={introFrames} durationInFrames={bodyFrames}>
          <Audio src={staticFile(assetPath(timeline.audio_mix))} />
        </Sequence>
      ) : null}
      {introFrames > 0 ? (
        <Sequence from={0} durationInFrames={introFrames} name="Title">
          <TitleScene duration={introFrames} />
        </Sequence>
      ) : null}
      {timeline.scenes.map((scene, index) => (
        <Sequence
          key={scene.id}
          from={introFrames + scene.start_frame}
          durationInFrames={scene.duration_frames}
          name={`${stageNumbers[index]} ${stageLabels[index]}`}
        >
          <EvidenceScene scene={scene} index={index} />
        </Sequence>
      ))}
      {outroFrames > 0 ? (
        <Sequence
          from={outroStart}
          durationInFrames={outroFrames}
          name="End card"
        >
          <EndScene duration={outroFrames} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
