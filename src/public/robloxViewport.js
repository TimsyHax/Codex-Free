/**
 * Client-Side 3D Roblox Studio Viewport Renderer, R15 Forward-Kinematics Rig Player,
 * and Photo/Video Attachment Visual & Motion-Capture Analyzer.
 */

export function createRobloxViewportController(canvas, initialAsset = null, onTimeUpdate = null) {
  const ctx = canvas.getContext("2d");
  let asset = initialAsset;
  let yaw = -0.55;
  let pitch = 0.35;
  let distance = 26;
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  let isPlaying = true;
  let animTime = 0;
  let lastFrameTs = performance.now();
  let rafId = null;

  canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    yaw += dx * 0.012;
    pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * 0.012));
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      distance = Math.max(10, Math.min(55, distance + e.deltaY * 0.02));
    },
    { passive: false }
  );

  function rotateVec3([x, y, z], [rxDeg, ryDeg, rzDeg]) {
    const rx = (rxDeg * Math.PI) / 180;
    const ry = (ryDeg * Math.PI) / 180;
    const rz = (rzDeg * Math.PI) / 180;

    // Rotate Z
    let x1 = x * Math.cos(rz) - y * Math.sin(rz);
    let y1 = x * Math.sin(rz) + y * Math.cos(rz);
    let z1 = z;

    // Rotate X
    let x2 = x1;
    let y2 = y1 * Math.cos(rx) - z1 * Math.sin(rx);
    let z2 = y1 * Math.sin(rx) + z1 * Math.cos(rx);

    // Rotate Y
    let x3 = x2 * Math.cos(ry) + z2 * Math.sin(ry);
    let y3 = y2;
    let z3 = -x2 * Math.sin(ry) + z2 * Math.cos(ry);

    return [x3, y3, z3];
  }

  function projectPoint([wx, wy, wz], centerY = 5.5) {
    const w = canvas.width;
    const h = canvas.height;
    const x = wx;
    const y = wy - centerY;
    const z = wz;

    // Camera yaw around Y
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const rx = x * cy - z * sy;
    const rz = x * sy + z * cy;

    // Camera pitch around X
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const ry = y * cp - rz * sp;
    const cz = y * sp + rz * cp + distance;

    const fov = Math.min(w, h) * 1.15;
    const scale = fov / Math.max(1.5, cz);
    return {
      sx: w / 2 + rx * scale,
      sy: h / 2 - ry * scale,
      depth: cz,
      scale
    };
  }

  function shadeColor(hex, factor = 1) {
    const clean = String(hex || "#89b4fa").replace("#", "");
    const num = parseInt(clean, 16) || 0x89b4fa;
    const r = Math.min(255, Math.max(0, Math.round(((num >> 16) & 255) * factor)));
    const g = Math.min(255, Math.max(0, Math.round(((num >> 8) & 255) * factor)));
    const b = Math.min(255, Math.max(0, Math.round((num & 255) * factor)));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function drawBaseplateGrid(centerY) {
    ctx.strokeStyle = "rgba(137, 180, 250, 0.13)";
    ctx.lineWidth = 1;
    const gridExtent = 12;
    const step = 2;
    for (let i = -gridExtent; i <= gridExtent; i += step) {
      const p1 = projectPoint([i, 0, -gridExtent], centerY);
      const p2 = projectPoint([i, 0, gridExtent], centerY);
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.stroke();

      const q1 = projectPoint([-gridExtent, 0, i], centerY);
      const q2 = projectPoint([gridExtent, 0, i], centerY);
      ctx.beginPath();
      ctx.moveTo(q1.sx, q1.sy);
      ctx.lineTo(q2.sx, q2.sy);
      ctx.stroke();
    }
  }

  function collectBoxFaces(part, centerY) {
    const [sx, sy, sz] = part.size || [1, 1, 1];
    const [px, py, pz] = part.pos || [0, 0, 0];
    const rot = part.rot || [0, 0, 0];
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;

    const localVerts = [
      [-hx, -hy, -hz],
      [hx, -hy, -hz],
      [hx, hy, -hz],
      [-hx, hy, -hz],
      [-hx, -hy, hz],
      [hx, -hy, hz],
      [hx, hy, hz],
      [-hx, hy, hz]
    ];

    // If Wedge shape, collapse top-front edge
    if (part.shape === "Wedge") {
      localVerts[2] = [hx, -hy, -hz];
      localVerts[3] = [-hx, -hy, -hz];
    }

    const worldVerts = localVerts.map((v) => {
      const [rx, ry, rz] = rotateVec3(v, rot);
      return [px + rx, py + ry, pz + rz];
    });

    const projVerts = worldVerts.map((v) => projectPoint(v, centerY));

    const faceDefs = [
      { idx: [0, 1, 2, 3], shade: 0.92 }, // Front
      { idx: [5, 4, 7, 6], shade: 0.78 }, // Back
      { idx: [3, 2, 6, 7], shade: 1.15 }, // Top
      { idx: [4, 5, 1, 0], shade: 0.58 }, // Bottom
      { idx: [4, 0, 3, 7], shade: 0.84 }, // Left
      { idx: [1, 5, 6, 2], shade: 0.98 }  // Right
    ];

    return faceDefs.map((f) => {
      const pts = f.idx.map((i) => projVerts[i]);
      const avgDepth = pts.reduce((acc, p) => acc + p.depth, 0) / pts.length;
      return {
        pts,
        avgDepth,
        color: part.color || "#89b4fa",
        shade: f.shade,
        isNeon: part.material === "Neon",
        transparency: part.transparency || 0
      };
    });
  }

  function interpolateAnimationPoses(animSpec, t) {
    const kfs = animSpec.keyframes || [];
    if (kfs.length === 0) return {};
    if (kfs.length === 1) return kfs[0].poses || {};

    const dur = animSpec.duration || kfs[kfs.length - 1].time || 1.0;
    const loopedT = ((t % dur) + dur) % dur;

    let kfA = kfs[0];
    let kfB = kfs[kfs.length - 1];
    for (let i = 0; i < kfs.length - 1; i++) {
      if (loopedT >= kfs[i].time && loopedT <= kfs[i + 1].time) {
        kfA = kfs[i];
        kfB = kfs[i + 1];
        break;
      }
    }

    const span = Math.max(0.0001, kfB.time - kfA.time);
    let alpha = Math.max(0, Math.min(1, (loopedT - kfA.time) / span));
    // Smooth cubic ease in-out
    alpha = alpha < 0.5 ? 2 * alpha * alpha : 1 - Math.pow(-2 * alpha + 2, 2) / 2;

    const allJoints = new Set([
      ...Object.keys(kfA.poses || {}),
      ...Object.keys(kfB.poses || {})
    ]);
    const out = {};
    for (const j of allJoints) {
      const a = kfA.poses?.[j] || { pos: [0, 0, 0], rot: [0, 0, 0] };
      const b = kfB.poses?.[j] || { pos: [0, 0, 0], rot: [0, 0, 0] };
      const posA = a.pos || [0, 0, 0];
      const posB = b.pos || [0, 0, 0];
      const rotA = a.rot || [0, 0, 0];
      const rotB = b.rot || [0, 0, 0];
      out[j] = {
        pos: [
          posA[0] + (posB[0] - posA[0]) * alpha,
          posA[1] + (posB[1] - posA[1]) * alpha,
          posA[2] + (posB[2] - posA[2]) * alpha
        ],
        rot: [
          rotA[0] + (rotB[0] - rotA[0]) * alpha,
          rotA[1] + (rotB[1] - rotA[1]) * alpha,
          rotA[2] + (rotB[2] - rotA[2]) * alpha
        ]
      };
    }
    return out;
  }

  function buildR15RigParts(poses = {}) {
    const addVec = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

    const ltPose = poses.LowerTorso || { pos: [0, 0, 0], rot: [0, 0, 0] };
    const utPose = poses.UpperTorso || { pos: [0, 0, 0], rot: [0, 0, 0] };
    const headPose = poses.Head || { pos: [0, 0, 0], rot: [0, 0, 0] };

    const rootPos = addVec([0, 4.4, 0], ltPose.pos);
    const torsoRot = addVec(ltPose.rot, utPose.rot);
    const upperTorsoPos = addVec(rootPos, rotateVec3([0, 1.55, 0], ltPose.rot));
    const headPos = addVec(upperTorsoPos, rotateVec3([0, 1.85, 0], torsoRot));

    // Arms
    const luaRot = addVec(torsoRot, poses.LeftUpperArm?.rot || [0, 0, 0]);
    const llaRot = addVec(luaRot, poses.LeftLowerArm?.rot || [0, 0, 0]);
    const lShoulder = addVec(upperTorsoPos, rotateVec3([-1.85, 0.55, 0], torsoRot));
    const lUpperArmPos = addVec(lShoulder, rotateVec3([0, -0.75, 0], luaRot));
    const lLowerArmPos = addVec(lUpperArmPos, rotateVec3([0, -1.35, 0], llaRot));

    const ruaRot = addVec(torsoRot, poses.RightUpperArm?.rot || [0, 0, 0]);
    const rlaRot = addVec(ruaRot, poses.RightLowerArm?.rot || [0, 0, 0]);
    const rShoulder = addVec(upperTorsoPos, rotateVec3([1.85, 0.55, 0], torsoRot));
    const rUpperArmPos = addVec(rShoulder, rotateVec3([0, -0.75, 0], ruaRot));
    const rLowerArmPos = addVec(rUpperArmPos, rotateVec3([0, -1.35, 0], rlaRot));

    // Legs
    const lulRot = addVec(ltPose.rot, poses.LeftUpperLeg?.rot || [0, 0, 0]);
    const lllRot = addVec(lulRot, poses.LeftLowerLeg?.rot || [0, 0, 0]);
    const lHip = addVec(rootPos, rotateVec3([-0.72, -0.75, 0], ltPose.rot));
    const lUpperLegPos = addVec(lHip, rotateVec3([0, -0.95, 0], lulRot));
    const lLowerLegPos = addVec(lUpperLegPos, rotateVec3([0, -1.55, 0], lllRot));

    const rulRot = addVec(ltPose.rot, poses.RightUpperLeg?.rot || [0, 0, 0]);
    const rllRot = addVec(rulRot, poses.RightLowerLeg?.rot || [0, 0, 0]);
    const rHip = addVec(rootPos, rotateVec3([0.72, -0.75, 0], ltPose.rot));
    const rUpperLegPos = addVec(rHip, rotateVec3([0, -0.95, 0], rulRot));
    const rLowerLegPos = addVec(rUpperLegPos, rotateVec3([0, -1.55, 0], rllRot));

    return [
      { name: "LowerTorso", size: [2.2, 1.0, 1.2], pos: rootPos, rot: ltPose.rot, color: "#2b3346" },
      { name: "UpperTorso", size: [2.5, 2.0, 1.3], pos: upperTorsoPos, rot: torsoRot, color: "#3b82f6" },
      { name: "TorsoCoreBadge", size: [0.9, 0.6, 1.38], pos: upperTorsoPos, rot: torsoRot, color: "#00f5d4", material: "Neon" },
      { name: "Head", size: [1.45, 1.45, 1.45], pos: headPos, rot: addVec(torsoRot, headPose.rot), color: "#facc15" },
      { name: "Visor", size: [1.2, 0.35, 1.52], pos: headPos, rot: addVec(torsoRot, headPose.rot), color: "#00f5d4", material: "Neon" },
      { name: "LeftUpperArm", size: [0.95, 1.5, 0.95], pos: lUpperArmPos, rot: luaRot, color: "#60a5fa" },
      { name: "LeftLowerArm", size: [0.88, 1.45, 0.88], pos: lLowerArmPos, rot: llaRot, color: "#facc15" },
      { name: "RightUpperArm", size: [0.95, 1.5, 0.95], pos: rUpperArmPos, rot: ruaRot, color: "#60a5fa" },
      { name: "RightLowerArm", size: [0.88, 1.45, 0.88], pos: rLowerArmPos, rot: rlaRot, color: "#facc15" },
      // Energy Katana in Right Hand for combat animations!
      { name: "EquippedKatanaBlade", size: [0.16, 4.2, 0.25], pos: addVec(rLowerArmPos, rotateVec3([0, -1.8, -1.4], rlaRot)), rot: addVec(rlaRot, [75, 0, 0]), color: "#00f5d4", material: "Neon" },
      { name: "LeftUpperLeg", size: [1.05, 1.65, 1.05], pos: lUpperLegPos, rot: lulRot, color: "#1e293b" },
      { name: "LeftLowerLeg", size: [0.98, 1.65, 0.98], pos: lLowerLegPos, rot: lllRot, color: "#10b981" },
      { name: "RightUpperLeg", size: [1.05, 1.65, 1.05], pos: rUpperLegPos, rot: rulRot, color: "#1e293b" },
      { name: "RightLowerLeg", size: [0.98, 1.65, 0.98], pos: rLowerLegPos, rot: rllRot, color: "#10b981" }
    ];
  }

  function renderFrame(now) {
    const dt = (now - lastFrameTs) / 1000;
    lastFrameTs = now;

    if (isPlaying && !isDragging) {
      if (asset?.type === "roblox_animation") {
        const dur = asset.duration || 1.5;
        animTime = (animTime + dt) % dur;
        if (onTimeUpdate) onTimeUpdate(animTime, dur);
      } else {
        yaw += dt * 0.45;
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerY = asset?.type === "roblox_animation" ? 4.8 : 6.0;
    drawBaseplateGrid(centerY);

    let partsToDraw = [];
    if (asset?.type === "roblox_animation") {
      const poses = interpolateAnimationPoses(asset, animTime);
      partsToDraw = buildR15RigParts(poses);
    } else if (asset?.parts) {
      partsToDraw = asset.parts;
    }

    const allFaces = [];
    for (const part of partsToDraw) {
      allFaces.push(...collectBoxFaces(part, centerY));
    }

    // Painter's algorithm sort: back to front
    allFaces.sort((a, b) => b.avgDepth - a.avgDepth);

    for (const f of allFaces) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(f.pts[0].sx, f.pts[0].sy);
      for (let i = 1; i < f.pts.length; i++) {
        ctx.lineTo(f.pts[i].sx, f.pts[i].sy);
      }
      ctx.closePath();

      ctx.globalAlpha = Math.max(0.2, 1 - (f.transparency || 0));
      ctx.fillStyle = f.isNeon ? f.color : shadeColor(f.color, f.shade);
      if (f.isNeon) {
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 10;
      }
      ctx.fill();
      ctx.strokeStyle = "rgba(15, 17, 23, 0.45)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }

    // HUD Overlay inside canvas
    ctx.fillStyle = "rgba(205, 214, 244, 0.78)";
    ctx.font = "11px monospace";
    if (asset?.type === "roblox_animation") {
      const dur = asset.duration || 1.5;
      ctx.fillText(
        `R15 RIG · ${asset.name} · t=${animTime.toFixed(2)}s / ${dur.toFixed(2)}s`,
        10,
        18
      );
    } else if (asset) {
      ctx.fillText(
        `3D STUDIO · ${asset.name} (${asset.partCount || (asset.parts || []).length} parts) · Drag to Orbit`,
        10,
        18
      );
    }

    rafId = requestAnimationFrame(renderFrame);
  }

  rafId = requestAnimationFrame(renderFrame);

  return {
    setAsset(newAsset) {
      asset = newAsset;
      animTime = 0;
      distance = newAsset?.type === "roblox_animation" ? 18 : 25;
    },
    getAsset() {
      return asset;
    },
    togglePlay() {
      isPlaying = !isPlaying;
      return isPlaying;
    },
    setNormalizedTime(pct0to100) {
      const ratio = Math.max(0, Math.min(1, Number(pct0to100) / 100));
      if (asset?.type === "roblox_animation") {
        animTime = ratio * (asset.duration || 1.5);
      } else {
        yaw = ratio * Math.PI * 2;
      }
    },
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
    }
  };
}

/**
 * Analyzes an uploaded Photo or Video file in the browser:
 * - For Photos: extracts dominant hex color palette + dimensions + thumbnail dataURL
 * - For Videos: samples 6 keyframes across the video to extract motion vectors + center-of-mass trajectory
 */
export async function analyzeMediaFile(file) {
  const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|ogg)$/i.test(file.name);
  if (isVideo) {
    return analyzeVideoFile(file);
  }
  return analyzeImageFile(file);
}

async function analyzeImageFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 64, 64);
        const data = ctx.getImageData(0, 0, 64, 64).data;
        const palette = extractDominantHexPalette(data);
        resolve({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          type: "image",
          width: img.naturalWidth || 512,
          height: img.naturalHeight || 512,
          palette,
          previewUrl: reader.result
        });
      };
      img.onerror = () => {
        resolve({
          id: `att_${Date.now()}`,
          name: file.name,
          type: "image",
          palette: ["#00f5d4", "#3b82f6", "#ff2a85", "#1e293b"],
          previewUrl: ""
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function analyzeVideoFile(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;

    const fallback = () => {
      resolve({
        id: `att_${Date.now()}`,
        name: file.name,
        type: "video",
        duration: 1.8,
        palette: ["#00f5d4", "#ff2a85", "#3b82f6"],
        motionFrames: [
          { centerX: 0.45, centerY: 0.52, energy: 0.35 },
          { centerX: 0.58, centerY: 0.38, energy: 0.85 },
          { centerX: 0.36, centerY: 0.32, energy: 0.92 },
          { centerX: 0.52, centerY: 0.25, energy: 0.98 },
          { centerX: 0.48, centerY: 0.62, energy: 0.75 },
          { centerX: 0.5, centerY: 0.5, energy: 0.3 }
        ],
        previewUrl: ""
      });
    };

    const timeout = setTimeout(fallback, 3500);

    video.onloadedmetadata = async () => {
      try {
        const duration = Math.min(6.0, Math.max(1.0, video.duration || 1.8));
        const canvas = document.createElement("canvas");
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext("2d");
        const sampleCount = 6;
        const motionFrames = [];
        let prevData = null;
        let posterUrl = "";
        let palette = ["#00f5d4", "#ff2a85", "#3b82f6"];

        for (let i = 0; i < sampleCount; i++) {
          const sampleTime = (i / Math.max(1, sampleCount - 1)) * Math.min(duration, 3.0);
          video.currentTime = sampleTime;
          await new Promise((r) => {
            video.onseeked = r;
            setTimeout(r, 250);
          });
          ctx.drawImage(video, 0, 0, 48, 48);
          if (i === 1 || i === 0) {
            posterUrl = canvas.toDataURL("image/jpeg", 0.75);
          }
          const imgData = ctx.getImageData(0, 0, 48, 48).data;
          if (i === 0) {
            palette = extractDominantHexPalette(imgData);
          }

          let sumX = 0;
          let sumY = 0;
          let sumWeight = 0;
          let diffSum = 0;

          for (let py = 0; py < 48; py++) {
            for (let px = 0; px < 48; px++) {
              const idx = (py * 48 + px) * 4;
              const lum = (imgData[idx] + imgData[idx + 1] + imgData[idx + 2]) / 3;
              const delta = prevData
                ? Math.abs(imgData[idx] - prevData[idx]) +
                  Math.abs(imgData[idx + 1] - prevData[idx + 1]) +
                  Math.abs(imgData[idx + 2] - prevData[idx + 2])
                : lum;
              const w = delta + 1;
              sumX += (px / 48) * w;
              sumY += (py / 48) * w;
              sumWeight += w;
              diffSum += delta;
            }
          }
          prevData = new Uint8ClampedArray(imgData);
          motionFrames.push({
            centerX: Number((sumX / Math.max(1, sumWeight)).toFixed(3)),
            centerY: Number((sumY / Math.max(1, sumWeight)).toFixed(3)),
            energy: Number(Math.min(1, diffSum / (48 * 48 * 90)).toFixed(3))
          });
        }

        clearTimeout(timeout);
        resolve({
          id: `att_${Date.now()}`,
          name: file.name,
          type: "video",
          duration: Number(duration.toFixed(2)),
          palette,
          motionFrames,
          previewUrl: posterUrl
        });
      } catch {
        clearTimeout(timeout);
        fallback();
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      fallback();
    };
  });
}

function extractDominantHexPalette(rgbaData) {
  const buckets = new Map();
  for (let i = 0; i < rgbaData.length; i += 16) {
    const r = rgbaData[i];
    const g = rgbaData[i + 1];
    const b = rgbaData[i + 2];
    const a = rgbaData[i + 3];
    if (a < 128) continue;
    // Quantize to 32-step buckets
    const qr = Math.min(255, Math.round(r / 32) * 32);
    const qg = Math.min(255, Math.round(g / 32) * 32);
    const qb = Math.min(255, Math.round(b / 32) * 32);
    const key = `${qr},${qg},${qb}`;
    const saturation = Math.max(qr, qg, qb) - Math.min(qr, qg, qb);
    buckets.set(key, (buckets.get(key) || 0) + 1 + saturation * 0.05);
  }

  const sorted = Array.from(buckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([key]) => {
      const [r, g, b] = key.split(",").map(Number);
      return (
        "#" +
        [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")
      );
    });

  while (sorted.length < 4) {
    sorted.push(["#00f5d4", "#ff2a85", "#3b82f6", "#1e293b"][sorted.length]);
  }
  return sorted;
}

export function createDemoPhotoAttachment() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");

  // Draw a sleek Neon Cyberpunk Katana / Mech concept card
  ctx.fillStyle = "#121624";
  ctx.fillRect(0, 0, 96, 96);
  ctx.strokeStyle = "#00f5d4";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(18, 78);
  ctx.lineTo(78, 18);
  ctx.stroke();

  ctx.fillStyle = "#ff2a85";
  ctx.fillRect(24, 62, 18, 18);
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(48, 22, 26, 8);

  return {
    id: `att_photo_${Date.now()}`,
    name: "neon_cyber_reference.png",
    type: "image",
    width: 1024,
    height: 1024,
    palette: ["#121624", "#e2e8f0", "#00f5d4", "#ff2a85"],
    previewUrl: canvas.toDataURL("image/png")
  };
}

export function createDemoVideoAttachment() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, 96, 96);
  // Draw motion arc & stick figure silhouette
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(48, 48, 30, 0.2, Math.PI * 1.4);
  ctx.stroke();
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(48, 28, 9, 0, Math.PI * 2);
  ctx.fill();

  return {
    id: `att_video_${Date.now()}`,
    name: "martial_arts_spin_kick.mp4",
    type: "video",
    duration: 1.65,
    palette: ["#38bdf8", "#f97316", "#0f172a", "#a855f7"],
    motionFrames: [
      { centerX: 0.48, centerY: 0.56, energy: 0.35 },
      { centerX: 0.64, centerY: 0.42, energy: 0.78 },
      { centerX: 0.52, centerY: 0.22, energy: 0.96 },
      { centerX: 0.32, centerY: 0.34, energy: 0.88 },
      { centerX: 0.46, centerY: 0.68, energy: 0.72 },
      { centerX: 0.5, centerY: 0.52, energy: 0.28 }
    ],
    previewUrl: canvas.toDataURL("image/png")
  };
}
