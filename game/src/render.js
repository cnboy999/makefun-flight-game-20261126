// Skyline Courier — the renderer: sky, valley, rings, aeroplane and HUD.
//
// The valley is drawn as strips of ground, far rows first, each row a band of
// terrain projected through the chase camera. The aeroplane is drawn in screen
// space, banked with the turn, and the HUD is drawn flat on top so it reads
// at a glance even when the screenshot is shrunk.

import { COLORS, RING, FUEL, MISSIONS } from './config.js';
import { terrainHeight, isWater, isRunway, isDepartureRunway, valleyCentre } from './terrain.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

const ROWS = 56;
const SAMPLES = 40;
const FAR = 1500;
const NEAR = 8;

/** Mix two rgb colours by t (0 = a, 1 = b). */
function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const RGB = {
  grassLow: hexToRgb(COLORS.grassLow),
  grassHigh: hexToRgb(COLORS.grassHigh),
  rock: hexToRgb(COLORS.rock),
  snow: hexToRgb(COLORS.snow),
  water: hexToRgb(COLORS.water),
  runway: hexToRgb(COLORS.runway),
  horizon: hexToRgb(COLORS.horizon),
  skyTop: hexToRgb(COLORS.skyTop),
};

/** Ground colour for a height, before fog: grass, rock, then snow. */
function groundColor(h) {
  if (h < 70) return RGB.grassLow;
  if (h < 130) return mix(RGB.grassLow, RGB.grassHigh, (h - 70) / 60);
  if (h < 185) return mix(RGB.grassHigh, RGB.rock, (h - 130) / 55);
  if (h < 215) return RGB.rock;
  return mix(RGB.rock, RGB.snow, Math.min(1, (h - 215) / 25));
}

function css(rgb, alpha = 1) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/** Build the renderer for a canvas. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  /** Project a world point through the chase camera. Returns null behind it. */
  function project(cam, wx, wz, h, focal, horizonY) {
    const dx = wx - cam.x;
    const dz = wz - cam.z;
    const fwd = dx * Math.sin(cam.heading) + dz * Math.cos(cam.heading);
    if (fwd < 6) return null;
    const lat = dx * Math.cos(cam.heading) - dz * Math.sin(cam.heading);
    return {
      x: width / 2 + (lat * focal) / fwd,
      y: horizonY + ((cam.alt - h) * focal) / fwd,
      fwd,
      scale: focal / fwd,
    };
  }

  function drawSky(time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height * 0.55);
    gradient.addColorStop(0, COLORS.skyTop);
    gradient.addColorStop(0.55, COLORS.skyMid);
    gradient.addColorStop(1, COLORS.horizon);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height * 0.55);
    // The sun, low and warm, upper right.
    const sunX = width * 0.78;
    const sunY = height * 0.13;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
    glow.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 211, 130, 0.55)');
    glow.addColorStop(1, 'rgba(255, 211, 130, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
    ctx.fillStyle = COLORS.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    void time;
  }

  function drawClouds(cam, focal, horizonY) {
    ctx.fillStyle = COLORS.cloud;
    for (const cloud of cam.clouds) {
      const p = project(cam, cloud.x, cloud.z, cloud.alt, focal, horizonY);
      if (!p || p.fwd > 2200) continue;
      const r = cloud.size * p.scale * 0.5;
      if (r < 2) continue;
      ctx.globalAlpha = Math.min(0.8, 320 / p.fwd + 0.25);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.32, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - r * 0.7, p.y + r * 0.08, r * 0.6, r * 0.24, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + r * 0.7, p.y + r * 0.08, r * 0.6, r * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTerrain(cam, seed, focal, horizonY) {
    // Rows from far to near; each row's screen band is filled between it and
    // the row in front, so the ground is continuous with no gaps.
    const depths = [];
    for (let k = 0; k < ROWS; k += 1) {
      depths.push(NEAR * Math.pow(FAR / NEAR, k / (ROWS - 1)));
    }
    let prevRow = null;
    for (let k = ROWS - 1; k >= 0; k -= 1) {
      const fwd = depths[k];
      const spread = fwd * 0.95 + 60;
      const row = [];
      for (let s = 0; s <= SAMPLES; s += 1) {
        const lat = -spread + (2 * spread * s) / SAMPLES;
        const wx = cam.x + lat * Math.cos(cam.heading) + fwd * Math.sin(cam.heading);
        const wz = cam.z - lat * Math.sin(cam.heading) + fwd * Math.cos(cam.heading);
        const h = terrainHeight(wx, wz, seed);
        const p = project(cam, wx, wz, h, focal, horizonY);
        row.push({ p, h, wx, wz });
      }
      if (prevRow) {
        for (let s = 0; s < SAMPLES; s += 1) {
          const a = row[s];
          const b = row[s + 1];
          const c = prevRow[s + 1];
          const d = prevRow[s];
          if (!a.p || !b.p || !c.p || !d.p) continue;
          const hMid = (a.h + b.h + c.h + d.h) / 4;
          const fwdMid = (a.p.fwd + c.p.fwd) / 2;
          let rgb;
          if (
            isRunway(a.wx, a.wz) ||
            isRunway(b.wx, b.wz) ||
            isDepartureRunway(a.wx, a.wz) ||
            isDepartureRunway(b.wx, b.wz)
          ) {
            rgb = RGB.runway;
          } else if (isWater(a.wx, a.wz, seed)) {
            rgb = RGB.water;
          } else {
            rgb = groundColor(hMid);
          }
          // Slope shading: a hillside facing the sun reads lighter.
          const slope = (terrainHeight(a.wx + 9, a.wz, seed) - hMid) / 9;
          const shade = Math.max(-0.18, Math.min(0.18, -slope * 0.35));
          const fog = Math.pow(Math.min(1, fwdMid / FAR), 1.2) * 0.72;
          const lit = mix(rgb, RGB.horizon, fog).map((v) => Math.max(0, Math.min(255, v + shade * 255)));
          ctx.fillStyle = css(lit);
          ctx.beginPath();
          ctx.moveTo(a.p.x, a.p.y);
          ctx.lineTo(b.p.x, b.p.y);
          ctx.lineTo(c.p.x, c.p.y);
          ctx.lineTo(d.p.x, d.p.y);
          ctx.closePath();
          ctx.fill();
          // Runway paint: centre dashes and edge lines.
          if (rgb === RGB.runway) {
            const midX = (a.p.x + b.p.x) / 2;
            if (Math.abs(a.wx) < 1.6 && Math.floor(a.wz / 26) % 2 === 0) {
              ctx.fillStyle = 'rgba(242, 240, 230, 0.9)';
              ctx.fillRect(midX - 1.5, Math.min(a.p.y, c.p.y), 3, Math.abs(c.p.y - a.p.y) + 1);
            }
          }
        }
      }
      prevRow = row;
    }
  }

  function drawRings(cam, world, focal, horizonY) {
    for (let index = 0; index < world.course.length; index += 1) {
      const ring = world.course[index];
      const p = project(cam, ring.x, ring.z, ring.alt, focal, horizonY);
      if (!p || p.fwd > RING.drawDistance) continue;
      const passed = index < world.ringIndex;
      const radius = ring.radius * p.scale;
      if (radius < 1.5) continue;
      const isNext = index === world.ringIndex;
      const color =
        ring.kind === 'refuel' ? COLORS.refuel : ring.kind === 'guide' ? '#7ec8e3' : COLORS.ring;
      ctx.save();
      ctx.globalAlpha = passed ? 0.35 : isNext ? 1 : 0.75;
      ctx.strokeStyle = passed ? COLORS.ringPassed : color;
      ctx.lineWidth = Math.max(2, radius * 0.16);
      ctx.shadowColor = passed ? COLORS.ringPassed : color;
      ctx.shadowBlur = isNext ? 22 : 10;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, radius, radius * 0.94, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(1, radius * 0.05);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, radius * 0.86, radius * 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (isNext) {
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${Math.max(11, Math.min(17, radius * 0.32))}px "Trebuchet MS", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`RING ${index + 1}`, p.x, p.y - radius - 8);
      }
      ctx.restore();
    }
  }

  function drawPlaneShadow(cam, world, focal, horizonY) {
    const plane = world.plane;
    const ground = terrainHeight(plane.x, plane.z, world.seed);
    const p = project(cam, plane.x, plane.z, ground + 1, focal, horizonY);
    if (!p) return;
    // The shadow sits under the aeroplane on screen; its size shrinks as the
    // aeroplane climbs, and it fades out entirely high above the ground.
    const above = Math.max(0, plane.alt - ground);
    const size = Math.max(0.3, 1.1 - above / 160);
    ctx.fillStyle = `rgba(10, 16, 28, ${Math.max(0.04, 0.28 * size)})`;
    ctx.beginPath();
    ctx.ellipse(Math.max(20, Math.min(width - 20, p.x)), Math.min(height - 8, p.y), 52 * size, 11 * size, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlane(world, time) {
    const plane = world.plane;
    const cx = width / 2;
    const cy = height * 0.72;
    const scale = Math.min(1.15, Math.max(0.8, width / 1280));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(plane.bank * 0.9);
    ctx.scale(scale, scale * (1 - Math.abs(plane.bank) * 0.12));
    // Propeller blur, spinning with throttle.
    const propAngle = time * (6 + plane.throttle * 30);
    ctx.strokeStyle = 'rgba(30, 40, 60, 0.35)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, -46, 5, 26, propAngle % Math.PI, 0, Math.PI * 2);
    ctx.stroke();
    // Wings: white with orange tips.
    ctx.fillStyle = COLORS.planeWhite;
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.lineTo(-84, 10);
    ctx.lineTo(-78, 20);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -8);
    ctx.lineTo(84, 10);
    ctx.lineTo(78, 20);
    ctx.lineTo(12, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.planeOrange;
    ctx.fillRect(-84, 8, 12, 11);
    ctx.fillRect(72, 8, 12, 11);
    // Tail: stabiliser and fin.
    ctx.fillStyle = COLORS.planeTeal;
    ctx.beginPath();
    ctx.moveTo(-10, 30);
    ctx.lineTo(-34, 40);
    ctx.lineTo(-30, 46);
    ctx.lineTo(-8, 40);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, 30);
    ctx.lineTo(34, 40);
    ctx.lineTo(30, 46);
    ctx.lineTo(8, 40);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, 26);
    ctx.lineTo(-8, 2);
    ctx.lineTo(2, 12);
    ctx.lineTo(6, 30);
    ctx.closePath();
    ctx.fill();
    // Fuselage: orange nose to teal tail, with a white stripe.
    const body = ctx.createLinearGradient(0, -56, 0, 44);
    body.addColorStop(0, COLORS.planeOrange);
    body.addColorStop(0.6, '#e8703a');
    body.addColorStop(1, COLORS.planeTeal);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -56);
    ctx.quadraticCurveTo(13, -30, 12, 6);
    ctx.quadraticCurveTo(11, 32, 0, 44);
    ctx.quadraticCurveTo(-11, 32, -12, 6);
    ctx.quadraticCurveTo(-13, -30, 0, -56);
    ctx.fill();
    ctx.fillStyle = COLORS.planeWhite;
    ctx.fillRect(-11, -2, 22, 7);
    // Canopy: lit glass.
    ctx.fillStyle = '#bfe6f2';
    ctx.beginPath();
    ctx.ellipse(0, -30, 7, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(-2, -34, 2.5, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Navigation lights: red left, green right.
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-84, 14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#30d158';
    ctx.beginPath();
    ctx.arc(84, 14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHud(world) {
    const plane = world.plane;
    const altFt = Math.round(plane.alt * 3.28084);
    const speedKt = Math.round(plane.speed * 1.94384);
    const headingDeg = Math.round(((plane.heading * 180) / Math.PI % 360 + 360) % 360);
    const mission = MISSIONS[world.mission];
    const missionRings = world.course.filter((item) => item.mission === world.mission).length;
    const doneInMission = world.course
      .slice(0, world.ringIndex)
      .filter((item) => item.mission === world.mission).length;

    // Top bar.
    ctx.fillStyle = COLORS.hudPanel;
    ctx.fillRect(0, 0, width, 48);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '700 17px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`ALT ${altFt.toLocaleString()} FT`, 16, 25);
    ctx.fillText(`SPD ${speedKt} KT`, 190, 25);
    ctx.fillText(`HDG ${String(headingDeg).padStart(3, '0')}°`, 320, 25);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.hudAmber;
    ctx.fillText(`${mission.name}  •  RING ${Math.min(doneInMission + 1, missionRings)}/${missionRings}`, width / 2, 25);
    ctx.textAlign = 'right';
    ctx.fillStyle = plane.fuel < FUEL.lowLevel ? COLORS.hudRed : COLORS.hudText;
    ctx.fillText(`SCORE ${world.score.toLocaleString()}`, width - 16, 25);
    // Fuel bar under the score.
    const fuelW = 150;
    const fuelX = width - 16 - fuelW;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(fuelX, 34, fuelW, 7);
    ctx.fillStyle = plane.fuel < FUEL.lowLevel ? COLORS.hudRed : COLORS.hudGreen;
    ctx.fillRect(fuelX, 34, fuelW * (plane.fuel / FUEL.capacity), 7);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '600 11px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillText('FUEL', fuelX - 8, 38);
    ctx.textAlign = 'left';

    // Next-ring pointer: distance and which way to turn.
    const ring = world.ringIndex < world.course.length ? world.course[world.ringIndex] : null;
    if (ring && !world.over) {
      const dx = ring.x - plane.x;
      const dz = ring.z - plane.z;
      const dist = Math.round(Math.sqrt(dx * dx + dz * dz));
      const bearing = Math.atan2(dx, dz);
      let rel = bearing - plane.heading;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      const arrow = rel > 0.25 ? '▶' : rel < -0.25 ? '◀' : '▲';
      ctx.fillStyle = COLORS.hudPanel;
      ctx.beginPath();
      ctx.roundRect(width / 2 - 92, 58, 184, 30, 8);
      ctx.fill();
      ctx.fillStyle = ring.kind === 'refuel' ? COLORS.refuel : COLORS.hudAmber;
      ctx.font = '700 15px "Trebuchet MS", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${arrow}  NEXT RING ${dist}m`, width / 2, 74);
      ctx.textAlign = 'left';
    }

    // Artificial horizon, bottom left: the world tilts, the marker stays.
    const ahX = 74;
    const ahY = height - 74;
    const ahR = 44;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ahX, ahY, ahR, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(ahX, ahY);
    ctx.rotate(-plane.bank);
    ctx.translate(0, plane.pitch * 90);
    ctx.fillStyle = '#7fb2e0';
    ctx.fillRect(-ahR, -ahR * 2, ahR * 2, ahR * 2);
    ctx.fillStyle = '#6b7c5e';
    ctx.fillRect(-ahR, 0, ahR * 2, ahR * 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-ahR, -1.5, ahR * 2, 3);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ahX, ahY, ahR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.hudAmber;
    ctx.beginPath();
    ctx.moveTo(ahX, ahY - 4);
    ctx.lineTo(ahX - 14, ahY + 6);
    ctx.lineTo(ahX + 14, ahY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '600 11px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', ahX, ahY + ahR + 14);
    ctx.textAlign = 'left';

    // Throttle gauge, bottom right.
    const thX = width - 74;
    const thY = height - 74;
    ctx.fillStyle = COLORS.hudPanel;
    ctx.beginPath();
    ctx.roundRect(thX - 16, thY - 46, 32, 92, 8);
    ctx.fill();
    const thH = 76 * plane.throttle;
    ctx.fillStyle = plane.throttle > 0.75 ? COLORS.hudAmber : COLORS.hudGreen;
    ctx.fillRect(thX - 10, thY + 38 - thH, 20, thH);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '600 11px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THR', thX, thY + 62);
    ctx.textAlign = 'left';

    // Toasts, centre, newest last.
    ctx.textAlign = 'center';
    world.toasts.forEach((item, index) => {
      const alpha = Math.max(0, 1 - item.age / 3.5);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.hudPanel;
      const y = 104 + index * 34;
      const w = ctx.measureText(item.text).width + 28;
      ctx.beginPath();
      ctx.roundRect(width / 2 - w / 2, y, w, 28, 8);
      ctx.fill();
      ctx.fillStyle = COLORS.hudText;
      ctx.font = '700 15px "Trebuchet MS", system-ui, sans-serif';
      ctx.fillText(item.text, width / 2, y + 15);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    // Speed streaks at high speed: faint, few, and only near the edges.
    if (plane.speed > 85 && !world.over) {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i += 1) {
        const y = ((i * 137 + Math.floor(performance.now() / 90) * 53) % (height - 120)) + 60;
        const x = (i % 2 === 0 ? 12 : width - 62) + (i % 3) * 12;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 34 + plane.speed * 0.25);
        ctx.stroke();
      }
    }
  }

  function panel(lines, title) {
    const panelW = Math.min(680, width - 48);
    const panelH = 92 + lines.length * 30;
    const x = (width - panelW) / 2;
    const y = (height - panelH) / 2;
    ctx.fillStyle = 'rgba(10, 18, 34, 0.78)';
    ctx.beginPath();
    ctx.roundRect(x, y, panelW, panelH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 183, 3, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = COLORS.hudAmber;
    ctx.font = '800 34px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, y + 52);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '600 16px "Trebuchet MS", system-ui, sans-serif';
    lines.forEach((line, index) => {
      ctx.fillText(line, width / 2, y + 92 + index * 30);
    });
    ctx.textAlign = 'left';
  }

  function drawTitle(world, best) {
    ctx.fillStyle = 'rgba(10, 18, 34, 0.45)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.hudAmber;
    ctx.font = '800 64px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillText('SKYLINE COURIER', width / 2, height * 0.3);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '600 20px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillText('Fly the valley. Thread the rings. Put her down on the strip.', width / 2, height * 0.3 + 40);
    ctx.font = '600 16px "Trebuchet MS", system-ui, sans-serif';
    const lines = [
      '↑ / ↓  climb and descend      ← / →  bank and turn      W / S  throttle',
      'Mouse: drag to steer      SPACE  fly      P  pause      M  sound',
      'Amber rings score  •  green rings refuel  •  land slow, level and straight',
    ];
    lines.forEach((line, index) => {
      ctx.fillText(line, width / 2, height * 0.3 + 92 + index * 28);
    });
    ctx.fillStyle = COLORS.hudAmber;
    ctx.font = '800 22px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillText('PRESS SPACE OR CLICK TO FLY', width / 2, height * 0.3 + 196);
    if (best > 0) {
      ctx.fillStyle = COLORS.hudText;
      ctx.font = '600 16px "Trebuchet MS", system-ui, sans-serif';
      ctx.fillText(`BEST SCORE ${best.toLocaleString()}`, width / 2, height * 0.3 + 228);
    }
    ctx.textAlign = 'left';
  }

  /** Paint one frame: state, screen and best score. */
  function draw(world, screen, best, time) {
    const plane = world.plane;
    const focal = height * 1.05;
    const horizonY = height * 0.42 + plane.pitch * focal * 0.55;
    const cam = {
      x: plane.x - Math.sin(plane.heading) * 14,
      z: plane.z - Math.cos(plane.heading) * 14,
      alt: plane.alt + 5,
      heading: plane.heading,
      clouds: world.clouds,
    };
    drawSky(time);
    ctx.save();
    // The camera rolls with the bank, gently, around the screen centre.
    ctx.translate(width / 2, horizonY);
    ctx.rotate(plane.bank * 0.28);
    ctx.translate(-width / 2, -horizonY);
    drawClouds(cam, focal, horizonY);
    drawTerrain(cam, world.seed, focal, horizonY);
    drawRings(cam, world, focal, horizonY);
    drawPlaneShadow(cam, world, focal, horizonY);
    ctx.restore();
    drawPlane(world, time);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(world);
    if (screen === SCREEN_TITLE) {
      drawHud(world);
      drawTitle(world, best);
    } else if (screen === SCREEN_PAUSED) {
      panel(['The valley waits. Press P or click to keep flying.'], 'PAUSED');
    } else if (screen === SCREEN_OVER) {
      panel(
        [
          `SCORE ${world.score.toLocaleString()}   •   BEST ${Math.max(best, world.score).toLocaleString()}`,
          `Rings flown ${world.ringsHit}  •  missed ${world.ringsMissed}`,
          'SPACE — FLY AGAIN',
        ],
        `CRASHED — ${world.crashReason}`,
      );
    } else if (screen === SCREEN_COMPLETE) {
      panel(
        [
          `Rings flown ${world.ringsHit}  •  missed ${world.ringsMissed}`,
          `Landing bonus included  •  fuel left ${Math.round(world.plane.fuel)}`,
          `TOTAL SCORE ${world.score.toLocaleString()}`,
          'SPACE — FLY AGAIN',
        ],
        'ROUTE COMPLETE!',
      );
    }
  }

  return { draw, resize };
}
