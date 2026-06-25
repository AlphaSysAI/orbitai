// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera, CameraOff } from "lucide-react";

type BarcodeScannerProps = {
  onDetect: (ean: string) => void;
  disabled?: boolean;
};

export function BarcodeScanner({ onDetect, disabled }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<"native" | "zxing" | "off">("off");
  const lastScanRef = useRef<{ ean: string; at: number }>({ ean: "", at: 0 });
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const rafRef = useRef<number | null>(null);

  const emitEan = useCallback(
    (raw: string) => {
      const ean = raw.replace(/\D/g, "");
      if (ean.length < 8) return;
      const now = Date.now();
      if (lastScanRef.current.ean === ean && now - lastScanRef.current.at < 1500) {
        return;
      }
      lastScanRef.current = { ean, at: now };
      onDetect(ean);
    },
    [onDetect]
  );

  const stopScanner = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    zxingReaderRef.current = null;
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
    setIsActive(false);
    setMode("off");
  }, []);

  const startScanner = useCallback(async () => {
    if (disabled) return;
    stopScanner();

    const video = videoRef.current;
    if (!video) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      setIsActive(true);

      if ("BarcodeDetector" in window) {
        setMode("native");
        const detector = new BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
        });

        const tick = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            rafRef.current = requestAnimationFrame(() => void tick());
            return;
          }
          try {
            const codes = await detector.detect(videoRef.current);
            const match = codes.find((c) => c.rawValue);
            if (match?.rawValue) emitEan(match.rawValue);
          } catch {
            // frame ignorée
          }
          rafRef.current = requestAnimationFrame(() => void tick());
        };
        rafRef.current = requestAnimationFrame(() => void tick());
      } else {
        setMode("zxing");
        const reader = new BrowserMultiFormatReader();
        zxingReaderRef.current = reader;
        reader.decodeFromVideoElement(video, (result, _err, controls) => {
          if (result) {
            emitEan(result.getText());
            controls.stop();
            void startScanner();
          }
        });
      }
    } catch {
      stopScanner();
    }
  }, [disabled, emitEan, stopScanner]);

  useEffect(() => () => stopScanner(), [stopScanner]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-700 bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 text-slate-400">
            <CameraOff size={32} />
            <p className="text-xs">Caméra inactive</p>
          </div>
        )}
        {isActive && (
          <div className="pointer-events-none absolute inset-4 rounded-xl border-2 border-amber-400/60" />
        )}
      </div>
      <button
        type="button"
        onClick={() => (isActive ? stopScanner() : void startScanner())}
        disabled={disabled}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-amber-500 disabled:opacity-50"
      >
        <Camera size={18} />
        {isActive ? "Arrêter la caméra" : "Activer le scanner"}
      </button>
      {isActive && (
        <p className="text-center text-[10px] uppercase tracking-wider text-slate-500">
          Moteur : {mode === "native" ? "BarcodeDetector" : "ZXing"}
        </p>
      )}
    </div>
  );
}
