"use client";

import { FRAME_PRESETS } from "@/lib/presets/frames";
import { STAMP_PRESETS } from "@/lib/presets/stamps";
import type { FrameStyle, StampPosition, StampStyle } from "@/types";

interface ControlPanelProps {
  frame: FrameStyle;
  onFrameChange: (frame: FrameStyle) => void;
  stamp: StampStyle;
  onStampChange: (stamp: StampStyle) => void;
  stampPosition: StampPosition;
  onStampPositionChange: (position: StampPosition) => void;
  showStamp: boolean;
  onShowStampChange: (show: boolean) => void;
  date: string;
  onDateChange: (date: string) => void;
  locationText: string;
  onLocationChange: (text: string) => void;
}

const POSITIONS: { id: StampPosition; label: string }[] = [
  { id: "bottom-right", label: "우하단" },
  { id: "bottom-left", label: "좌하단" },
  { id: "top-right", label: "우상단" },
  { id: "top-left", label: "좌상단" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/50">
      {children}
    </h3>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-ink text-cream"
          : "bg-white/60 text-ink/70 hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

export default function ControlPanel(props: ControlPanelProps) {
  const {
    frame,
    onFrameChange,
    stamp,
    onStampChange,
    stampPosition,
    onStampPositionChange,
    showStamp,
    onShowStampChange,
    date,
    onDateChange,
    locationText,
    onLocationChange,
  } = props;

  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-white/40 p-6">
      <div>
        <SectionLabel>프레임</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {FRAME_PRESETS.map((preset) => (
            <ChoiceButton
              key={preset.id}
              active={frame === preset.id}
              onClick={() => onFrameChange(preset.id)}
            >
              {preset.label}
            </ChoiceButton>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>타임스탬프</SectionLabel>
          <label className="flex items-center gap-2 text-xs text-ink/60">
            <input
              type="checkbox"
              checked={showStamp}
              onChange={(e) => onShowStampChange(e.target.checked)}
            />
            표시
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {STAMP_PRESETS.map((preset) => (
            <ChoiceButton
              key={preset.id}
              active={stamp === preset.id}
              onClick={() => onStampChange(preset.id)}
            >
              {preset.label}
            </ChoiceButton>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>스탬프 위치</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map((pos) => (
            <ChoiceButton
              key={pos.id}
              active={stampPosition === pos.id}
              onClick={() => onStampPositionChange(pos.id)}
            >
              {pos.label}
            </ChoiceButton>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <SectionLabel>날짜</SectionLabel>
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full rounded-lg bg-white/70 px-3 py-2 text-sm"
          />
        </div>
        {stamp === "location-date" && (
          <div>
            <SectionLabel>장소</SectionLabel>
            <input
              type="text"
              value={locationText}
              onChange={(e) => onLocationChange(e.target.value)}
              placeholder="SEOUL, KOREA"
              className="w-full rounded-lg bg-white/70 px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
