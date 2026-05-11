"use client";

/**
 * CreatorSignature.tsx — Godstime Aburu
 *
 * A subtle, reusable signature component for all projects.
 * Renders a small fixed badge in the bottom-right corner by default,
 * or inline when variant="inline".
 *
 * Usage:
 *   import CreatorSignature from "@/components/CreatorSignature";
 *   <CreatorSignature />                      // fixed bottom-right badge
 *   <CreatorSignature variant="inline" />    // inline footer text
 *   <CreatorSignature variant="console" />   // console.log only, invisible
 */

import { useEffect } from "react";
import { CREATOR } from "@/lib/creator";

interface Props {
  variant?: "badge" | "inline" | "console";
  projectName?: string;
}

export default function CreatorSignature({
  variant = "badge",
  projectName,
}: Props) {
  // Always log to console — visible to anyone who opens DevTools
  useEffect(() => {
    console.log(
      `%c ${CREATOR.name} %c ${CREATOR.alias} %c\n${CREATOR.role} · ${CREATOR.location}\n${CREATOR.github}${projectName ? `\n\nProject: ${projectName}` : ""}`,
      "background:#030b14;color:#7fffd4;font-weight:bold;padding:4px 8px;font-family:monospace;font-size:13px;",
      "background:#0a1628;color:rgba(127,255,212,0.6);padding:4px 8px;font-family:monospace;font-size:12px;",
      "color:rgba(127,255,212,0.4);font-family:monospace;font-size:11px;padding-left:4px;"
    );
  }, [projectName]);

  if (variant === "console") return null;

  if (variant === "inline") {
    return (
      <span className="text-slate-500 text-[10px]">
        {CREATOR.name} · {CREATOR.alias}
      </span>
    );
  }

  // Default: fixed badge — monogram circle only, no text label
  return (
    <a
      href={CREATOR.github}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-opacity duration-300"
      style={{
        background: "rgba(3,11,20,0.75)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(127,255,212,0.12)",
        opacity: 0.55,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.55")}
    >
      {/* Monogram circle only — no text label beside it */}
      <span
        className="flex items-center justify-center rounded-full text-[9px] font-bold leading-none"
        style={{
          width: 18,
          height: 18,
          background: "rgba(127,255,212,0.1)",
          color: "#7fffd4",
          border: "1px solid rgba(127,255,212,0.2)",
          fontFamily: "monospace",
        }}
      >
        {CREATOR.shortSignature}
      </span>
    </a>
  );
}
