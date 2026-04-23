import React from "react";

interface CircularTextProps {
  text: string;
  radius?: number;
  fontSize?: string;
  className?: string;
  speed?: number; // seconds per rotation
}

export const CircularText: React.FC<CircularTextProps> = ({
  text,
  radius = 180,
  fontSize = "16px",
  className = "",
  speed = 20,
}) => {
  // Repeat the text to ensure it fills the circle nicely
  const repeatedText = `${text} • ${text} • `;
  
  return (
    <div className={`relative flex items-center justify-center pointer-events-none ${className}`}>
      <svg
        viewBox="0 0 400 400"
        className="w-full h-full animate-[spin_var(--speed)_linear_infinite]"
        style={{ "--speed": `${speed}s` } as React.CSSProperties}
      >
        <defs>
          <path
            id="circlePath"
            d="M 200, 200 m -150, 0 a 150,150 0 1,1 300,0 a 150,150 0 1,1 -300,0"
          />
        </defs>
        <text
          fill="currentColor"
          style={{ fontSize, letterSpacing: "0.1em", fontWeight: 500, fontFamily: "serif" }}
        >
          <textPath href="#circlePath" startOffset="0%">
            {repeatedText}
          </textPath>
        </text>
      </svg>
    </div>
  );
};
