"use client";

import React from "react";
import {
  WhatsAppTemplateButton,
  WhatsAppTemplateHeaderType,
} from "@/types/crm";
import {
  Image as ImageIcon,
  Video,
  FileText,
  ExternalLink,
  Phone,
  Reply,
  Copy,
  CheckCheck,
} from "lucide-react";

interface WhatsAppTemplateBubblePreviewProps {
  headerType?: WhatsAppTemplateHeaderType | string | null;
  headerContent?: string | null;
  bodyText: string;
  footerText?: string | null;
  buttons?: WhatsAppTemplateButton[];
  variableValues?: Record<string, string>;
  templateName?: string;
  category?: string;
  language?: string;
}

export function WhatsAppTemplateBubblePreview({
  headerType = "NONE",
  headerContent,
  bodyText,
  footerText,
  buttons = [],
  variableValues = {},
  templateName,
  category,
  language,
}: WhatsAppTemplateBubblePreviewProps) {
  const normalizedHeaderType = String(headerType || "NONE").toUpperCase();

  const renderFormattedText = (text: string) => {
    const parts = String(text || "").split(/(\{\{[a-zA-Z0-9_]+\}\})/g);
    return parts.map((part, idx) => {
      const match = part.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/);
      if (!match) {
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      }
      const key = match[1];
      const filled = variableValues[key]?.trim();
      if (filled) {
        return (
          <span
            key={idx}
            className="font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-500/15 px-1 rounded"
          >
            {filled}
          </span>
        );
      }
      return (
        <span
          key={idx}
          className="font-mono text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1 rounded"
        >
          [{key}]
        </span>
      );
    });
  };

  const renderButtonIcon = (type: string) => {
    switch (type) {
      case "URL":
        return <ExternalLink className="w-3.5 h-3.5 shrink-0" />;
      case "PHONE_NUMBER":
        return <Phone className="w-3.5 h-3.5 shrink-0" />;
      case "COPY_CODE":
        return <Copy className="w-3.5 h-3.5 shrink-0" />;
      default:
        return <Reply className="w-3.5 h-3.5 shrink-0" />;
    }
  };

  const isUrlLike = (val?: string | null) =>
    Boolean(val && /^https?:\/\//i.test(val.trim()));

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-[#efeae2]/80 dark:bg-zinc-900/90 p-2.5 space-y-1.5">
      {(templateName || category || language) && (
        <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-600 dark:text-zinc-400 px-0.5">
          <span className="font-mono font-semibold truncate">
            {templateName || "Template Preview"}
          </span>
          {(category || language) && (
            <span className="px-1.5 py-0.5 rounded bg-white/80 dark:bg-zinc-800 border border-black/5 dark:border-white/10 font-medium shrink-0">
              {[category, language].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      )}

      {/* Compact Full-Width WhatsApp Bubble */}
      <div className="w-full rounded-xl bg-[#d9fdd3] dark:bg-emerald-950/90 border border-emerald-600/15 shadow-xs overflow-hidden">
        {/* Header */}
        {normalizedHeaderType === "TEXT" && headerContent && (
          <div className="px-3 pt-2.5 pb-1 text-[13px] font-bold text-zinc-900 dark:text-zinc-50 leading-snug">
            {renderFormattedText(headerContent)}
          </div>
        )}

        {normalizedHeaderType === "IMAGE" && (
          <div className="m-1.5 rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-800 border border-black/5">
            {isUrlLike(headerContent) ? (
              <img
                src={headerContent!}
                alt="Template header"
                className="w-full h-32 object-cover"
              />
            ) : (
              <div className="h-24 flex flex-col items-center justify-center gap-1 text-zinc-500 dark:text-zinc-400 text-[11px]">
                <ImageIcon className="w-5 h-5" />
                <span>Image Header {headerContent ? `(${headerContent.slice(0, 18)}…)` : ""}</span>
              </div>
            )}
          </div>
        )}

        {normalizedHeaderType === "VIDEO" && (
          <div className="m-1.5 h-24 rounded-lg bg-zinc-900/85 flex flex-col items-center justify-center gap-1 text-white text-[11px]">
            <Video className="w-5 h-5 text-emerald-400" />
            <span>Video Header {isUrlLike(headerContent) ? "Attached" : "(Media)"}</span>
          </div>
        )}

        {normalizedHeaderType === "DOCUMENT" && (
          <div className="m-1.5 px-3 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200">
            <FileText className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span className="truncate font-medium">
              {isUrlLike(headerContent) ? headerContent!.split("/").pop() || "Document.pdf" : "Document Attachment"}
            </span>
          </div>
        )}

        {/* Body */}
        <div className="px-3 py-2 text-[12.5px] leading-relaxed text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
          {bodyText ? renderFormattedText(bodyText) : <span className="italic opacity-60">Template body preview...</span>}
        </div>

        {/* Footer & Timestamp */}
        <div className="px-3 pb-2 flex items-end justify-between gap-2">
          <span className="text-[10.5px] text-zinc-500 dark:text-zinc-400 truncate">
            {footerText || ""}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0 ml-auto">
            <span>Now</span>
            <CheckCheck className="w-3 h-3 text-sky-600 dark:text-sky-400" />
          </span>
        </div>

        {/* Interactive Meta Buttons */}
        {Array.isArray(buttons) && buttons.length > 0 && (
          <div className="border-t border-emerald-700/15 divide-y divide-emerald-700/15 bg-white/45 dark:bg-black/20">
            {buttons.map((btn, i) => (
              <div
                key={i}
                className="px-3 py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-400"
              >
                {renderButtonIcon(btn.type)}
                <span className="truncate">{btn.text || btn.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
