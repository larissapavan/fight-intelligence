import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { L } from '../../i18n/lang'

const WIDTH = 540
const HEIGHT = 176
const GROUND = 132
const FENCE_TOP = 28
const POST_LEFT = 44
const POST_RIGHT = WIDTH - 44

type Phase = 'idle' | 'windup' | 'strike'
type Strike = 'punch' | 'kick'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

type Popup = {
  x: number
  y: number
  text: string
  color: string
  life: number
}

type Bout = {
  score: number
  hiScore: number
  streak: number
  playerArm: number
  playerKick: number
  enemyArm: number
  enemyKick: number
  playerRecoil: number
  enemyRecoil: number
  phase: Phase
  attack: Strike
  timer: number
  phaseTotal: number
  flash: number
  shake: number
  frame: number
  playerHold: number
  particles: Particle[]
  popups: Popup[]
}

type BoutLabels = {
  punch: string
  kick: string
  counter: string
  miss: string
  you: string
  cpu: string
}

const HI_SCORE_KEY = 'ufc-predictor:bout-hi-score'

function readHiScore(): number {
  try {
    const val = Number(window.sessionStorage.getItem(HI_SCORE_KEY) || '0')
    return Number.isFinite(val) && val > 0 ? val : 0
  } catch {
    return 0
  }
}

function saveHiScore(score: number) {
  try {
    window.sessionStorage.setItem(HI_SCORE_KEY, String(score))
  } catch {
    // ignore storage errors
  }
}

function tone(hex: string, amount: number) {
  const value = hex.replace('#', '')
  const channel = (start: number) =>
    Math.max(0, Math.min(255, Math.round(parseInt(value.slice(start, start + 2), 16) * amount)))
  return `rgb(${channel(0)} ${channel(2)} ${channel(4)})`
}

function spawnImpact(bout: Bout, x: number, y: number, color: string, count = 12) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45
    const speed = 1.6 + Math.random() * 3.2
    const maxLife = 12 + Math.floor(Math.random() * 8)
    bout.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.6,
      life: maxLife,
      maxLife,
      color: i % 3 === 0 ? '#FFFFFF' : color,
      size: 1.8 + Math.random() * 1.8,
    })
  }
}

function spawnPopup(bout: Bout, x: number, y: number, text: string, color: string) {
  bout.popups.push({ x, y, text, color, life: 22 })
}

function limb(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, width: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y)
  ctx.stroke()
}

function drawGlove(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  color: string,
  glow = false,
) {
  if (glow) {
    ctx.save()
    ctx.fillStyle = '#F2C230'
    ctx.globalAlpha = 0.38
    ctx.beginPath()
    ctx.arc(x + facing * 1.5, y, 7.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  // Wrist tape
  ctx.fillStyle = '#EDE6D6'
  ctx.beginPath()
  ctx.ellipse(x - facing * 2.2, y + 0.3, 2.2, 2.8, 0, 0, Math.PI * 2)
  ctx.fill()
  // 4oz MMA glove body
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(x + facing * 1.4, y, 4.8, 3.6, facing * 0.25, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#0E0E0E'
  ctx.lineWidth = 1
  ctx.stroke()
  // Knuckle highlight
  ctx.fillStyle = 'rgba(255,255,255,0.42)'
  ctx.fillRect(x + facing * 0.4, y - 1.7, 2.8, 1.2)
}

function drawFighter(
  ctx: CanvasRenderingContext2D,
  x: number,
  bob: number,
  facing: number,
  accent: string,
  skin: string,
  arm: number,
  kick: number,
  recoil: number,
  telegraph: Strike | null,
) {
  const body = x - recoil * facing
  const footY = GROUND + bob * 0.6
  const hipY = footY - 31
  const shoulderY = hipY - 22
  const reach = Math.max(-10, Math.min(32, arm))
  const chamber = kick < 0 ? Math.min(1, -kick / 16) : 0
  const snap = kick > 0 ? Math.min(1, kick / 30) : 0
  const punch = Math.max(0, reach) / 28

  let hipX = body
  let shoulderX = body + facing * 2
  shoulderX += facing * punch * 6
  if (reach < 0) shoulderX += facing * reach * 0.42
  shoulderX -= facing * (snap * 6.5 + chamber * 2.5)
  hipX += facing * snap * 4.5
  const shadowSkin = tone(skin, 0.74)

  // Floor shadow
  ctx.save()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.beginPath()
  ctx.ellipse(hipX, GROUND + 3.5, 18, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Strike motion arc when punching or kicking
  if (punch > 0.35) {
    ctx.save()
    ctx.strokeStyle = accent
    ctx.globalAlpha = 0.55 * punch
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(shoulderX + facing * 12, shoulderY - 3)
    ctx.lineTo(shoulderX + facing * (16 + reach * 1.15), shoulderY - 6)
    ctx.stroke()
    ctx.restore()
  }
  if (snap > 0.35) {
    ctx.save()
    ctx.strokeStyle = '#F2C230'
    ctx.globalAlpha = 0.6 * snap
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(hipX + facing * 10, hipY - 6, 26, facing > 0 ? -0.65 : Math.PI - 0.35, facing > 0 ? 0.35 : Math.PI + 0.65)
    ctx.stroke()
    ctx.restore()
  }

  // Rear leg
  const posting = chamber > 0 || snap > 0
  const rearHip: [number, number] = [hipX - facing * 2.5, hipY]
  const rearKnee: [number, number] = posting
    ? [hipX - facing * 1.5, hipY + 15]
    : [hipX - facing * 9.5, hipY + 15]
  const rearAnkle: [number, number] = posting
    ? [hipX - facing * 1.5, footY - 2]
    : [hipX - facing * 12, footY - 2]
  limb(ctx, [rearHip, rearKnee], 6, '#0E0E0E')
  limb(ctx, [rearHip, rearKnee], 4.4, shadowSkin)
  limb(ctx, [rearKnee, rearAnkle], 5, '#0E0E0E')
  limb(ctx, [rearKnee, rearAnkle], 3.5, shadowSkin)
  // Ankle tape
  limb(ctx, [rearAnkle, [rearAnkle[0], rearAnkle[1] - 3]], 3.6, '#EDE6D6')
  limb(ctx, [rearAnkle, [rearAnkle[0] + facing * (posting ? 4.5 : -4.5), footY]], 3, shadowSkin)

  // Lead leg
  const leadHip: [number, number] = [hipX + facing * 2.5, hipY + snap * 1.5]
  const leadKnee: [number, number] =
    chamber > 0
      ? [hipX + facing * (6 + chamber * 4), hipY - 7 - chamber * 16]
      : snap > 0
        ? [hipX + facing * (8 + snap * 9), hipY - 13 - snap * 2]
        : [hipX + facing * 9.5, hipY + 14]
  const leadAnkle: [number, number] =
    chamber > 0
      ? [leadKnee[0] - facing * 1.5, leadKnee[1] + 11]
      : snap > 0
        ? [hipX + facing * (14 + snap * 26), hipY - 15 - snap * 3]
        : [hipX + facing * 12.5, footY - 2]
  const toe: [number, number] =
    chamber > 0
      ? [leadAnkle[0] + facing * 1.5, leadAnkle[1] + 4.5]
      : snap > 0
        ? [leadAnkle[0] + facing * 3, leadAnkle[1] - 4.5]
        : [leadAnkle[0] + facing * 5, footY]

  if (telegraph === 'kick') {
    ctx.save()
    ctx.fillStyle = '#F2C230'
    ctx.globalAlpha = 0.35
    ctx.beginPath()
    ctx.arc(leadAnkle[0], leadAnkle[1], 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  limb(ctx, [leadHip, leadKnee], 6.2, '#0E0E0E')
  limb(ctx, [leadHip, leadKnee], 4.6, skin)
  limb(ctx, [leadKnee, leadAnkle], 5.2, '#0E0E0E')
  limb(ctx, [leadKnee, leadAnkle], 3.7, skin)
  limb(ctx, [leadAnkle, [leadAnkle[0] - facing * 1, leadAnkle[1] - 2.5]], 3.8, '#EDE6D6')
  limb(ctx, [leadAnkle, toe], 3, skin)

  // Athletic Torso
  ctx.fillStyle = skin
  ctx.strokeStyle = '#0E0E0E'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(shoulderX - facing * 8, shoulderY + 1)
  ctx.lineTo(shoulderX + facing * 7.5, shoulderY + 1.5)
  ctx.lineTo(hipX + facing * 6, hipY + 1)
  ctx.lineTo(hipX - facing * 6.5, hipY + 1.5)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Chest / core definition
  ctx.fillStyle = shadowSkin
  ctx.globalAlpha = 0.32
  ctx.beginPath()
  ctx.ellipse(shoulderX + facing * 2.2, shoulderY + 7.5, 3.4, 3.8, facing * 0.12, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // MMA Fight Shorts
  ctx.fillStyle = accent
  ctx.strokeStyle = '#0E0E0E'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(hipX - 8, hipY - 1)
  ctx.lineTo(hipX + 8, hipY - 1)
  ctx.lineTo(hipX + facing * 7.5 + 3, hipY + 11.5)
  ctx.lineTo(hipX + facing * 1, hipY + 9.5)
  ctx.lineTo(hipX - facing * 1, hipY + 12)
  ctx.lineTo(hipX - facing * 8, hipY + 10.5)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Waistband with gold/white championship trim
  ctx.fillStyle = '#0E0E0E'
  ctx.fillRect(hipX - 8, hipY - 3.2, 16, 2.8)
  ctx.fillStyle = '#F2C230'
  ctx.fillRect(hipX - 3.5, hipY - 2.8, 7, 1.8)

  // Head & Neck
  const headX = shoulderX + facing * 2.8 + (recoil > 2 ? -facing * 2 : 0)
  const headY = shoulderY - 10.5 + bob * 0.35
  limb(ctx, [[shoulderX, shoulderY], [headX, headY + 5.5]], 4.6, skin)

  // Head outline + hair
  ctx.fillStyle = '#18120E'
  ctx.beginPath()
  ctx.ellipse(headX - facing * 0.5, headY - 1.5, 7.6, 8, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = skin
  ctx.strokeStyle = '#0E0E0E'
  ctx.lineWidth = 1.1
  ctx.beginPath()
  ctx.ellipse(headX + facing * 0.8, headY + 1.4, 6.8, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Hairline / fade cut
  ctx.fillStyle = '#18120E'
  ctx.beginPath()
  ctx.ellipse(headX - facing * 1.2, headY - 3.4, 6.6, 3.6, -facing * 0.18, 0, Math.PI * 2)
  ctx.fill()

  // Ear
  ctx.fillStyle = tone(skin, 0.86)
  ctx.beginPath()
  ctx.ellipse(headX - facing * 5.2, headY + 1.8, 1.9, 2.8, 0, 0, Math.PI * 2)
  ctx.fill()

  // Brow & focused eye
  ctx.strokeStyle = '#18120E'
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.moveTo(headX + facing * 1.4, headY - 1.5)
  ctx.lineTo(headX + facing * 5.4, headY - 0.8)
  ctx.stroke()
  ctx.fillStyle = '#0E0E0E'
  ctx.beginPath()
  ctx.arc(headX + facing * 3.4, headY + 0.6, 1.1, 0, Math.PI * 2)
  ctx.fill()

  // Rear Guard Arm
  const rearShoulder: [number, number] = [shoulderX - facing * 5.5, shoulderY + 2]
  const rearElbow: [number, number] = [rearShoulder[0] - facing * 1.5, shoulderY + 11.5]
  const rearFist: [number, number] = [headX + facing * 2.5, headY + 6.5]
  limb(ctx, [rearShoulder, rearElbow, rearFist], 5, '#0E0E0E')
  limb(ctx, [rearShoulder, rearElbow, rearFist], 3.5, shadowSkin)
  drawGlove(ctx, rearFist[0], rearFist[1], facing, accent, false)

  // Lead Striking Arm
  const leadShoulder: [number, number] = [shoulderX + facing * (5.5 + punch * 4), shoulderY + 2.5 - punch * 2]
  const cheekX = headX + facing * 3.5
  const cheekY = headY + 3.5
  const fistX = cheekX + facing * reach * 1.12
  const fistY = cheekY - Math.max(0, reach) * 0.22
  const extend = Math.max(0, reach) / 28
  const elbowX = leadShoulder[0] + (fistX - leadShoulder[0]) * (0.42 + extend * 0.22)
  const elbowY = leadShoulder[1] + 10.5 * (1 - extend) + (fistY - leadShoulder[1]) * extend * 0.2
  limb(ctx, [leadShoulder, [elbowX, elbowY], [fistX, fistY]], 5.2, '#0E0E0E')
  limb(ctx, [leadShoulder, [elbowX, elbowY], [fistX, fistY]], 3.7, skin)
  drawGlove(ctx, fistX, fistY, facing, accent, telegraph === 'punch')
}

function drawOctagonStage(ctx: CanvasRenderingContext2D, frame: number) {
  // Deep broadcast arena background
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  bg.addColorStop(0, '#0B0B0D')
  bg.addColorStop(0.68, '#141418')
  bg.addColorStop(1, '#0E0E10')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Subtle corner spotlights (Red left, Blue right)
  const redSpot = ctx.createRadialGradient(130, 10, 8, 150, 90, 170)
  redSpot.addColorStop(0, 'rgba(200, 16, 46, 0.22)')
  redSpot.addColorStop(1, 'rgba(200, 16, 46, 0)')
  ctx.fillStyle = redSpot
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const blueSpot = ctx.createRadialGradient(WIDTH - 130, 10, 8, WIDTH - 150, 90, 170)
  blueSpot.addColorStop(0, 'rgba(31, 78, 156, 0.24)')
  blueSpot.addColorStop(1, 'rgba(31, 78, 156, 0)')
  ctx.fillStyle = blueSpot
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Octagon chain-link diamond mesh between posts
  ctx.save()
  ctx.beginPath()
  ctx.rect(POST_LEFT + 8, FENCE_TOP + 5, POST_RIGHT - POST_LEFT - 16, GROUND - FENCE_TOP - 9)
  ctx.clip()

  ctx.strokeStyle = 'rgba(230, 223, 208, 0.13)'
  ctx.lineWidth = 1
  const step = 11
  for (let x = POST_LEFT - HEIGHT; x < POST_RIGHT + HEIGHT; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, FENCE_TOP)
    ctx.lineTo(x + (GROUND - FENCE_TOP), GROUND)
    ctx.moveTo(x + (GROUND - FENCE_TOP), FENCE_TOP)
    ctx.lineTo(x, GROUND)
    ctx.stroke()
  }
  ctx.restore()

  // Intermediate octagon panel posts
  const midPostLeft = POST_LEFT + 118
  const midPostRight = POST_RIGHT - 118
  ctx.fillStyle = '#1F1F24'
  ctx.fillRect(midPostLeft - 3, FENCE_TOP + 4, 6, GROUND - FENCE_TOP - 8)
  ctx.fillRect(midPostRight - 3, FENCE_TOP + 4, 6, GROUND - FENCE_TOP - 8)

  // Outer Octagon corner posts (Red & Blue bumpers)
  ctx.fillStyle = '#C8102E'
  ctx.fillRect(POST_LEFT, FENCE_TOP, 8, GROUND - FENCE_TOP)
  ctx.fillStyle = '#1F4E9C'
  ctx.fillRect(POST_RIGHT - 8, FENCE_TOP, 8, GROUND - FENCE_TOP)

  // Top & bottom padded cage rails
  ctx.fillStyle = '#25252B'
  ctx.fillRect(POST_LEFT, FENCE_TOP, POST_RIGHT - POST_LEFT, 5)
  ctx.fillStyle = '#F2C230'
  ctx.fillRect(POST_LEFT + 8, FENCE_TOP + 1, 28, 2)
  ctx.fillRect(POST_RIGHT - 36, FENCE_TOP + 1, 28, 2)

  ctx.fillStyle = '#25252B'
  ctx.fillRect(POST_LEFT, GROUND - 5, POST_RIGHT - POST_LEFT, 5)

  // Octagon Canvas Mat (perspective trapezoid)
  const backY = GROUND - 2
  const frontY = HEIGHT - 2
  const matGrad = ctx.createLinearGradient(0, backY, 0, frontY)
  matGrad.addColorStop(0, '#1B1B20')
  matGrad.addColorStop(1, '#111114')
  ctx.fillStyle = matGrad
  ctx.beginPath()
  ctx.moveTo(POST_LEFT, backY)
  ctx.lineTo(POST_RIGHT, backY)
  ctx.lineTo(WIDTH - 6, frontY)
  ctx.lineTo(6, frontY)
  ctx.closePath()
  ctx.fill()

  // Mat border & inner octagon lines
  ctx.strokeStyle = 'rgba(237, 230, 214, 0.42)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(POST_LEFT, backY)
  ctx.lineTo(POST_RIGHT, backY)
  ctx.stroke()

  // Center Octagon ring on the canvas
  ctx.strokeStyle = 'rgba(242, 194, 48, 0.32)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.ellipse(WIDTH / 2, backY + 22, 68, 12, 0, 0, Math.PI * 2)
  ctx.stroke()

  // Red & Blue starting lines on mat
  ctx.strokeStyle = 'rgba(200, 16, 46, 0.65)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(WIDTH / 2 - 46, backY + 14)
  ctx.lineTo(WIDTH / 2 - 52, backY + 30)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(31, 78, 156, 0.75)'
  ctx.beginPath()
  ctx.moveTo(WIDTH / 2 + 46, backY + 14)
  ctx.lineTo(WIDTH / 2 + 52, backY + 30)
  ctx.stroke()

  // Subtle pulse on center mat when active
  const pulse = 0.12 + Math.sin(frame / 18) * 0.04
  ctx.fillStyle = `rgba(242, 194, 48, ${pulse})`
  ctx.beginPath()
  ctx.ellipse(WIDTH / 2, backY + 22, 18, 3.5, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawHud(ctx: CanvasRenderingContext2D, bout: Bout, labels: BoutLabels) {
  // Top bar strip
  ctx.fillStyle = 'rgba(14, 14, 14, 0.86)'
  ctx.fillRect(0, 0, WIDTH, 24)
  ctx.fillStyle = 'rgba(237, 230, 214, 0.15)'
  ctx.fillRect(0, 23, WIDTH, 1)

  // Left: Corner indicator + Streak
  ctx.fillStyle = '#C8102E'
  ctx.fillRect(10, 5, 6, 14)
  ctx.font = '700 11px "Barlow Condensed", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#EDE6D6'
  ctx.fillText(labels.you, 20, 15.5)

  if (bout.streak >= 2) {
    const streakText = `x${bout.streak}`
    ctx.fillStyle = '#F2C230'
    ctx.fillRect(62, 4.5, 28, 15)
    ctx.fillStyle = '#0E0E0E'
    ctx.font = '700 11px "Barlow Condensed", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(streakText, 76, 15.5)
  }

  // Right: Chrome-Dino-style HI score + Current score
  ctx.font = '700 13px "Barlow Condensed", monospace'
  ctx.textAlign = 'right'
  const scoreStr = String(bout.score).padStart(5, '0')
  const hiStr = `HI ${String(bout.hiScore).padStart(5, '0')}`

  ctx.fillStyle = 'rgba(237, 230, 214, 0.55)'
  ctx.fillText(hiStr, WIDTH - 58, 16)
  ctx.fillStyle = '#F2C230'
  ctx.fillText(scoreStr, WIDTH - 10, 16)

  // Center telegraph callout pill + timing bar
  if (bout.phase !== 'idle') {
    const isPunch = bout.attack === 'punch'
    const callLabel = (isPunch ? labels.punch : labels.kick).toUpperCase()
    const keyHint = isPunch ? '[SPACE / ↑]' : '[↓ / K]'
    const text = `${callLabel}  ${keyHint}`

    ctx.font = '700 12px "Barlow Condensed", monospace'
    const pillW = Math.max(116, ctx.measureText(text).width + 24)
    const pillX = WIDTH / 2 - pillW / 2
    const pillY = 30

    // Progress ratio remaining in the window
    const progress =
      bout.phase === 'windup'
        ? Math.max(0, bout.timer / Math.max(1, bout.phaseTotal))
        : 0.15

    ctx.fillStyle = isPunch ? '#C8102E' : '#F2C230'
    ctx.fillRect(pillX, pillY, pillW, 20)
    ctx.strokeStyle = '#0E0E0E'
    ctx.lineWidth = 1.5
    ctx.strokeRect(pillX, pillY, pillW, 20)

    ctx.fillStyle = isPunch ? '#FFFFFF' : '#0E0E0E'
    ctx.textAlign = 'center'
    ctx.fillText(text, WIDTH / 2, pillY + 14)

    // Timing bar underneath
    ctx.fillStyle = 'rgba(14, 14, 14, 0.85)'
    ctx.fillRect(pillX, pillY + 21, pillW, 3)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(pillX, pillY + 21, pillW * progress, 3)
  }
}

function drawBout(ctx: CanvasRenderingContext2D, bout: Bout, labels: BoutLabels) {
  ctx.setTransform(2, 0, 0, 2, 0, 0)
  ctx.clearRect(0, 0, WIDTH, HEIGHT)

  const shakeX = bout.shake > 0 ? (Math.random() - 0.5) * bout.shake * 1.4 : 0
  const shakeY = bout.shake > 0 ? (Math.random() - 0.5) * bout.shake * 0.9 : 0

  ctx.save()
  ctx.translate(shakeX, shakeY)

  drawOctagonStage(ctx, bout.frame)

  const bob = Math.sin(bout.frame / 6.5) * 1.8
  const telegraph: Strike | null = bout.phase !== 'idle' ? bout.attack : null

  drawFighter(
    ctx,
    222,
    -bob,
    1,
    '#C8102E',
    '#E5B88E',
    bout.playerArm,
    bout.playerKick,
    bout.playerRecoil,
    null,
  )
  drawFighter(
    ctx,
    318,
    bob,
    -1,
    '#1F4E9C',
    '#C68642',
    bout.enemyArm,
    bout.enemyKick,
    bout.enemyRecoil,
    telegraph,
  )

  // Particles
  for (const p of bout.particles) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
    ctx.restore()
  }

  // Popups (+1 / COUNTER / MISS)
  for (const pop of bout.popups) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, pop.life / 12)
    ctx.font = '700 13px "Barlow Condensed", monospace'
    const w = ctx.measureText(pop.text).width + 12
    ctx.fillStyle = '#0E0E0E'
    ctx.fillRect(pop.x - w / 2, pop.y - 12, w, 16)
    ctx.strokeStyle = pop.color
    ctx.lineWidth = 1.2
    ctx.strokeRect(pop.x - w / 2, pop.y - 12, w, 16)
    ctx.fillStyle = pop.color
    ctx.textAlign = 'center'
    ctx.fillText(pop.text, pop.x, pop.y)
    ctx.restore()
  }

  ctx.restore()

  drawHud(ctx, bout, labels)
}

function resetExchange(bout: Bout, pause: number) {
  bout.phase = 'idle'
  bout.timer = pause
  bout.phaseTotal = pause
  bout.enemyArm = 0
  bout.enemyKick = 0
}

function step(bout: Bout) {
  bout.frame += 1
  if (bout.playerHold > 0) bout.playerHold -= 1
  else {
    bout.playerArm = Math.max(0, bout.playerArm - 2.1)
    bout.playerKick = Math.max(0, bout.playerKick - 1.8)
  }
  bout.playerRecoil = Math.max(0, bout.playerRecoil - 0.55)
  bout.enemyRecoil = Math.max(0, bout.enemyRecoil - 0.55)
  bout.flash = Math.max(0, bout.flash - 1)
  bout.shake = Math.max(0, bout.shake - 0.8)
  bout.timer -= 1

  // Update particles
  for (let i = bout.particles.length - 1; i >= 0; i -= 1) {
    const p = bout.particles[i]
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.14
    p.life -= 1
    if (p.life <= 0) bout.particles.splice(i, 1)
  }

  // Update floating popups
  for (let i = bout.popups.length - 1; i >= 0; i -= 1) {
    const pop = bout.popups[i]
    pop.y -= 0.65
    pop.life -= 1
    if (pop.life <= 0) bout.popups.splice(i, 1)
  }

  // Slightly faster pace as score grows (Chrome Dino style), capped so it stays fair
  const speedBonus = Math.min(14, Math.floor(bout.score * 0.8))

  if (bout.phase === 'idle' && bout.timer <= 0) {
    bout.phase = 'windup'
    bout.attack = Math.random() < 0.5 ? 'punch' : 'kick'
    const windupFrames = Math.max(30, 44 - speedBonus)
    bout.timer = windupFrames
    bout.phaseTotal = windupFrames
    bout.enemyArm = 0
    bout.enemyKick = 0
  } else if (bout.phase === 'windup') {
    const charge = 1 - bout.timer / Math.max(1, bout.phaseTotal)
    if (bout.attack === 'punch') bout.enemyArm = -10 * charge
    else bout.enemyKick = -16 * charge
    if (bout.timer <= 0) {
      bout.phase = 'strike'
      bout.timer = 16
      bout.phaseTotal = 16
      if (bout.attack === 'punch') bout.enemyArm = 28
      else bout.enemyKick = 30
    }
  } else if (bout.phase === 'strike') {
    if (bout.attack === 'punch') bout.enemyArm = Math.max(0, bout.enemyArm - 1.5)
    else bout.enemyKick = Math.max(12, bout.enemyKick - 1.6)
    if (bout.timer <= 0) {
      bout.playerRecoil = 12
      bout.streak = 0
      bout.shake = 4
      spawnImpact(bout, 236, GROUND - 44, '#C8102E', 8)
      resetExchange(bout, Math.max(22, 32 - Math.floor(speedBonus / 2)))
    }
  }
}

function land(bout: Bout, kind: Strike, labels: BoutLabels) {
  if (bout.playerArm > 5 || bout.playerKick > 5) return
  bout.playerHold = 8
  if (kind === 'punch') bout.playerArm = 28
  else bout.playerKick = 30
  if (bout.phase === 'idle') return

  const speedBonus = Math.min(14, Math.floor(bout.score * 0.8))

  if (bout.attack === kind) {
    bout.score += 1
    bout.streak += 1
    if (bout.score > bout.hiScore) {
      bout.hiScore = bout.score
      saveHiScore(bout.hiScore)
    }
    bout.enemyRecoil = 15
    bout.flash = 16
    bout.shake = 5
    const hitY = kind === 'punch' ? GROUND - 50 : GROUND - 36
    spawnImpact(bout, 298, hitY, '#F2C230', 14)
    spawnPopup(
      bout,
      270,
      GROUND - 64,
      bout.streak >= 3 ? `${labels.counter} x${bout.streak}` : '+1',
      '#F2C230',
    )
    resetExchange(bout, Math.max(24, 38 - Math.floor(speedBonus / 2)))
    return
  }

  bout.playerRecoil = 12
  bout.streak = 0
  bout.shake = 4
  spawnImpact(bout, 236, GROUND - 44, '#C8102E', 8)
  spawnPopup(bout, 224, GROUND - 64, labels.miss, '#C8102E')
  resetExchange(bout, 32)
}

/** A compact Chrome-Dino-style octagon reflex mini-game that plays while the server wakes up. */
export function LoadingBout() {
  const { t, i18n } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boutRef = useRef<Bout | null>(null)
  const [activeKey, setActiveKey] = useState<Strike | null>(null)

  const punchLabel = t('common.boutPunch')
  const kickLabel = t('common.boutKick')
  const counterLabel = L(i18n.language, 'CONTRA-GOLPE!', 'COUNTER!', 'CONTRE !')
  const missLabel = L(i18n.language, 'ERROU', 'MISS', 'RATÉ')
  const youLabel = L(i18n.language, 'VOCÊ', 'YOU', 'VOUS')
  const cpuLabel = 'CPU'

  const labelsRef = useRef<BoutLabels>({
    punch: punchLabel,
    kick: kickLabel,
    counter: counterLabel,
    miss: missLabel,
    you: youLabel,
    cpu: cpuLabel,
  })

  useEffect(() => {
    labelsRef.current = {
      punch: punchLabel,
      kick: kickLabel,
      counter: counterLabel,
      miss: missLabel,
      you: youLabel,
      cpu: cpuLabel,
    }
  }, [punchLabel, kickLabel, counterLabel, missLabel, youLabel, cpuLabel])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    canvas.width = WIDTH * 2
    canvas.height = HEIGHT * 2
    ctx.imageSmoothingEnabled = true
    const bout: Bout = {
      score: 0,
      hiScore: readHiScore(),
      streak: 0,
      playerArm: 0,
      playerKick: 0,
      enemyArm: 0,
      enemyKick: 0,
      playerRecoil: 0,
      enemyRecoil: 0,
      phase: 'idle',
      attack: 'punch',
      timer: 26,
      phaseTotal: 26,
      flash: 0,
      shake: 0,
      frame: 0,
      playerHold: 0,
      particles: [],
      popups: [],
    }
    boutRef.current = bout
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let alive = true
    let keyTimer: number | undefined

    const trigger = (kind: Strike) => {
      land(bout, kind, labelsRef.current)
      setActiveKey(kind)
      window.clearTimeout(keyTimer)
      keyTimer = window.setTimeout(() => setActiveKey(null), 140)
    }

    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return
      if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyJ') {
        event.preventDefault()
        trigger('punch')
      } else if (event.code === 'ArrowDown' || event.code === 'KeyK') {
        event.preventDefault()
        trigger('kick')
      }
    }
    const onPointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      const x = event.clientX - bounds.left
      event.preventDefault()
      trigger(x < bounds.width / 2 ? 'punch' : 'kick')
    }

    window.addEventListener('keydown', onKey)
    canvas.addEventListener('pointerdown', onPointer)

    const loop = () => {
      if (!alive) return
      if (!reduced) step(bout)
      drawBout(ctx, bout, labelsRef.current)
      if (!reduced) requestAnimationFrame(loop)
    }
    loop()

    return () => {
      alive = false
      boutRef.current = null
      window.clearTimeout(keyTimer)
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('pointerdown', onPointer)
    }
  }, [])

  const strike = (kind: Strike) => {
    const bout = boutRef.current
    if (bout) {
      land(bout, kind, labelsRef.current)
      setActiveKey(kind)
      window.setTimeout(() => setActiveKey(null), 140)
    }
  }

  return (
    <div className="mt-3.5 w-full">
      <div className="overflow-hidden border-2 border-[var(--rule)] bg-[#0E0E10] shadow-[4px_4px_0_var(--hard)]">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="block aspect-[540/176] w-full cursor-pointer select-none touch-none"
        />
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:gap-2">
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault()
              strike('punch')
            }}
            onClick={() => strike('punch')}
            className={`inline-flex items-center justify-center gap-2 border-2 border-[var(--rule)] px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition select-none cursor-pointer ${
              activeKey === 'punch'
                ? 'translate-x-[2px] translate-y-[2px] bg-[#C8102E] text-white shadow-none'
                : 'bg-[var(--card-bg)] text-[var(--text-main)] shadow-[3px_3px_0_var(--hard)] hover:bg-[#C8102E] hover:text-white'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-[#C8102E] ring-1 ring-current" aria-hidden="true" />
            <span>{punchLabel}</span>
            <kbd className="hidden border border-current/35 bg-[var(--bg-surface-subtle)] px-1.5 py-0.5 font-mono text-[10px] leading-none sm:inline-block">
              SPACE / ↑
            </kbd>
          </button>

          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault()
              strike('kick')
            }}
            onClick={() => strike('kick')}
            className={`inline-flex items-center justify-center gap-2 border-2 border-[var(--rule)] px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition select-none cursor-pointer ${
              activeKey === 'kick'
                ? 'translate-x-[2px] translate-y-[2px] bg-[#F2C230] text-[#0E0E0E] shadow-none'
                : 'bg-[var(--card-bg)] text-[var(--text-main)] shadow-[3px_3px_0_var(--hard)] hover:bg-[#F2C230] hover:text-[#0E0E0E]'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-[#F2C230] ring-1 ring-current" aria-hidden="true" />
            <span>{kickLabel}</span>
            <kbd className="hidden border border-current/35 bg-[var(--bg-surface-subtle)] px-1.5 py-0.5 font-mono text-[10px] leading-none sm:inline-block">
              ↓ / K
            </kbd>
          </button>
        </div>

        <p className="text-[11px] leading-4 text-[var(--text-muted)] sm:text-right">
          {t('common.boutHint')}
        </p>
      </div>
    </div>
  )
}
