"use client";

import { Camera, Keyboard, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

type DetectedCode = { rawValue: string };
type Detector = { detect(source: HTMLVideoElement): Promise<DetectedCode[]> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

export function MemberQrScanner({ onScan, onClose, error }: { onScan: (code: string) => boolean; onClose: () => void; error: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const [code, setCode] = useState("");
  const [cameraStatus, setCameraStatus] = useState("กำลังเปิดกล้อง…");
  onScanRef.current = onScan;

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let detecting = false;
    const BrowserDetector = (window as Window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!BrowserDetector) {
      setCameraStatus("เบราว์เซอร์นี้ยังไม่รองรับการอ่าน QR ด้วยกล้อง กรุณากรอกรหัสสมาชิกด้านล่าง");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("ไม่สามารถเปิดกล้องได้ กรุณาใช้ HTTPS หรือ localhost และอนุญาตกล้อง");
      return;
    }
    const detector = new BrowserDetector({ formats: ["qr_code"] });
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }).then(async (camera) => {
      if (!active) { camera.getTracks().forEach((track) => track.stop()); return; }
      stream = camera;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = camera;
      await video.play();
      if (!active) return;
      setCameraStatus("หันกล้องไปที่ QR ด้านหลังบัตรสมาชิก");
      timer = setInterval(() => {
        if (!video.videoWidth || detecting) return;
        detecting = true;
        void detector.detect(video).then((codes) => {
          if (active && codes[0]?.rawValue && onScanRef.current(codes[0].rawValue)) active = false;
        }).catch(() => { if (active) setCameraStatus("อ่านภาพจากกล้องไม่ได้ กรุณากรอกรหัสสมาชิกแทน"); }).finally(() => { detecting = false; });
      }, 250);
    }).catch(() => { if (active) setCameraStatus("เปิดกล้องไม่สำเร็จ กรุณาอนุญาตกล้องหรือกรอกรหัสสมาชิกแทน"); });
    return () => { active = false; if (timer) clearInterval(timer); stream?.getTracks().forEach((track) => track.stop()); };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onScan(code);
  }

  return <div className="preview-modal member-qr-modal" role="dialog" aria-modal="true" aria-labelledby="member-qr-title">
    <button className="preview-backdrop" type="button" aria-label="ปิดสแกน QR" onClick={onClose} />
    <section>
      <button className="preview-close" type="button" onClick={onClose} aria-label="ปิด"><X /></button>
      <h2 id="member-qr-title"><Camera size={22} /> สแกนบัตรสมาชิก</h2>
      <p>สแกน QR ที่ลูกค้ายื่นให้ เพื่อเลือกสมาชิกก่อนให้แต้ม</p>
      <div className="member-qr-video"><video ref={videoRef} muted playsInline aria-label="ภาพจากกล้องสำหรับสแกน QR" /></div>
      <p className="member-qr-status" role="status">{cameraStatus}</p>
      <form onSubmit={submit}><label htmlFor="member-code-input"><Keyboard size={17} /> หรือกรอกรหัสสมาชิกบนบัตร</label><div><input id="member-code-input" value={code} onChange={(event) => setCode(event.target.value)} placeholder="เช่น TM000001" autoComplete="off" required /><button type="submit">ค้นหาสมาชิก</button></div></form>
      {error ? <p className="rewards-gallery-error" role="alert">{error}</p> : null}
    </section>
  </div>;
}
