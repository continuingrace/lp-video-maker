"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type RatioKey = "portrait" | "portrait45" | "square" | "landscape";
type QualityKey = "fast" | "compact" | "full";
type TextPositionKey = "below" | "bottom";
type TextAlignKey = "left" | "center" | "right";
type ExtraTextItem = { id: string; text: string; align: TextAlignKey; x: number; y: number; size: number };

const RATIOS: Record<RatioKey, { label: string; ratio: number }> = {
  portrait: { label: "스토리 9:16", ratio: 9 / 16 },
  portrait45: { label: "피드 4:5", ratio: 4 / 5 },
  square: { label: "정사각 1:1", ratio: 1 },
  landscape: { label: "가로 16:9", ratio: 16 / 9 },
};

const QUALITIES: Record<QualityKey, { label: string; width: number; bitrate: number; audioBitrate: number; fps: number; hint: string; fixedWidth?: boolean }> = {
  fast: { label: "빠른 저용량", width: 1080, bitrate: 1_050_000, audioBitrate: 96_000, fps: 15, hint: "15fps", fixedWidth: true },
  compact: { label: "용량 절약", width: 720, bitrate: 1_400_000, audioBitrate: 128_000, fps: 30, hint: "추천" },
  full: { label: "고화질", width: 1080, bitrate: 3_000_000, audioBitrate: 128_000, fps: 30, hint: "Full HD" },
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

function coverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
) {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = w / h;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;
  if (sourceRatio > targetRatio) {
    sw = sh * targetRatio;
  } else {
    sh = sw / targetRatio;
  }
  sw /= Math.max(1, zoom);
  sh /= Math.max(1, zoom);
  const sx = (image.naturalWidth - sw) * ((Math.max(-100, Math.min(100, offsetX)) + 100) / 200);
  const sy = (image.naturalHeight - sh) * ((Math.max(-100, Math.min(100, offsetY)) + 100) / 200);
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawFilmGrain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, angle: number) {
  if (amount <= 0) return;
  const strength = Math.max(0, Math.min(100, amount));
  const count = Math.round(120 + strength * 6);
  let seed = (Math.floor(angle * 10000) + 0x6d2b79f5) >>> 0;
  const random = () => {
    seed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed);
    return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
  };
  ctx.save();
  ctx.globalAlpha = .025 + strength * .0015;
  for (let i = 0; i < count; i += 1) {
    const size = 1 + random() * Math.max(1.2, Math.min(w, h) * .003);
    ctx.fillStyle = random() > .5 ? "#ffffff" : "#000000";
    ctx.fillRect(random() * w, random() * h, size, size);
  }
  ctx.restore();
}

function drawFrame(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | null,
  angle: number,
  title: string,
  subtitle: string,
  accent: string,
  textPosition: TextPositionKey,
  titleAlign: TextAlignKey,
  subtitleAlign: TextAlignKey,
  textOffsetX: number,
  textOffsetY: number,
  imageZoom: number,
  imageOffsetX: number,
  imageOffsetY: number,
  filterColor: string,
  filterOpacity: number,
  grainAmount: number,
  extraTexts: ExtraTextItem[],
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  const short = Math.min(w, h);
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  if (image) {
    ctx.filter = `blur(${Math.round(short * 0.045)}px) saturate(.72) brightness(.43)`;
    coverImage(ctx, image, -short * 0.08, -short * 0.08, w + short * 0.16, h + short * 0.16, imageZoom, imageOffsetX, imageOffsetY);
    ctx.filter = "none";
  } else {
    ctx.fillStyle = "#282823";
    ctx.fillRect(0, 0, w, h);
  }
  if (filterOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(100, filterOpacity)) / 100;
    ctx.fillStyle = filterColor;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  const shade = ctx.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, "rgba(10,10,8,.2)");
  shade.addColorStop(.55, "rgba(10,10,8,.36)");
  shade.addColorStop(1, "rgba(10,10,8,.78)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  drawFilmGrain(ctx, w, h, grainAmount, angle);

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
  if (image) coverImage(ctx, image, -labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2, imageZoom, imageOffsetX, imageOffsetY);
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
    const rawShiftY = (textOffsetY / 100) * h * .18;
    const blockTop = title ? titleY : subtitleY;
    const blockBottom = subtitle ? subtitleY : titleY;
    const shiftY = Math.max(short * .06 - blockTop, Math.min(h - short * .06 - blockBottom, rawShiftY));
    const anchorX = (align: TextAlignKey) => {
      const base = align === "left" ? short * .09 : align === "right" ? w - short * .09 : w / 2;
      return Math.max(short * .04, Math.min(w - short * .04, base + (textOffsetX / 100) * w * .22));
    };
    ctx.textAlign = titleAlign;
    ctx.fillStyle = "#fffdf5";
    ctx.font = `700 ${Math.round(short * .052)}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
    if (title) ctx.fillText(title, anchorX(titleAlign), titleY + shiftY, w - short * .18);
    if (subtitle) {
      ctx.textAlign = subtitleAlign;
      ctx.fillStyle = "rgba(255,253,245,.72)";
      ctx.font = `500 ${Math.round(short * .025)}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
      ctx.fillText(subtitle, anchorX(subtitleAlign), (title ? subtitleY : titleY) + shiftY, w - short * .18);
    }
  }
  if (extraTexts.length) {
    ctx.save();
    ctx.fillStyle = "#fffdf5";
    ctx.shadowColor = "rgba(0,0,0,.5)";
    ctx.shadowBlur = short * .012;
    extraTexts.forEach((item) => {
      if (!item.text.trim()) return;
      ctx.textAlign = item.align;
      ctx.textBaseline = "middle";
      ctx.font = `600 ${Math.round(short * (item.size / 100))}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
      ctx.fillText(item.text, w * (item.x / 100), h * (item.y / 100), w - short * .16);
    });
    ctx.restore();
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
  const [titleAlign, setTitleAlign] = useState<TextAlignKey>("center");
  const [subtitleAlign, setSubtitleAlign] = useState<TextAlignKey>("center");
  const [textOffsetX, setTextOffsetX] = useState(0);
  const [textOffsetY, setTextOffsetY] = useState(0);
  const [imageZoom, setImageZoom] = useState(100);
  const [imageOffsetX, setImageOffsetX] = useState(0);
  const [imageOffsetY, setImageOffsetY] = useState(0);
  const [filterColor, setFilterColor] = useState("#111827");
  const [filterOpacity, setFilterOpacity] = useState(0);
  const [grainEnabled, setGrainEnabled] = useState(false);
  const [grainAmount, setGrainAmount] = useState(24);
  const [extraTexts, setExtraTexts] = useState<ExtraTextItem[]>([]);
  const [accent, setAccent] = useState("#e2ff62");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [output, setOutput] = useState<{ url: string; file: File } | null>(null);
  const [message, setMessage] = useState("");
  const [installHint, setInstallHint] = useState(false);

  const dims = useMemo(() => {
    const preset = QUALITIES[quality];
    const width = preset.width;
    const selected = RATIOS[ratio].ratio;
    if (preset.fixedWidth) return { width, height: Math.round(width / selected) };
    if (selected <= 1) return { width, height: Math.round(width / selected) };
    return { width: Math.round(width * selected), height: width };
  }, [quality, ratio]);

  const estimatedBytes = duration ? (duration * (QUALITIES[quality].bitrate + QUALITIES[quality].audioBitrate)) / 8 : 0;

  const paintStill = useCallback((angle = 0) => {
    if (!canvasRef.current) return;
    drawFrame(
      canvasRef.current,
      imageRef.current,
      angle,
      title,
      subtitle,
      accent,
      textPosition,
      titleAlign,
      subtitleAlign,
      textOffsetX,
      textOffsetY,
      imageZoom / 100,
      imageOffsetX,
      imageOffsetY,
      filterColor,
      filterOpacity,
      grainEnabled ? grainAmount : 0,
      extraTexts,
    );
  }, [title, subtitle, accent, textPosition, titleAlign, subtitleAlign, textOffsetX, textOffsetY, imageZoom, imageOffsetX, imageOffsetY, filterColor, filterOpacity, grainEnabled, grainAmount, extraTexts]);

  function addExtraText() {
    if (extraTexts.length >= 6) return;
    const index = extraTexts.length;
    setExtraTexts((items) => [...items, {
      id: `${Date.now()}-${index}`,
      text: "추가 텍스트",
      align: "center",
      x: 50,
      y: Math.min(90, 68 + index * 7),
      size: 3.2,
    }]);
  }

  function updateExtraText(id: string, patch: Partial<ExtraTextItem>) {
    setExtraTexts((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

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
    const targetFps = mode === "render" ? QUALITIES[quality].fps : 30;
    let lastFrame = 0;
    const loop = (now: number) => {
      const audio = audioRef.current;
      if (!audio || audio.paused || audio.ended) return;
      if (!lastFrame || now - lastFrame >= 1000 / targetFps) {
        lastFrame = now;
        const seconds = mode === "render" ? (now - renderStartRef.current) / 1000 : audio.currentTime;
        const angle = seconds * (33.333 / 60) * Math.PI * 2;
        paintStill(angle);
        if (mode === "render" && now - lastProgressRef.current > 250) {
          lastProgressRef.current = now;
          setProgress(Math.min(1, audio.currentTime / Math.max(audio.duration, .01)));
        }
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
      const canvasStream = canvasRef.current.captureStream(QUALITIES[quality].fps);
      const audioTrack = mediaDestinationRef.current?.stream.getAudioTracks()[0];
      if (!audioTrack) throw new Error("오디오 트랙을 준비하지 못했어요.");
      const stream = new MediaStream([...canvasStream.getVideoTracks(), audioTrack]);
      const mimeType = supportedMime();
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: QUALITIES[quality].bitrate,
        audioBitsPerSecond: QUALITIES[quality].audioBitrate,
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
            <div className="editor-section">
              <div className="editor-heading"><div><h3>텍스트 정렬·위치</h3><p>제목과 설명은 따로 정렬할 수 있어요.</p></div><button className="reset-button" onClick={() => { setTitleAlign("center"); setSubtitleAlign("center"); setTextOffsetX(0); setTextOffsetY(0); }}>초기화</button></div>
              <div className="align-row">
                <span>제목 정렬</span>
                <div className="segmented align-options">
                  {([['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']] as const).map(([key, label]) => (
                    <button key={key} className={titleAlign === key ? "active" : ""} onClick={() => setTitleAlign(key)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="align-row">
                <span>설명 정렬</span>
                <div className="segmented align-options">
                  {([['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']] as const).map(([key, label]) => (
                    <button key={key} className={subtitleAlign === key ? "active" : ""} onClick={() => setSubtitleAlign(key)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="slider-grid">
                <label className="range-control"><span><b>가로 위치</b><small>{textOffsetX > 0 ? `+${textOffsetX}` : textOffsetX}</small></span><input aria-label="텍스트 가로 위치" type="range" min="-100" max="100" value={textOffsetX} onChange={(e) => setTextOffsetX(Number(e.target.value))} /></label>
                <label className="range-control"><span><b>세로 위치</b><small>{textOffsetY > 0 ? `+${textOffsetY}` : textOffsetY}</small></span><input aria-label="텍스트 세로 위치" type="range" min="-100" max="100" value={textOffsetY} onChange={(e) => setTextOffsetY(Number(e.target.value))} /></label>
              </div>
            </div>
            <div className="editor-section">
              <div className="editor-heading"><div><h3>추가 텍스트</h3><p>최대 6개까지 각각 자유롭게 배치할 수 있어요.</p></div><button className="add-text-button" onClick={addExtraText} disabled={extraTexts.length >= 6}>＋ 추가</button></div>
              {!extraTexts.length && <p className="empty-editor-note">추가 버튼을 누르면 새 텍스트 조절 항목이 생겨요.</p>}
              <div className="extra-text-list">
                {extraTexts.map((item, index) => (
                  <div className="extra-text-card" key={item.id}>
                    <div className="extra-text-head"><b>텍스트 {index + 1}</b><button aria-label={`텍스트 ${index + 1} 삭제`} onClick={() => setExtraTexts((items) => items.filter((candidate) => candidate.id !== item.id))}>삭제</button></div>
                    <input className="extra-text-input" aria-label={`추가 텍스트 ${index + 1} 내용`} value={item.text} maxLength={80} onChange={(e) => updateExtraText(item.id, { text: e.target.value })} />
                    <div className="align-row compact">
                      <span>정렬</span>
                      <div className="segmented align-options">
                        {([['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']] as const).map(([key, label]) => (
                          <button key={key} className={item.align === key ? "active" : ""} onClick={() => updateExtraText(item.id, { align: key })}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="slider-grid extra-text-sliders">
                      <label className="range-control full"><span><b>글자 크기</b><small>{item.size.toFixed(1)}%</small></span><input aria-label={`추가 텍스트 ${index + 1} 글자 크기`} type="range" min="1.8" max="8" step="0.2" value={item.size} onChange={(e) => updateExtraText(item.id, { size: Number(e.target.value) })} /></label>
                      <label className="range-control"><span><b>가로 위치</b><small>{item.x}%</small></span><input aria-label={`추가 텍스트 ${index + 1} 가로 위치`} type="range" min="4" max="96" value={item.x} onChange={(e) => updateExtraText(item.id, { x: Number(e.target.value) })} /></label>
                      <label className="range-control"><span><b>세로 위치</b><small>{item.y}%</small></span><input aria-label={`추가 텍스트 ${index + 1} 세로 위치`} type="range" min="4" max="96" value={item.y} onChange={(e) => updateExtraText(item.id, { y: Number(e.target.value) })} /></label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="editor-section">
              <div className="editor-heading"><div><h3>사진 위치·확대</h3><p>배경과 LP 중앙 사진에 함께 적용돼요.</p></div><button className="reset-button" onClick={() => { setImageZoom(100); setImageOffsetX(0); setImageOffsetY(0); }}>초기화</button></div>
              <div className="slider-grid">
                <label className="range-control full"><span><b>확대</b><small>{imageZoom}%</small></span><input aria-label="사진 확대" type="range" min="100" max="240" value={imageZoom} onChange={(e) => setImageZoom(Number(e.target.value))} /></label>
                <label className="range-control"><span><b>가로 이동</b><small>{imageOffsetX > 0 ? `+${imageOffsetX}` : imageOffsetX}</small></span><input aria-label="사진 가로 이동" type="range" min="-100" max="100" value={imageOffsetX} onChange={(e) => setImageOffsetX(Number(e.target.value))} /></label>
                <label className="range-control"><span><b>세로 이동</b><small>{imageOffsetY > 0 ? `+${imageOffsetY}` : imageOffsetY}</small></span><input aria-label="사진 세로 이동" type="range" min="-100" max="100" value={imageOffsetY} onChange={(e) => setImageOffsetY(Number(e.target.value))} /></label>
              </div>
            </div>
            <div className="editor-section">
              <div className="editor-heading"><div><h3>배경 필터·필름 그레인</h3><p>LP판과 글자는 선명하게 유지돼요.</p></div></div>
              <div className="filter-row">
                <label className="color-control"><span>필터 색상</span><input aria-label="배경 필터 색상" type="color" value={filterColor} onChange={(e) => setFilterColor(e.target.value)} /></label>
                <div className="filter-swatches" aria-label="추천 필터 색상">
                  {["#111827", "#24160f", "#17312b", "#321c35"].map((color) => (
                    <button key={color} aria-label={`${color} 필터`} className={filterColor === color ? "active" : ""} style={{ background: color }} onClick={() => setFilterColor(color)} />
                  ))}
                </div>
              </div>
              <label className="range-control full"><span><b>필터 농도</b><small>{filterOpacity}%</small></span><input aria-label="배경 필터 농도" type="range" min="0" max="75" value={filterOpacity} onChange={(e) => setFilterOpacity(Number(e.target.value))} /></label>
              <div className="grain-row">
                <span>필름 그레인</span>
                <div className="segmented grain-toggle">
                  <button className={!grainEnabled ? "active" : ""} onClick={() => setGrainEnabled(false)}>끄기</button>
                  <button className={grainEnabled ? "active" : ""} onClick={() => setGrainEnabled(true)}>켜기</button>
                </div>
              </div>
              <label className={`range-control full ${grainEnabled ? "" : "disabled"}`}><span><b>그레인 강도</b><small>{grainAmount}%</small></span><input aria-label="필름 그레인 강도" type="range" min="5" max="100" value={grainAmount} disabled={!grainEnabled} onChange={(e) => setGrainAmount(Number(e.target.value))} /></label>
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
            {quality === "fast" && <p className="quality-note">15fps로 기기 부담과 용량을 줄여요. 완성 시간은 녹음 길이와 같아요.</p>}
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
