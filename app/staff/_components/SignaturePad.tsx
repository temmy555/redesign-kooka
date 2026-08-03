"use client";

import { useEffect, useRef } from "react";

import styles from "../staff.module.css";

export default function SignaturePad({
  onChange,
}: {
  onChange: (file: File | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    context?.scale(ratio, ratio);
    if (context) {
      context.fillStyle = "#fffdf8";
      context.fillRect(0, 0, width, height);
      context.strokeStyle = "#153d34";
      context.lineWidth = 2;
      context.lineCap = "round";
    }
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = event.currentTarget.getContext("2d");
    const current = point(event);
    context?.beginPath();
    context?.moveTo(current.x, current.y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext("2d");
    const current = point(event);
    context?.lineTo(current.x, current.y);
    context?.stroke();
  }

  function finish(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    event.currentTarget.toBlob((blob) => {
      onChange(
        blob
          ? new File([blob], "guest-signature.png", { type: "image/png" })
          : null,
      );
    }, "image/png");
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#fffdf8";
    context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    context.strokeStyle = "#153d34";
    onChange(null);
  }

  return (
    <div className={styles.signatureWrap}>
      <canvas
        aria-label="Area tanda tangan tamu"
        className={styles.signatureCanvas}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        ref={canvasRef}
      />
      <button className={styles.textButton} onClick={clear} type="button">
        Hapus tanda tangan
      </button>
    </div>
  );
}
