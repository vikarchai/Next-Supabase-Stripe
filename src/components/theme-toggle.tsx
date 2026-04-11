"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  localStorage.setItem("theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    let t: Theme = "light";
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark") t = stored;
      else if (document.documentElement.classList.contains("dark")) t = "dark";
    } catch {
      t = document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    setTheme(t);
  }, []);

  const nextTheme: Theme = theme === "dark" ? "light" : "dark";
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => {
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }}
      className="cursor-pointer relative inline-flex h-9 w-16 items-center rounded-full border border-zinc-300 bg-zinc-100 p-1 transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-white/20 dark:bg-white/10 dark:hover:bg-white/15"
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
    >
      <span
        aria-hidden
        className="absolute left-2 text-[11px] opacity-80"
      >
        ☀
      </span>
      <span
        aria-hidden
        className="absolute right-2 text-[11px] opacity-80 dark:text-zinc-100"
      >
        🌙
      </span>
      <span
        aria-hidden
        className={`h-7 w-7 rounded-full bg-white shadow-sm transition-transform dark:bg-zinc-900 ${
          isDark ? "translate-x-7" : "translate-x-0"
        }`}
      />
    </button>
  );
}
