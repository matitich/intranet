"use client";
import { useState } from "react";
import { Moon, Sun, Type } from "lucide-react";
export function ThemeControls() {
  const [dark, setDark] = useState(false),
    [large, setLarge] = useState(false);
  return (
    <div className="theme-controls">
      <button
        type="button"
        aria-label={dark ? "Usar modo claro" : "Usar modo oscuro"}
        onClick={() => {
          const next = !dark;
          setDark(next);
          document.documentElement.dataset.theme = next ? "dark" : "light";
        }}
      >
        {dark ? <Sun size={19} /> : <Moon size={19} />}
      </button>
      <button
        type="button"
        aria-label="Aumentar tamaño de letra"
        aria-pressed={large}
        onClick={() => {
          setLarge(!large);
          document.documentElement.style.fontSize = large ? "16px" : "19px";
        }}
      >
        <Type size={19} />
      </button>
    </div>
  );
}
