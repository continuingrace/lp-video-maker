"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type RatioKey = "portrait" | "portrait45" | "square" | "landscape";
type QualityKey = "compact" | "full";
type TextPositionKey = "below" | "bottom";

const RATIOS: Record<RatioKey, { label: string; ratio: number }> = {
  portrait: { label: "스토리 9:16", ratio: 9 / 16 },
  portrait45: { label: "피드 4:5", ratio: 4 / 5 },
  square: { label: "정사각 1:1", ratio: 1 },
  landscape: { label: "가로 16:9", ratio: 16 / 9 },
};

const QUALITIES: Record<QualityKey, { label: string; width: number; bitrate: number; hint: string }> = {
  compact: { label: "용량 절약", width: 720, bitrate: 1_400_000, hint: "추천" },
  full: { label: "고화질", width: 1080, bitrate: 3_000_000, hint: "Full HD" },
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes > 100 * 1024 * 1024 ? 0 : 1)}MB`;
}

function fileStem(name: string) {
  return name.replace(/\.[^/.]+$/, "").replace(/[\\/:*?"<>|]+/g, "-").trim() || "LP-video";
}

function coverImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = w / h;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;
  let sx = 0;
  let sy = 0;
  if (sourceRatio > targetRatio) {
    sw = sh * targetRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = sw / targetRatio;
    sy = (image.naturalHeight - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawFrame(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | null,
  angle: number,
  title: string,
  subtitle: string,
  accent: string,
  textPosition: TextPositionKey,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  const short = Math.min(w, h);
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  if (image) {
    ctx.filter = `blur(${Math.round(short * 0.045)}px) saturate(.72) brightness(.43)`;
    coverImage(ctx, image, -short * 0.08, -short * 0.08, w + short * 0.16, h + short * 0.16);
    ctx.filter = "none";
  } else {
    ctx.fillStyle = "#282823";
    ctx.fillRect(0, 0, w, h);
  }
  const shade = ctx.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, "rgba(10,10,8,.2)");
  shade.addColorStop(.55, "rgba(10,10,8,.36)");
  shade.addColorStop(1, "rgba(10,10,8,.78)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);

  const discRadius = short * (w < h ? 0.39 : 0.31);
  const discX = w / 2;
  const discY = h * (w < h ? 0.43 : 0.47);

  ctx.save();
  ctx.translate(discX, discY);
  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = short * 0.055;
  ctx.shadowOffsetY = short * 0.025;
  ctx.beginPath();
  ctx.arc(0, 0, discRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#0b0b0b";
  ctx.fill();
  ctx.shadowColor = "transparent";

  const sheen = ctx.createRadialGradient(-discRadius * .28, -discRadius * .32, 0, 0, 0, discRadius);
  sheen.addColorStop(0, "rgba(255,255,255,.16)");
  sheen.addColorStop(.32, "rgba(255,255,255,.02)");
  sheen.addColorStop(.64, "rgba(255,255,255,.075)");
  sheen.addColorStop(1, "rgba(255,255,255,.02)");
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.arc(0, 0, discRadius * .985, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.lineWidth = Math.max(1, short * .0012);
  for (let r = discRadius * .52; r < discRadius * .94; r += discRadius * .027) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.rotate(angle);
  const labelRadius = discRadius * .43;
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, labelRadius, 0, Math.PI * 2);
  ctx.clip();
  if (image) coverImage(ctx, image, -labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
  else {
    ctx.fillStyle = accent;
    ctx.fillRect(-labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
  }
  ctx.fillStyle = "rgba(0,0,0,.08)";
  ctx.fillRect(-labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
  ctx.restore();

  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.arc(0, 0, discRadius * .035, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.beginPath();
  ctx.arc(-discRadius * .009, -discRadius * .009, discRadius * .012, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (title || subtitle) {
    const titleY = textPosition === "below"
      ? Math.min(h - short * .17, discY + discRadius + short * .09)
      : h - short * (subtitle ? .176 : .12);
    const subtitleY = textPosition === "below"
      ? titleY + short * .052
      : h - short * .12;
    ctx.textAlign = "center";
    ctx.fillStyle = "#fffdf5";
    ctx.font = `700 ${Math.round(short * .052)}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
    if (title) ctx.fillText(title, w / 2, titleY, w - short * .14);
    if (subtitle) {
      ctx.fillStyle = "rgba(255,253,245,.72)";
      ctx.font = `500 ${Math.round(short * .025)}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
      ctx.fillText(subtitle, w / 2, title ? subtitleY : titleY, w - short * .18);
    }
  }
  ctx.restore();
}

export default function LPVideoMaker() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const mediaDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const renderStartRef = useRef(0);
  const lastProgressRef = useRef(0);
  const finishPlaybackRef = useRef<(() => void) | null>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [ratio, setRatio] = useState<RatioKey>("portrait");
  const [quality, setQuality] = useState<QualityKey>("compact");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [textPosition, setTextPosition] = useState<TextPositionKey>("below");
  const [accent, setAccent] = useState("#e2ff62");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [output, setOutput] = useState<{ url: string; file: File } | null>(null);
  const [message, setMessage] = useState("");
  const [installHint, setInstallHint] = useState(false);

  const dims = useMemo(() => {
    const width = QUALITIES[quality].width;
    const selected = RATIOS[ratio].ratio;
    if (selected <= 1) return { width, height: Math.round(width / selected) };
    return { width: Math.round(width * selected), height: width };
  }, [quality, ratio]);

  const estimatedBytes = duration ? (duration * (QUALITIES[quality].bitrate + 128_000)) / 8 : 0;

  const paintStill = useCallback((angle = 0) => {
    if (!canvasRef.current) return;
    drawFrame(canvasRef.current, imageRef.current, angle, title, subtitle, accent, textPosition);
  }, [title, subtitle, accent, textPosition]);

  useEffect(() => {
    if (!canvasRef.current) return;
    canvasRef.current.width = dims.width;
    canvasRef.current.height = dims.height;
    paintStill();
  }, [dims, paintStill]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => undefined);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    const hintTimer = window.setTimeout(() => setInstallHint(isIos && !standalone), 0);
    return () => {
      window.clearTimeout(hintTimer);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
    };
  }, []);

  useEffect(() => {
    if (!isPreviewing && !isRendering) paintStill();
  }, [paintStill, isPreviewing, isRendering]);

  async function ensureAudioGraph() {
    const audio = audioRef.current;
    if (!audio) throw new Error("먼저 녹음파일을 선택해 주세요.");
    if (!audioContextRef.current) {
      const context = new AudioContext();
      const source = context.createMediaElementSource(audio);
      const monitor = context.createGain();
      const mediaDestination = context.createMediaStreamDestination();
      source.connect(monitor);
      monitor.connect(context.destination);
      source.connect(mediaDestination);
      audioContextRef.current = context;
      monitorGainRef.current = monitor;
      mediaDestinationRef.current = mediaDestination;
    }
    await audioContextRef.current.resume();
  }

  function animate(mode: "preview" | "render") {
    const loop = () => {
      const audio = audioRef.current;
      if (!audio || audio.paused || audio.ended) return;
      const seconds = mode === "render" ? (performance.now() - renderStartRef.current) / 1000 : audio.currentTime;
      const angle = seconds * (33.333 / 60) * Math.PI * 2;
      paintStill(angle);
      if (mode === "render" && performance.now() - lastProgressRef.current > 250) {
        lastProgressRef.current = performance.now();
        setProgress(Math.min(1, audio.currentTime / Math.max(audio.duration, .01)));
      }
      animationRef.current = requestAnimationFrame(loop);
    };
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(loop);
  }

  async function onAudio(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    stopEverything();
    if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
    const audio = audioRef.current ?? new Audio();
    audio.preload = "metadata";
    audio.src = URL.createObjectURL(file);
    audioRef.current = audio;
    setAudioFile(file);
    setTitle((current) => current || fileStem(file.name));
    setOutput((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return null;
    });
    setMessage("");
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration), { once: true });
    audio.addEventListener("error", () => setMessage("이 녹음파일을 읽지 못했어요. m4a, mp3, wav 파일을 사용해 주세요."), { once: true });
    audio.load();
  }

  function onImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      imageRef.current = image;
      setImageFile(file);
      paintStill();
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      setMessage("이 이미지를 읽지 못했어요. JPG, PNG 파일을 사용해 주세요.");
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }

  function stopEverything() {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    finishPlaybackRef.current?.();
    finishPlaybackRef.current = null;
    setIsPreviewing(false);
    setIsRendering(false);
  }

  async function togglePreview() {
    try {
      await ensureAudioGraph();
      const audio = audioRef.current!;
      if (isPreviewing) {
        audio.pause();
        setIsPreviewing(false);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        return;
      }
      if (audio.ended) audio.currentTime = 0;
      if (monitorGainRef.current) monitorGainRef.current.gain.value = 1;
      await audio.play();
      setIsPreviewing(true);
      animate("preview");
      audio.addEventListener("ended", () => {
        setIsPreviewing(false);
        paintStill();
      }, { once: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "미리보기를 시작하지 못했어요.");
    }
  }

  function supportedMime() {
    const candidates = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  async function renderVideo() {
    if (!audioFile || !imageFile || !canvasRef.current || !audioRef.current) {
      setMessage("녹음파일과 썸네일 이미지를 모두 선택해 주세요.");
      return;
    }
    if (!("MediaRecorder" in window) || !("captureStream" in canvasRef.current)) {
      setMessage("이 브라우저에서는 영상 만들기를 지원하지 않아요. 아이폰의 최신 Safari로 열어 주세요.");
      return;
    }
    try {
      setMessage("");
      setProgress(0);
      setOutput((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return null;
      });
      await ensureAudioGraph();
      if (monitorGainRef.current) monitorGainRef.current.gain.value = 0;
      const canvasStream = canvasRef.current.captureStream(30);
      const audioTrack = mediaDestinationRef.current?.stream.getAudioTracks()[0];
      if (!audioTrack) throw new Error("오디오 트랙을 준비하지 못했어요.");
      const stream = new MediaStream([...canvasStream.getVideoTracks(), audioTrack]);
      const mimeType = supportedMime();
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: QUALITIES[quality].bitrate,
        audioBitsPerSecond: 128_000,
      });
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };

      const wakeLock = "wakeLock" in navigator
        ? await (navigator as Navigator & { wakeLock: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen").catch(() => null)
        : null;

      const completed = new Promise<void>((resolve, reject) => {
        recorder.onerror = () => reject(new Error("영상 기록 중 문제가 생겼어요."));
        recorder.onstop = () => resolve();
      });

      const audio = audioRef.current!;
      audio.pause();
      audio.currentTime = 0;
      paintStill(0);
      recorder.start(1000);
      setIsRendering(true);
      renderStartRef.current = performance.now();
      lastProgressRef.current = 0;
      await audio.play();
      animate("render");

      await new Promise<void>((resolve) => {
        const finish = () => {
          audio.removeEventListener("ended", finish);
          resolve();
        };
        finishPlaybackRef.current = finish;
        audio.addEventListener("ended", finish, { once: true });
      });
      finishPlaybackRef.current = null;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      const cancelled = !audio.ended;
      if (recorder.state === "recording") recorder.stop();
      await completed;
      await wakeLock?.release();
      stream.getTracks().forEach((track) => track.stop());

      if (cancelled) {
        setProgress(0);
        setIsRendering(false);
        paintStill();
        return;
      }

      const finalType = recorder.mimeType || mimeType || "video/mp4";
      const extension = finalType.includes("webm") ? "webm" : "mp4";
      const blob = new Blob(chunks, { type: finalType });
      const file = new File([blob], `${fileStem(audioFile.name)}-LP.${extension}`, { type: finalType });
      setOutput({ url: URL.createObjectURL(blob), file });
      setProgress(1);
      setIsRendering(false);
      paintStill();
      if (finalType.includes("webm")) setMessage("영상은 완성됐지만 이 기기에서는 WebM 형식으로 저장됐어요.");
    } catch (error) {
      setIsRendering(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      setMessage(error instanceof Error ? error.message : "영상을 만들지 못했어요. 다시 시도해 주세요.");
    }
  }

  async function shareOutput() {
    if (!output) return;
    try {
      if (navigator.canShare?.({ files: [output.file] })) {
        await navigator.share({ files: [output.file], title: "LP 영상" });
      } else {
        const anchor = document.createElement("a");
        anchor.href = output.url;
        anchor.download = output.file.name;
        anchor.click();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("공유창을 열지 못했어요. 아래 영상의 메뉴에서 저장해 주세요.");
    }
  }

  const ready = Boolean(audioFile && imageFile && duration);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><i /></div>
        <div>
          <p className="eyebrow">LOCAL VIDEO STUDIO</p>
          <h1>LP 영상 만들기</h1>
        </div>
        <span className="privacy-pill"><i /> 기기 안에서만 처리</span>
      </header>

      <section className="maker-grid">
        <div className="preview-column">
          <div className={`canvas-shell ratio-${ratio}`}>
            <canvas ref={canvasRef} aria-label="LP 영상 미리보기" />
            {!imageFile && (
              <div className="empty-preview">
                <div className="mini-record"><i /></div>
                <p>사진을 고르면<br />LP 라벨이 완성돼요</p>
              </div>
            )}
          </div>
          <button className="preview-button" onClick={togglePreview} disabled={!audioFile || isRendering}>
            <span aria-hidden="true">{isPreviewing ? "Ⅱ" : "▶"}</span>
            {isPreviewing ? "미리보기 멈춤" : "소리와 함께 미리보기"}
          </button>
          {installHint && (
            <p className="install-tip"><span aria-hidden="true">↥</span> Safari의 공유 버튼 → <b>홈 화면에 추가</b>를 누르면 앱처럼 쓸 수 있어요.</p>
          )}
        </div>

        <div className="controls-column">
          <section className="control-card">
            <div className="step-title"><span>1</span><div><h2>파일 고르기</h2><p>녹음과 썸네일 사진 한 장이면 돼요.</p></div></div>
            <div className="upload-grid">
              <label className={`upload-box ${audioFile ? "selected" : ""}`}>
                <input type="file" accept="audio/*,.m4a,.mp3,.wav,.aac" onChange={onAudio} />
                <span className="upload-icon">♪</span>
                <b>{audioFile ? audioFile.name : "녹음파일"}</b>
                <small>{audioFile ? `${formatTime(duration)} · ${formatBytes(audioFile.size)}` : "m4a, mp3, wav"}</small>
              </label>
              <label className={`upload-box ${imageFile ? "selected" : ""}`}>
                <input type="file" accept="image/*,.heic,.heif" onChange={onImage} />
                <span className="upload-icon">▣</span>
                <b>{imageFile ? imageFile.name : "썸네일 이미지"}</b>
                <small>{imageFile ? formatBytes(imageFile.size) : "jpg, png, heic"}</small>
              </label>
            </div>
          </section>

          <section className="control-card">
            <div className="step-title"><span>2</span><div><h2>화면 꾸미기</h2><p>원하는 비율과 글자를 정해 주세요.</p></div></div>
            <div className="field-label"><span>영상 비율</span></div>
            <div className="segmented ratio-grid">
              {(Object.keys(RATIOS) as RatioKey[]).map((key) => (
                <button key={key} className={ratio === key ? "active" : ""} onClick={() => setRatio(key)}>{RATIOS[key].label}</button>
              ))}
            </div>
            <div className="text-fields">
              <label><span>제목 <small>선택</small></span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={34} placeholder="예: 시편 23편" /></label>
              <label><span>작은 설명 <small>선택</small></span><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={50} placeholder="예: 임마누엘성가대 리허설" /></label>
            </div>
            <div className="text-position-field">
              <div className="field-label"><span>텍스트 위치</span></div>
              <div className="segmented text-position">
                <button className={textPosition === "below" ? "active" : ""} onClick={() => setTextPosition("below")}>LP 바로 아래</button>
                <button className={textPosition === "bottom" ? "active" : ""} onClick={() => setTextPosition("bottom")}>화면 하단</button>
              </div>
            </div>
            <div className="accent-row">
              <span>포인트 색상</span>
              {["#e2ff62", "#ff8064", "#86d8ff", "#cab2ff"].map((color) => (
                <button key={color} aria-label={`${color} 색상`} className={accent === color ? "active" : ""} style={{ background: color }} onClick={() => setAccent(color)} />
              ))}
            </div>
          </section>

          <section className="control-card">
            <div className="step-title"><span>3</span><div><h2>영상 만들기</h2><p>녹음 길이만큼 실시간으로 만들어져요.</p></div></div>
            <div className="segmented quality">
              {(Object.keys(QUALITIES) as QualityKey[]).map((key) => (
                <button key={key} className={quality === key ? "active" : ""} onClick={() => setQuality(key)} disabled={isRendering}>
                  <b>{QUALITIES[key].label}</b><small>{QUALITIES[key].hint}</small>
                </button>
              ))}
            </div>
            <div className="render-summary">
              <span>{dims.width} × {dims.height}px</span>
              <span>예상 최대 {estimatedBytes ? formatBytes(estimatedBytes) : "—"}</span>
            </div>
            {isRendering && (
              <div className="progress-wrap" aria-live="polite">
                <div><span>LP가 돌아가는 중</span><b>{Math.round(progress * 100)}%</b></div>
                <progress value={progress} max={1} />
                <small>화면을 끄거나 다른 앱으로 이동하지 마세요 · {formatTime(progress * duration)} / {formatTime(duration)}</small>
              </div>
            )}
            {message && <p className="message" role="status">{message}</p>}
            <button className="make-button" onClick={isRendering ? stopEverything : renderVideo} disabled={!ready && !isRendering}>
              {isRendering ? "영상 만들기 중단" : "LP 영상 만들기"}
              {!isRendering && <span aria-hidden="true">→</span>}
            </button>
          </section>

          {output && (
            <section className="output-card">
              <div className="output-heading"><span>✓</span><div><h2>영상이 완성됐어요</h2><p>{output.file.name} · {formatBytes(output.file.size)}</p></div></div>
              <video src={output.url} controls playsInline preload="metadata" />
              <button className="share-button" onClick={shareOutput}>아이폰에 저장 · 공유</button>
              <p>공유창에서 <b>비디오 저장</b> 또는 <b>파일에 저장</b>을 선택하세요.</p>
            </section>
          )}
        </div>
      </section>

      <footer><span>LP VIDEO MAKER</span><p>파일은 업로드되지 않으며, 페이지를 닫으면 선택한 원본과 완성 영상이 지워집니다.</p></footer>
    </main>
  );
}
