"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Check,
  CheckCircle2,
  Clipboard,
  Cloud,
  Code2,
  Cpu,
  Download,
  Eraser,
  FileJson,
  Flame,
  Loader2,
  LockKeyhole,
  Play,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Timer,
  XCircle,
  type LucideIcon,
} from "lucide-react";

const ReactDiffViewer = dynamic(() => import("react-diff-viewer-continued"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center gap-2 px-4 py-6 font-mono text-xs text-[#8B8B8B]">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Preparing patch diff...
    </div>
  ),
});

interface Finding {
  cwe: string;
  message: string;
  line: number;
  original_code: string;
  patched_code: string;
  explanation: string;
  verified: boolean;
  provider: string;
}

interface ScanResponse {
  findings: Finding[];
  ollama_connected: boolean;
  model_pulled: boolean;
  model: string;
  total_vulnerabilities: number;
  verified_fixes: number;
}

type EngineState = "checking" | "gemma" | "fallback" | "offline";

const INITIAL_VULNERABLE_CODE = `import subprocess
import pickle

def run_cmd(user_input):
    # CWE-78: Command Injection
    subprocess.run(f"echo {user_input}", shell=True)

def load_data(data):
    # CWE-502: Unsafe Deserialization
    return pickle.loads(data)

# CWE-798: Hardcoded Secret
AWS_SECRET = "AKIAIOSFODNN7EXAMPLE"`;

const SAMPLE_NAME = "ast-target.py";
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(
  /\/$/,
  "",
);

const IS_LOCAL_API = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(API_BASE_URL);

const ENGINE_META: Record<
  EngineState,
  { label: string; color: string; border: string; background: string; icon: LucideIcon }
> = {
  checking: {
    label: "Checking engine",
    color: "#8B8B8B",
    border: "#262626",
    background: "#171717",
    icon: Loader2,
  },
  gemma: {
    label: "Gemma 2 ready",
    color: "#00C48C",
    border: "rgba(0, 196, 140, 0.45)",
    background: "rgba(0, 196, 140, 0.08)",
    icon: Cpu,
  },
  fallback: {
    label: "Deterministic fallback",
    color: "#FF6B35",
    border: "rgba(255, 107, 53, 0.45)",
    background: "rgba(255, 107, 53, 0.08)",
    icon: ShieldCheck,
  },
  offline: {
    label: "Backend offline",
    color: "#FF3B3B",
    border: "rgba(255, 59, 59, 0.45)",
    background: "rgba(255, 59, 59, 0.08)",
    icon: XCircle,
  },
};

const diffStyles = {
  variables: {
    dark: {
      diffViewerBackground: "#111111",
      diffViewerColor: "#EDEDED",
      addedBackground: "rgba(0, 196, 140, 0.14)",
      addedColor: "#00C48C",
      removedBackground: "rgba(255, 59, 59, 0.14)",
      removedColor: "#FF3B3B",
      wordAddedBackground: "rgba(0, 196, 140, 0.3)",
      wordRemovedBackground: "rgba(255, 59, 59, 0.3)",
      addedGutterBackground: "rgba(0, 196, 140, 0.2)",
      removedGutterBackground: "rgba(255, 59, 59, 0.2)",
      gutterBackground: "#0A0A0A",
      gutterBackgroundDark: "#0A0A0A",
      highlightBackground: "#171717",
      highlightGutterBackground: "#171717",
      codeFoldGutterBackground: "#111111",
      codeFoldBackground: "#111111",
      emptyLineBackground: "#111111",
      gutterColor: "#8B8B8B",
      addedGutterColor: "#00C48C",
      removedGutterColor: "#FF3B3B",
      codeFoldContentColor: "#8B8B8B",
      diffViewerTitleBackground: "#171111",
      diffViewerTitleColor: "#EDEDED",
      diffViewerTitleBorderColor: "#262626",
    },
  },
  line: {
    padding: "6px 10px",
    fontSize: "13px",
    fontFamily: "var(--font-geist-mono), monospace",
  },
  contentText: {
    fontFamily: "var(--font-geist-mono), monospace",
    fontSize: "13px",
    lineHeight: "1.5",
  },
  gutter: {
    padding: "6px 10px",
    minWidth: "36px",
    fontFamily: "var(--font-geist-mono), monospace",
    fontSize: "12px",
  },
};

const PIPELINE_STEPS = [
  {
    title: "Deterministic AST discovery",
    detail: "Python walks nodes for CWE-78, CWE-502, CWE-798",
  },
  {
    title: IS_LOCAL_API ? "Local Gemma 2 synthesis" : "Verified fallback synthesis",
    detail: IS_LOCAL_API
      ? "Ollama proposes a drop-in patch. No cloud egress."
      : "Deterministic patches when Ollama is unavailable.",
  },
  {
    title: "Kill-switch verification",
    detail: "ast.parse + full re-scan must prove the CWE is gone",
  },
];

function StatCard({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  accent: string;
  icon: LucideIcon;
}) {
  return (
    <div className="panel flex items-center gap-3 rounded-md px-4 py-3">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-md border"
        style={{
          color: accent,
          background: `${accent}12`,
          borderColor: `${accent}45`,
        }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8B8B8B]">{label}</p>
        <p className="font-mono text-lg font-semibold" style={{ color: accent }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function PipelineLoader({ elapsed }: { elapsed: number }) {
  return (
    <div className="flex min-h-[480px] flex-col items-center justify-center px-4 py-10 text-center">
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full border border-[#FF6B35]/30" />
        <div className="absolute inset-2 rounded-full border border-[#FF6B35]/40" />
        <ScanSearch className="relative h-8 w-8 text-[#FF6B35]" />
      </div>
      <p className="font-mono text-sm font-semibold tracking-[0.18em] text-[#EDEDED]">
        RUNNING GUARDED AUDIT
      </p>
      <p className="mt-2 max-w-sm font-mono text-xs leading-relaxed text-[#8B8B8B]">
        {IS_LOCAL_API
          ? "AST discovery, local patch synthesis, and mathematical verification are executing in sequence."
          : "AST discovery, fallback patch synthesis, and mathematical verification are executing in sequence."}
      </p>

      <div className="mt-7 w-full max-w-md space-y-2">
        {PIPELINE_STEPS.map((step, index) => (
          <div
            key={step.title}
            className="flex items-start gap-3 rounded-md border border-[#262626] bg-[#0A0A0A] px-3 py-2.5 text-left"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#FF6B35]/40 bg-[#FF6B35]/10 font-mono text-[10px] text-[#FF6B35]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="font-mono text-xs text-[#EDEDED]">{step.title}</p>
              <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-[#8B8B8B]">
                {step.detail}
              </p>
            </div>
            <Loader2
              className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 animate-spin text-[#FF6B35]"
              style={{ animationDelay: `${index * 160}ms` }}
            />
          </div>
        ))}
      </div>

      <div className="mt-6 w-full max-w-md">
        <div className="scan-bar h-1 rounded-full bg-[#262626]" />
        <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-[#8B8B8B]">
          <span className="flex items-center gap-1.5">
            <Timer className="h-3 w-3" />
            {elapsed}s elapsed
          </span>
          <span>
            {IS_LOCAL_API
              ? "Local inference may take 20–90s on first load"
              : "Fallback synthesis resolves in under a second"}
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ hasScanned }: { hasScanned: boolean }) {
  if (hasScanned) {
    return (
      <div className="flex min-h-[480px] flex-col items-center justify-center rounded-md border border-[#00C48C]/30 bg-[#00C48C]/[0.04] px-6 py-10 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#00C48C]/40 bg-[#00C48C]/10">
          <ShieldCheck className="h-8 w-8 text-[#00C48C]" />
        </div>
        <p className="font-mono text-sm font-semibold tracking-[0.16em] text-[#00C48C]">
          CLEAN AST
        </p>
        <p className="mt-2 max-w-md font-mono text-xs leading-relaxed text-[#8B8B8B]">
          Python parsed the Abstract Syntax Tree and found zero instances of CWE-78, CWE-502, or
          CWE-798 in this submission.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2 font-mono text-[10px]">
          <span className="rounded border border-[#262626] bg-[#111111] px-2 py-1 text-[#8B8B8B]">
            ast.parse: OK
          </span>
          <span className="rounded border border-[#262626] bg-[#111111] px-2 py-1 text-[#8B8B8B]">
            deterministic scan: 0 findings
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[480px] flex-col items-center justify-center rounded-md border border-[#262626] bg-[#0A0A0A] px-6 py-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#262626] bg-[#171717]">
        <ShieldAlert className="h-8 w-8 text-[#8B8B8B]" />
      </div>
      <p className="font-mono text-sm font-semibold tracking-[0.16em] text-[#EDEDED]">
        AWAITING AUDIT
      </p>
      <p className="mt-2 max-w-md font-mono text-xs leading-relaxed text-[#8B8B8B]">
        {IS_LOCAL_API
          ? "Paste untrusted Python, select RUN AUDIT, and CodeAsh will scan the AST locally. No patch receives a green badge until Python proves it."
          : "Paste Python, select RUN AUDIT, and the Render backend will scan its AST. No patch receives a green badge until Python proves it."}
      </p>
      <div className="mt-6 grid w-full max-w-md grid-cols-1 gap-2 text-left sm:grid-cols-3">
        {[
          ["CWE-78", "Shell injection"],
          ["CWE-502", "Unsafe pickle"],
          ["CWE-798", "Hardcoded secrets"],
        ].map(([cwe, label]) => (
          <div key={cwe} className="rounded border border-[#262626] bg-[#111111] px-3 py-2">
            <p className="font-mono text-[10px] text-[#FF6B35]">{cwe}</p>
            <p className="mt-0.5 font-mono text-[10px] text-[#8B8B8B]">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CodeAshDashboard() {
  const [code, setCode] = useState<string>(INITIAL_VULNERABLE_CODE);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasScanned, setHasScanned] = useState<boolean>(false);
  const [engine, setEngine] = useState<EngineState>("checking");
  const [model, setModel] = useState<string>("gemma2:9b");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const [copiedPatch, setCopiedPatch] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lineCount = useMemo(() => (code ? code.split("\n").length : 0), [code]);
  const verifiedCount = useMemo(() => findings.filter((f) => f.verified).length, [findings]);
  const rejectedCount = findings.length - verifiedCount;
  const cweCount = useMemo(() => new Set(findings.map((f) => f.cwe)).size, [findings]);

  useEffect(() => {
    const controller = new AbortController();

    async function checkBackendHealth() {
      try {
        const res = await fetch(`${API_BASE_URL}/health`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Health check failed with HTTP ${res.status}`);
        }
        const data = await res.json();
        setModel(String(data.model || "gemma2:9b"));
        if (data.ollama_connected && data.model_pulled) {
          setEngine("gemma");
        } else {
          setEngine("fallback");
        }
      } catch {
        if (!controller.signal.aborted) {
          setEngine("offline");
        }
      }
    }

    checkBackendHealth();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      return;
    }
    const startedAt = Date.now();
    setElapsed(0);
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
    };
  }, []);

  const buildReport = useCallback(() => {
    return {
      project: "CodeAsh",
      tagline: IS_LOCAL_API
        ? "Private, local security audit before you launch."
        : "Cloud preview of the local-first security auditor.",
      generated_at: new Date().toISOString(),
      engine: model,
      source_file: SAMPLE_NAME,
      summary: {
        total_vulnerabilities: findings.length,
        verified_fixes: verifiedCount,
        rejected_fixes: rejectedCount,
        cwe_classes: cweCount,
      },
      findings,
      source_code: code,
    };
  }, [code, cweCount, findings, model, rejectedCount, verifiedCount]);

  const handleCopyReport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildReport(), null, 2));
      setCopiedReport(true);
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
      copyTimer.current = setTimeout(() => setCopiedReport(false), 2000);
    } catch {
      setErrorMsg("Clipboard access was blocked by the browser. Use Download instead.");
    }
  }, [buildReport]);

  const handleDownloadReport = useCallback(() => {
    const blob = new Blob([JSON.stringify(buildReport(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `codeash-audit-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [buildReport]);

  const handleCopyPatch = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPatch(key);
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
      copyTimer.current = setTimeout(() => setCopiedPatch(null), 2000);
    } catch {
      setErrorMsg("Clipboard access was blocked by the browser.");
    }
  }, []);

  const handleRunAudit = useCallback(async () => {
    if (isLoading) {
      return;
    }

    if (!code.trim()) {
      setErrorMsg("Paste Python source code before running the audit.");
      setFindings([]);
      setHasScanned(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setFindings([]);
    setHasScanned(false);

    let reachedBackend = false;
    try {
      const response = await fetch(`${API_BASE_URL}/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });
      reachedBackend = true;

      if (!response.ok) {
        let detail = `Audit engine returned HTTP ${response.status}`;
        try {
          const payload = await response.json();
          if (typeof payload.detail === "string") {
            detail = payload.detail;
          } else if (Array.isArray(payload.detail) && payload.detail[0]?.msg) {
            detail = payload.detail[0].msg;
          }
        } catch {
          // Keep the status-based message.
        }
        throw new Error(detail);
      }

      const data: ScanResponse = await response.json();
      setFindings(data.findings || []);
      setHasScanned(true);
      setModel(data.model || "mock-fallback");

      if (data.ollama_connected && data.model_pulled) {
        setEngine("gemma");
      } else {
        setEngine("fallback");
      }
    } catch (err: unknown) {
      if (!reachedBackend) {
        setEngine("offline");
      }
      const message =
        err instanceof Error
          ? err.message
          : `Unable to reach the audit backend at ${API_BASE_URL}.`;
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  }, [code, isLoading]);

  const handleReset = useCallback(() => {
    setCode(INITIAL_VULNERABLE_CODE);
    setFindings([]);
    setHasScanned(false);
    setErrorMsg(null);
    setElapsed(0);
  }, []);

  const handleClear = useCallback(() => {
    setCode("");
    setFindings([]);
    setHasScanned(false);
    setErrorMsg(null);
    setElapsed(0);
  }, []);

  const engineMeta = ENGINE_META[engine];
  const EngineIcon = engineMeta.icon;
  const isBusy = isLoading || engine === "checking";

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0A0A0A] text-[#EDEDED]">
      <div className="cyber-grid" aria-hidden="true" />

      <header className="sticky top-0 z-20 border-b border-[#262626] bg-[#111111]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#FF6B35]/40 bg-[#FF6B35]/10">
              <Flame className="h-5 w-5 text-[#FF6B35]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-mono text-lg font-bold tracking-[0.22em] text-[#EDEDED]">
                  CODEASH
                </h1>
                <span className="rounded border border-[#262626] bg-[#171717] px-2 py-0.5 font-mono text-[10px] tracking-wider text-[#8B8B8B]">
                  {IS_LOCAL_API ? "AST + GEMMA-2:9B" : "AST + FALLBACK"}
                </span>
                <span
                  className={`hidden items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] tracking-wider sm:flex ${
                    IS_LOCAL_API
                      ? "border-[#00C48C]/30 bg-[#00C48C]/[0.06] text-[#00C48C]"
                      : "border-[#FF6B35]/30 bg-[#FF6B35]/[0.06] text-[#FF6B35]"
                  }`}
                >
                  {IS_LOCAL_API ? (
                    <LockKeyhole className="h-3 w-3" />
                  ) : (
                    <Cloud className="h-3 w-3" />
                  )}
                  {IS_LOCAL_API ? "LOCAL-FIRST" : "CLOUD PREVIEW"}
                </span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-[#8B8B8B]">
                {IS_LOCAL_API
                  ? "Private, local security audit before you launch."
                  : "Cloud preview of the local-first security auditor."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-2 rounded-md border px-3 py-1.5"
              style={{
                borderColor: engineMeta.border,
                background: engineMeta.background,
              }}
              title={
                engine === "gemma"
                  ? `Local Ollama model: ${model}`
                  : engine === "fallback"
                    ? "Ollama or Gemma 2 is unavailable. Verified deterministic fallback patches will be used."
                    : engine === "offline"
                      ? `Backend not reachable at ${API_BASE_URL}`
                      : "Checking the local audit engine"
              }
            >
              <span
                className="status-dot h-2 w-2 rounded-full"
                style={{ backgroundColor: engineMeta.color }}
              />
              <EngineIcon
                className={`h-3.5 w-3.5 ${engine === "checking" ? "animate-spin" : ""}`}
                style={{ color: engineMeta.color }}
              />
              <span
                className="font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{ color: engineMeta.color }}
              >
                {engineMeta.label}
              </span>
            </div>

            <a
              href="https://github.com/cyber-suraj/codeash"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-md border border-[#262626] bg-[#171717] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#8B8B8B] transition-colors hover:border-[#FF6B35]/50 hover:text-[#EDEDED]"
            >
              <Code2 className="h-3.5 w-3.5" />
              Source
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="panel flex flex-wrap items-center justify-between gap-3 rounded-md px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-[#FF6B35]" />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#EDEDED]">
              LLM proposes. Python disposes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-[#8B8B8B]">
            <span className="flex items-center gap-1.5 rounded border border-[#262626] bg-[#0A0A0A] px-2 py-1">
              <Terminal className="h-3 w-3 text-[#FF6B35]" />
              AST
            </span>
            <span className="flex items-center gap-1.5 rounded border border-[#262626] bg-[#0A0A0A] px-2 py-1">
              <Cpu className="h-3 w-3 text-[#FF6B35]" />
              {IS_LOCAL_API ? "GEMMA 2" : "FALLBACK"}
            </span>
            <span className="flex items-center gap-1.5 rounded border border-[#262626] bg-[#0A0A0A] px-2 py-1">
              <ShieldCheck className="h-3 w-3 text-[#00C48C]" />
              PROOF
            </span>
            <span className="hidden items-center gap-1.5 rounded border border-[#262626] bg-[#0A0A0A] px-2 py-1 sm:flex">
              {IS_LOCAL_API ? (
                <LockKeyhole className="h-3 w-3 text-[#00C48C]" />
              ) : (
                <Cloud className="h-3 w-3 text-[#FF6B35]" />
              )}
              {IS_LOCAL_API ? "NO CLOUD EGRESS" : "RENDER PREVIEW"}
            </span>
          </div>
        </section>

        {!IS_LOCAL_API && (
          <section className="flex items-start gap-2.5 rounded-md border border-[#FF6B35]/30 bg-[#FF6B35]/[0.06] px-4 py-3 font-mono text-[10px] leading-relaxed text-[#FF6B35]">
            <Cloud className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-semibold">CLOUD PREVIEW</span> — this deployment sends the
              submitted snippet to the Render API and uses verifier-approved deterministic fallback
              patches. Run CodeAsh locally with Ollama for zero-egress Gemma 2 synthesis.
            </p>
          </section>
        )}

        {hasScanned && (
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Findings" value={findings.length} accent="#FF6B35" icon={ShieldAlert} />
            <StatCard
              label="Verified"
              value={verifiedCount}
              accent="#00C48C"
              icon={CheckCircle2}
            />
            <StatCard label="Rejected" value={rejectedCount} accent="#FF3B3B" icon={XCircle} />
            <StatCard label="CWE classes" value={cweCount} accent="#EDEDED" icon={FileJson} />
          </section>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="panel flex min-h-[640px] flex-col overflow-hidden rounded-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262626] bg-[#171717] px-4 py-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[#FF6B35]" />
                <span className="font-mono text-xs font-semibold tracking-[0.16em] text-[#EDEDED]">
                  1 / INPUT CODE
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden font-mono text-[10px] text-[#8B8B8B] sm:inline">
                  {lineCount} lines · {code.length} chars
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1.5 rounded border border-[#262626] bg-[#111111] px-2 py-1 font-mono text-[10px] text-[#8B8B8B] transition-colors hover:border-[#FF6B35]/40 hover:text-[#EDEDED]"
                >
                  <Sparkles className="h-3 w-3" />
                  Sample
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1.5 rounded border border-[#262626] bg-[#111111] px-2 py-1 font-mono text-[10px] text-[#8B8B8B] transition-colors hover:border-[#FF3B3B]/40 hover:text-[#FF3B3B]"
                >
                  <Eraser className="h-3 w-3" />
                  Clear
                </button>
              </div>
            </div>

            <div className="flex flex-1 flex-col p-4">
              <div className="mb-2 flex items-center justify-between font-mono text-[10px] text-[#8B8B8B]">
                <span>python • {SAMPLE_NAME}</span>
                <span className="flex items-center gap-1">
                  {IS_LOCAL_API ? (
                    <LockKeyhole className="h-3 w-3 text-[#00C48C]" />
                  ) : (
                    <Cloud className="h-3 w-3 text-[#FF6B35]" />
                  )}
                  {IS_LOCAL_API ? "untrusted input, local only" : "untrusted input · sent to Render"}
                </span>
              </div>

              <textarea
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    handleRunAudit();
                  }
                }}
                spellCheck={false}
                aria-label="Vulnerable Python source code"
                className="h-[min(48vh,520px)] min-h-[360px] w-full resize-none rounded-md border border-[#262626] bg-[#0A0A0A] p-4 font-mono text-[13px] leading-relaxed text-[#EDEDED] outline-none transition-colors placeholder:text-[#555555] focus:border-[#FF6B35] xl:h-auto xl:flex-1"
                placeholder="Paste Python source code for deterministic AST vulnerability scanning..."
              />

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  ["CWE-78", "shell=True / os.system"],
                  ["CWE-502", "pickle.load(s)"],
                  ["CWE-798", "hardcoded secrets"],
                ].map(([cwe, label]) => (
                  <div
                    key={cwe}
                    className="flex items-center justify-between gap-2 rounded border border-[#262626] bg-[#111111] px-2.5 py-1.5"
                  >
                    <span className="font-mono text-[10px] text-[#FF6B35]">{cwe}</span>
                    <span className="truncate font-mono text-[9px] text-[#8B8B8B]">{label}</span>
                  </div>
                ))}
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-md border border-[#FF3B3B] bg-[#FF3B3B]/10 px-3 py-2.5 font-mono text-[11px] text-[#FF3B3B]"
                >
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleRunAudit}
                disabled={isBusy}
                className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#FF6B35] px-4 py-3 font-mono text-sm font-bold tracking-[0.14em] text-[#0A0A0A] transition-colors hover:bg-[#ff7d4d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>RUNNING GUARDED AUDIT · {elapsed}s</span>
                  </>
                ) : engine === "checking" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>CONNECTING TO ENGINE...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-[#0A0A0A]" />
                    <span>RUN AUDIT</span>
                  </>
                )}
              </button>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-1 font-mono text-[9px] text-[#555555]">
                <span>Ctrl/⌘ + Enter to scan</span>
                <span>Scan &lt; 100k chars · no code stored</span>
              </div>
            </div>
          </section>

          <section className="panel flex min-h-[640px] flex-col overflow-hidden rounded-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262626] bg-[#171717] px-4 py-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-[#FF6B35]" />
                <span className="font-mono text-xs font-semibold tracking-[0.16em] text-[#EDEDED]">
                  2 / FINDINGS &amp; FIXES
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-[#8B8B8B]">
                  {findings.length} {findings.length === 1 ? "ISSUE" : "ISSUES"}
                </span>
                {hasScanned && (
                  <>
                    <button
                      type="button"
                      onClick={handleCopyReport}
                      aria-label="Copy audit report as JSON"
                      title="Copy audit report"
                      className="rounded border border-[#262626] bg-[#111111] p-1.5 text-[#8B8B8B] transition-colors hover:border-[#FF6B35]/40 hover:text-[#EDEDED]"
                    >
                      {copiedReport ? (
                        <Check className="h-3.5 w-3.5 text-[#00C48C]" />
                      ) : (
                        <Clipboard className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadReport}
                      aria-label="Download audit report as JSON"
                      title="Download audit report"
                      className="rounded border border-[#262626] bg-[#111111] p-1.5 text-[#8B8B8B] transition-colors hover:border-[#FF6B35]/40 hover:text-[#EDEDED]"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-4 p-4">
              {isLoading ? (
                <PipelineLoader elapsed={elapsed} />
              ) : findings.length === 0 ? (
                <EmptyState hasScanned={hasScanned} />
              ) : (
                findings.map((finding, index) => {
                  const patchKey = `${finding.cwe}-${finding.line}-${index}`;
                  const isCopied = copiedPatch === patchKey;
                  return (
                    <article
                      key={patchKey}
                      className="finding-enter overflow-hidden rounded-md border border-[#262626] bg-[#171717]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#FF3B3B]/60 bg-[#FF3B3B]/10 px-4 py-2.5">
                        <div className="flex min-w-0 items-start gap-2 font-mono text-[11px] font-bold text-[#FF3B3B]">
                          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                          <span className="break-words">
                            {finding.cwe} · LINE {finding.line} — {finding.message}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded border border-[#FF3B3B]/30 bg-[#0A0A0A]/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#FF3B3B]">
                            {finding.provider === "ollama" ? "GEMMA 2:9B" : "FALLBACK PATCH"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyPatch(finding.patched_code, patchKey)}
                            aria-label={`Copy ${finding.cwe} patch`}
                            title="Copy patched code"
                            className="rounded border border-[#FF3B3B]/30 bg-[#0A0A0A]/40 p-1 text-[#FF3B3B] transition-colors hover:bg-[#FF3B3B]/20"
                          >
                            {isCopied ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Clipboard className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      {finding.explanation && (
                        <div className="border-b border-[#262626] bg-[#111111] px-4 py-2 font-mono text-[10px] leading-relaxed text-[#8B8B8B]">
                          {finding.explanation}
                        </div>
                      )}

                      <div className="diff-viewer overflow-x-auto bg-[#0A0A0A]">
                        <ReactDiffViewer
                          oldValue={finding.original_code}
                          newValue={finding.patched_code}
                          useDarkTheme
                          splitView={false}
                          hideLineNumbers={false}
                          hideSummary
                          disableWorker
                          styles={diffStyles}
                        />
                      </div>

                      {finding.verified ? (
                        <div className="flex items-start gap-2 border-t border-[#00C48C]/50 bg-[#00C48C]/10 px-4 py-2.5 font-mono text-[10px] leading-relaxed text-[#00C48C]">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            VERIFIED — Python re-scanned the patched AST and proved this CWE is
                            gone. The kill switch passed.
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 border-t border-[#FF3B3B]/50 bg-[#FF3B3B]/10 px-4 py-2.5 font-mono text-[10px] leading-relaxed text-[#FF3B3B]">
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            REJECTED — The AI patch failed ast.parse or the vulnerability survived
                            the deterministic re-scan. It is not trusted.
                          </span>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#262626] bg-[#111111] px-4 py-2 font-mono text-[9px] text-[#555555]">
              <span>Deterministic detectors · fixed CWE allowlist</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-[#00C48C]" />
                verify.py is the final authority
              </span>
            </div>
          </section>
        </div>

        <footer className="flex flex-col gap-2 border-t border-[#262626] pt-4 pb-2 font-mono text-[10px] text-[#555555] sm:flex-row sm:items-center sm:justify-between">
          <span>CODEASH · MIT License · Built for Hacktoberfest 2026 Hack Day (NIAT-ADYPU)</span>
          <span className="flex flex-wrap items-center gap-2">
            <span>API: {API_BASE_URL}</span>
            <span className="text-[#262626]">/</span>
            <span>
              {engine === "offline"
                ? "offline"
                : IS_LOCAL_API
                  ? "local engine"
                  : "Render backend"}
            </span>
          </span>
        </footer>
      </main>
    </div>
  );
}
