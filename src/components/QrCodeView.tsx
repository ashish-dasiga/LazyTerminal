import React, { useMemo } from 'react';
import { generateQrMatrix } from '../utils/qrCode';

interface QrCodeViewProps {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  className?: string;
  includeIcon?: boolean;
}

export function QrCodeView({
  value,
  size = 180,
  fgColor = '#ffffff',
  bgColor = '#0a0d14',
  className = '',
  includeIcon = true,
}: QrCodeViewProps) {
  const matrix = useMemo(() => {
    try {
      return generateQrMatrix(value);
    } catch {
      return generateQrMatrix('http://localhost:3000');
    }
  }, [value]);

  const moduleCount = matrix.length;
  const cellSize = size / moduleCount;

  return (
    <div
      className={`relative inline-flex items-center justify-center p-2 rounded-xl border border-[#232838] shadow-2xl bg-[#0a0d14] ${className}`}
      style={{ width: size + 16, height: size + 16 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="rounded-lg"
      >
        <rect width={size} height={size} fill={bgColor} />
        {matrix.map((row, y) =>
          row.map((cell, x) => {
            if (!cell) return null;
            // Leave a small clearing in the center if includeIcon is true
            if (includeIcon) {
              const mid = Math.floor(moduleCount / 2);
              if (Math.abs(x - mid) <= 2 && Math.abs(y - mid) <= 2) {
                return null;
              }
            }
            return (
              <rect
                key={`${x}-${y}`}
                x={x * cellSize}
                y={y * cellSize}
                width={cellSize + 0.3}
                height={cellSize + 0.3}
                fill={fgColor}
              />
            );
          })
        )}
      </svg>

      {includeIcon && (
        <div
          className="absolute inset-0 m-auto rounded-lg overflow-hidden border border-[#30384a] bg-black shadow-lg flex items-center justify-center"
          style={{ width: size * 0.22, height: size * 0.22 }}
        >
          <img
            src="/icon.jpeg"
            alt="Lazy Terminal"
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
}
