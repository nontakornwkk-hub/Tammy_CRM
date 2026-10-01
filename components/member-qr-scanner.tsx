"use client";

import { Camera, Keyboard, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { memberScannerKey } from "@/lib/member-code";

export function MemberQrScanner({ onScan, onClose, error }: { onScan: (code: string) => boolean; onClose: () => void; error: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef("");
  const onScanRef = useRef(onScan);
  const [code, setCode] = useState("");
  const [cameraStatus, setCameraStatus] = useState("กำลังเปิดกล้อง…");
  const [cameraFailed, setCameraFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  onScanRef.current = onScan;

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    let active = true;
    let scanner: import("qr-scanner").default | null = null;
    const video = videoRef.current;
    if (!video) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("กล้องต้องเปิดผ่าน HTTPS หรือ localhost กรุณาเปิดลิงก์ที่ปลอดภัย หรือกรอกรหัสสมาชิกด้านล่าง");
      setCameraFailed(true);
      return;
    }

    void (async () => {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (!active) return;
        scanner = new QrScanner(video, result => {
          if (active && onScanRef.current(result.data)) scanner?.stop();
        }, { preferredCamera: "environment", maxScansPerSecond: 8, returnDetailedScanResult: true });
        await scanner.start();
        if (active) { setCameraStatus("หันกล้องไปที่ QR บนบัตรสมาชิก"); setCameraFailed(false); }
      } catch (cause) {
        if (!active) return;
        const name = cause instanceof Error ? cause.name : "";
        setCameraStatus(name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "ยังไม่ได้อนุญาตกล้อง กรุณาอนุญาตในเบราว์เซอร์แล้วกดลองเปิดกล้องอีกครั้ง"
          : name === "NotFoundError" || name === "DevicesNotFoundError"
            ? "ไม่พบกล้องในอุปกรณ์นี้ กรุณากรอกรหัสสมาชิกด้านล่าง"
            : "เปิดกล้องไม่สำเร็จ กรุณาปิดแอปที่ใช้กล้องอยู่ แล้วลองอีกครั้งหรือกรอกรหัสสมาชิก");
        setCameraFailed(true);
      }
    })();

    return () => { active = false; scanner?.destroy(); };
  }, [retry]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onScan(codeRef.current);
  }

  function updateCode(value: string) {
    codeRef.current = value;
    setCode(codeRef.current);
  }

  function handleScannerKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") { event.preventDefault(); onScan(codeRef.current); return; }
    if (event.key === "Backspace") { event.preventDefault(); updateCode(codeRef.current.slice(0, -1)); return; }
    const character = memberScannerKey(event.code) || (event.code === "Minus" ? "-" : event.code === "Semicolon" && event.shiftKey ? ":" : null);
    if (character) { event.preventDefault(); updateCode(codeRef.current + character); }
  }

  return <div className="preview-modal member-qr-modal" role="dialog" aria-modal="true" aria-labelledby="member-qr-title">
    <button className="preview-backdrop" type="button" aria-label="ปิดสแกน QR" onClick={onClose} />
    <section>
      <button className="preview-close" type="button" onClick={onClose} aria-label="ปิด"><X /></button>
      <h2 id="member-qr-title"><Camera size={22} /> สแกนสมาชิกหรือคูปอง</h2>
      <p>สแกนบัตรสมาชิกเพื่อเลือกผู้รับแต้ม หรือสแกน QR คูปองเพื่อใช้สิทธิ์ ระบบอ่านได้แม้แป้นพิมพ์อยู่ภาษาไทย</p>
      <div className="member-qr-video"><video ref={videoRef} muted playsInline autoPlay aria-label="ภาพจากกล้องสำหรับสแกน QR" /></div>
      <p className="member-qr-status" role="status">{cameraStatus}</p>
      {cameraFailed && <button type="button" className="member-qr-retry" onClick={() => { setCameraFailed(false); setCameraStatus("กำลังเปิดกล้อง…"); setRetry(value => value + 1); }}><RotateCcw size={15} /> ลองเปิดกล้องอีกครั้ง</button>}
      <form onSubmit={submit}><label htmlFor="member-code-input"><Keyboard size={17} /> สแกน QR หรือกรอกรหัสสมาชิก</label><div><input ref={inputRef} id="member-code-input" value={code} onChange={(event) => updateCode(event.target.value)} onKeyDown={handleScannerKey} placeholder="รหัสสมาชิกหรือ QR คูปอง" autoComplete="off" autoCapitalize="characters" spellCheck={false} required /><button type="submit">ตรวจ QR</button></div></form>
      {error ? <p className="rewards-gallery-error" role="alert">{error}</p> : null}
    </section>
  </div>;
}
