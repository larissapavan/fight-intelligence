import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const WIDTH = 480
const HEIGHT = 220
const GROUND = 118
const POST_LEFT = 118
const POST_RIGHT = 362
const FENCE_TOP = 18

type Phase = 'idle' | 'windup' | 'strike'
type Strike = 'punch' | 'kick'

type Bout = {
  score: number
  playerArm: number
  playerKick: number
  enemyArm: number
  enemyKick: number
  playerRecoil: number
  enemyRecoil: number
  phase: Phase
  attack: Strike
  timer: number
  flash: number
  frame: number
  playerHold: number
}

function colors() {
  const style = getComputedStyle(document.documentElement)
  const ink = style.getPropertyValue('--text-main').trim() || '#0e0e0e'
  return {
    ink,
    red: '#c8102e',
    blue: '#1f4e9c',
    tape: '#f2c230',
    skinLeft: '#e2b48a',
    skinRight: '#c68642',
    mat: '#141414',
    line: '#e6dfd0',
  }
}

const HAIR = '#1c140f'

function tone(hex: string, amount: number) {
  const value = hex.replace('#', '')
  const channel = (start: number) => Math.max(0, Math.min(255, Math.round(parseInt(value.slice(start, start + 2), 16) * amount)))
  return `rgb(${channel(0)} ${channel(2)} ${channel(4)})`
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

function mitt(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, color: string) {
  ctx.fillStyle = tone(color, 0.72)
  ctx.beginPath()
  ctx.ellipse(x - facing * 1.5, y, 2.4, 3.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(x + facing * 1.2, y, 4.4, 3.3, facing * 0.35, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.38)'
  ctx.fillRect(x + facing * 0.2, y - 1.5, 2.6, 1.2)
}

function drawFighter(
  ctx: CanvasRenderingContext2D,
  x: number,
  head: number,
  facing: number,
  glove: string,
  skin: string,
  arm: number,
  kick: number,
  recoil: number,
) {
  const body = x - recoil * facing
  const bob = head - 64
  const footY = GROUND - 1 + bob
  const hipY = footY - 33
  const shoulderY = hipY - 23
  const reach = Math.max(-10, Math.min(28, arm))
  const chamber = kick < 0 ? Math.min(1, -kick / 16) : 0
  const snap = kick > 0 ? Math.min(1, kick / 28) : 0
  const punch = Math.max(0, reach) / 26
  let hipX = body
  let shoulderX = body + facing * 2
  shoulderX += facing * punch * 5
  if (reach < 0) shoulderX += facing * reach * 0.4
  shoulderX -= facing * (snap * 6 + chamber * 2)
  hipX += facing * snap * 4
  const shadow = tone(skin, 0.72)

  ctx.globalAlpha = 0.28
  ctx.fillStyle = '#f7f1e4'
  ctx.beginPath()
  ctx.ellipse(hipX, GROUND + 2, 15, 3.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  const posting = chamber > 0 || snap > 0
  const rearHip: [number, number] = [hipX - facing * 2, hipY]
  const rearKnee: [number, number] = posting ? [hipX - facing * 1, hipY + 16] : [hipX - facing * 9, hipY + 15]
  const rearAnkle: [number, number] = posting ? [hipX - facing * 1, footY - 2] : [hipX - facing * 11, footY - 2]
  limb(ctx, [rearHip, rearKnee], 5.4, shadow)
  limb(ctx, [rearHip, rearKnee], 4.2, skin)
  limb(ctx, [rearKnee, rearAnkle], 3.5, skin)
  limb(ctx, [rearAnkle, [rearAnkle[0] + facing * (posting ? 4 : -5), footY]], 2.8, skin)

  const leadHip: [number, number] = [hipX + facing * 2, hipY + snap * 2]
  const leadKnee: [number, number] = chamber > 0
    ? [hipX + facing * (5 + chamber * 3), hipY - 8 - chamber * 18]
    : snap > 0
      ? [hipX + facing * (6 + snap * 8), hipY - 14 - snap * 2]
      : [hipX + facing * 10, hipY + 14]
  const leadAnkle: [number, number] = chamber > 0
    ? [leadKnee[0] - facing * 1, leadKnee[1] + 12]
    : snap > 0
      ? [hipX + facing * (12 + snap * 22), hipY - 16 - snap * 2]
      : [hipX + facing * 13, footY - 2]
  const toe: [number, number] = chamber > 0
    ? [leadAnkle[0], leadAnkle[1] + 5]
    : snap > 0
      ? [leadAnkle[0] + facing * 2, leadAnkle[1] - 5]
      : [leadAnkle[0] + facing * 5, footY]
  limb(ctx, [leadHip, leadKnee], 5.6, shadow)
  limb(ctx, [leadHip, leadKnee], 4.4, skin)
  limb(ctx, [leadKnee, leadAnkle], 3.6, skin)
  limb(ctx, [leadAnkle, toe], 2.8, skin)

  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.moveTo(shoulderX - facing * 8, shoulderY + 1)
  ctx.lineTo(shoulderX + facing * 7, shoulderY + 2)
  ctx.lineTo(hipX + facing * 6, hipY + 1)
  ctx.lineTo(hipX - facing * 7, hipY + 2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = shadow
  ctx.globalAlpha = 0.28
  ctx.beginPath()
  ctx.ellipse(shoulderX + facing * 2, shoulderY + 8, 3.2, 4, facing * 0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.fillStyle = glove
  ctx.beginPath()
  ctx.moveTo(hipX - 8, hipY - 1)
  ctx.lineTo(hipX + 8, hipY - 1)
  ctx.lineTo(hipX + facing * 7 + 3, hipY + 12)
  ctx.lineTo(hipX + facing * 1, hipY + 10)
  ctx.lineTo(hipX - facing * 1, hipY + 13)
  ctx.lineTo(hipX - facing * 8, hipY + 11)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = tone(glove, 0.7)
  ctx.fillRect(hipX - 8, hipY - 3, 16, 3)

  const headX = shoulderX + facing * 3
  const headY = shoulderY - 11
  limb(ctx, [[shoulderX, shoulderY], [headX, headY + 6]], 4.5, skin)
  ctx.fillStyle = HAIR
  ctx.beginPath()
  ctx.ellipse(headX - facing * 0.4, headY - 1.4, 7.6, 8.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(headX + facing * 0.8, headY + 1.6, 7, 7.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = tone(skin, 0.86)
  ctx.beginPath()
  ctx.ellipse(headX - facing * 5.6, headY + 2, 2.1, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = shadow
  ctx.lineWidth = 0.8
  ctx.stroke()
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.moveTo(headX + facing * 5, headY + 0.6)
  ctx.quadraticCurveTo(headX + facing * 8.2, headY + 2.4, headX + facing * 5.2, headY + 3.8)
  ctx.fill()
  ctx.fillStyle = HAIR
  ctx.beginPath()
  ctx.ellipse(headX + facing * 2.4, headY - 0.4, 1.05, 1.05, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = HAIR
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(headX + facing * 0.4, headY - 2.6)
  ctx.lineTo(headX + facing * 4.6, headY - 1.8)
  ctx.moveTo(headX + facing * 2.6, headY + 4.6)
  ctx.lineTo(headX + facing * 5.4, headY + 5)
  ctx.stroke()

  const rearShoulder: [number, number] = [shoulderX - facing * 6, shoulderY + 2]
  const rearElbow: [number, number] = [rearShoulder[0] - facing * 2, shoulderY + 12]
  const rearFist: [number, number] = [headX + facing * 2, headY + 7]
  limb(ctx, [rearShoulder, rearElbow, rearFist], 3.6, skin)
  mitt(ctx, rearFist[0], rearFist[1], facing, glove)

  const leadShoulder: [number, number] = [shoulderX + facing * (6 + punch * 4), shoulderY + 3 - punch * 2]
  const cheekX = headX + facing * 3
  const cheekY = headY + 4
  const fistX = cheekX + facing * reach * 1.05
  const fistY = cheekY - Math.max(0, reach) * 0.28
  const extend = Math.max(0, reach) / 26
  const elbowX = leadShoulder[0] + (fistX - leadShoulder[0]) * (0.42 + extend * 0.2)
  const elbowY = leadShoulder[1] + 11 * (1 - extend) + (fistY - leadShoulder[1]) * extend * 0.2
  limb(ctx, [leadShoulder, [elbowX, elbowY], [fistX, fistY]], 3.8, skin)
  mitt(ctx, fistX, fistY, facing, glove)
}

function drawCage(ctx: CanvasRenderingContext2D, ink: string, mat: string, line: string) {
  ctx.fillStyle = ink
  ctx.globalAlpha = 0.8
  ctx.fillRect(POST_LEFT, FENCE_TOP, POST_RIGHT - POST_LEFT, 5)
  for (let x = POST_LEFT + 12; x < POST_RIGHT - 8; x += 9) {
    ctx.fillRect(x, FENCE_TOP + 5, 2, GROUND - FENCE_TOP - 8)
  }
  for (let y = FENCE_TOP + 12; y < GROUND - 4; y += 9) {
    ctx.fillRect(POST_LEFT + 8, y, POST_RIGHT - POST_LEFT - 16, 2)
  }
  ctx.globalAlpha = 1
  ctx.fillRect(POST_LEFT, FENCE_TOP, 10, GROUND - FENCE_TOP)
  ctx.fillRect(POST_RIGHT - 10, FENCE_TOP, 10, GROUND - FENCE_TOP)
  ctx.fillRect(POST_LEFT, GROUND - 6, POST_RIGHT - POST_LEFT, 6)

  const back = GROUND - 2
  const front = HEIGHT - 8
  ctx.fillStyle = mat
  ctx.beginPath()
  ctx.moveTo(POST_LEFT + 8, back)
  ctx.lineTo(POST_RIGHT - 8, back)
  ctx.lineTo(430, back + 26)
  ctx.lineTo(458, front - 28)
  ctx.lineTo(418, front)
  ctx.lineTo(62, front)
  ctx.lineTo(22, front - 28)
  ctx.lineTo(50, back + 26)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = line
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(240, back + 48, 52, 16, 0, 0, Math.PI * 2)
  ctx.stroke()
}

type BoutLabels = { punch: string; kick: string }

function drawBout(ctx: CanvasRenderingContext2D, bout: Bout, labels: BoutLabels) {
  const palette = colors()
  ctx.setTransform(2, 0, 0, 2, 0, 0)
  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  drawCage(ctx, palette.ink, palette.mat, palette.line)

  const bob = Math.sin(bout.frame / 7) * 2
  drawFighter(ctx, 186, 64 - bob, 1, palette.red, palette.skinLeft, bout.playerArm, bout.playerKick, bout.playerRecoil)
  drawFighter(ctx, 294, 64 + bob, -1, palette.blue, palette.skinRight, bout.enemyArm, bout.enemyKick, bout.enemyRecoil)

  ctx.font = '700 16px "Barlow Condensed", monospace'
  ctx.textAlign = 'right'
  ctx.fillStyle = palette.tape
  ctx.fillText(String(bout.score).padStart(5, '0'), WIDTH - 12, 28)

  if (bout.phase !== 'idle') {
    const label = (bout.attack === 'punch' ? labels.punch : labels.kick).toUpperCase()
    ctx.font = '700 15px "Barlow Condensed", monospace'
    const boxW = Math.max(54, ctx.measureText(label).width + 16)
    ctx.fillStyle = palette.tape
    ctx.fillRect(WIDTH - 12 - boxW, 34, boxW, 18)
    ctx.fillStyle = '#141414'
    ctx.textAlign = 'center'
    ctx.fillText(label, WIDTH - 12 - boxW / 2, 48)
  }

  if (bout.flash > 0) {
    ctx.fillStyle = palette.tape
    ctx.fillRect(206, 46, 68, 22)
    ctx.fillStyle = '#141414'
    ctx.font = '700 16px "Barlow Condensed", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('+1', 240, 62)
  }
}

function resetExchange(bout: Bout, pause: number) {
  bout.phase = 'idle'
  bout.timer = pause
  bout.enemyArm = 0
  bout.enemyKick = 0
}

function step(bout: Bout) {
  bout.frame += 1
  if (bout.playerHold > 0) bout.playerHold -= 1
  else {
    bout.playerArm = Math.max(0, bout.playerArm - 1.8)
    bout.playerKick = Math.max(0, bout.playerKick - 1.5)
  }
  bout.playerRecoil = Math.max(0, bout.playerRecoil - 0.45)
  bout.enemyRecoil = Math.max(0, bout.enemyRecoil - 0.45)
  bout.flash = Math.max(0, bout.flash - 1)
  bout.timer -= 1

  if (bout.phase === 'idle' && bout.timer <= 0) {
    bout.phase = 'windup'
    bout.attack = Math.random() < 0.5 ? 'punch' : 'kick'
    bout.timer = 46
    bout.enemyArm = 0
    bout.enemyKick = 0
  } else if (bout.phase === 'windup') {
    const charge = 1 - bout.timer / 46
    if (bout.attack === 'punch') bout.enemyArm = -10 * charge
    else bout.enemyKick = -16 * charge
    if (bout.timer <= 0) {
      bout.phase = 'strike'
      bout.timer = 18
      if (bout.attack === 'punch') bout.enemyArm = 26
      else bout.enemyKick = 30
    }
  } else if (bout.phase === 'strike') {
    if (bout.attack === 'punch') bout.enemyArm = Math.max(0, bout.enemyArm - 1.4)
    else bout.enemyKick = Math.max(14, bout.enemyKick - 1.5)
    if (bout.timer <= 0) {
      bout.playerRecoil = 12
      resetExchange(bout, 34)
    }
  }
}

function land(bout: Bout, kind: Strike) {
  if (bout.playerArm > 5 || bout.playerKick > 5) return
  bout.playerHold = 8
  if (kind === 'punch') bout.playerArm = 26
  else bout.playerKick = 28
  if (bout.phase === 'idle') return
  if (bout.attack === kind) {
    bout.score += 1
    bout.enemyRecoil = 14
    bout.flash = 16
    resetExchange(bout, 42)
    return
  }
  bout.playerRecoil = 12
  resetExchange(bout, 36)
}

/** A two-strike bout that plays while the page waits. Match the called punch or kick. */
export function LoadingBout() {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boutRef = useRef<Bout | null>(null)
  const punchLabel = t('common.boutPunch')
  const kickLabel = t('common.boutKick')
  const labelsRef = useRef<BoutLabels>({ punch: punchLabel, kick: kickLabel })

  useEffect(() => {
    labelsRef.current = { punch: punchLabel, kick: kickLabel }
  }, [punchLabel, kickLabel])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    canvas.width = WIDTH * 2
    canvas.height = HEIGHT * 2
    ctx.imageSmoothingEnabled = true
    const bout: Bout = {
      score: 0,
      playerArm: 0,
      playerKick: 0,
      enemyArm: 0,
      enemyKick: 0,
      playerRecoil: 0,
      enemyRecoil: 0,
      phase: 'idle',
      attack: 'punch',
      timer: 28,
      flash: 0,
      frame: 0,
      playerHold: 0,
    }
    boutRef.current = bout
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let alive = true

    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return
      if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyJ') {
        event.preventDefault()
        land(bout, 'punch')
      } else if (event.code === 'ArrowDown' || event.code === 'KeyK') {
        event.preventDefault()
        land(bout, 'kick')
      }
    }
    const onPointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      const x = event.clientX - bounds.left
      event.preventDefault()
      land(bout, x < bounds.width / 2 ? 'punch' : 'kick')
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
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('pointerdown', onPointer)
    }
  }, [])

  const strike = (kind: Strike) => {
    const bout = boutRef.current
    if (bout) land(bout, kind)
  }

  return (
    <div className="mt-3">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="h-auto w-full cursor-pointer touch-none border-2 border-[var(--rule)] bg-[var(--tile-bg)]"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onPointerDown={(event) => {
            event.preventDefault()
            strike('punch')
          }}
          onClick={() => strike('punch')}
          className="border-2 border-[var(--rule)] bg-[var(--card-bg)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text-main)] shadow-[3px_3px_0_var(--hard)]"
        >
          {t('common.boutPunch')}
        </button>
        <button
          type="button"
          onPointerDown={(event) => {
            event.preventDefault()
            strike('kick')
          }}
          onClick={() => strike('kick')}
          className="border-2 border-[var(--rule)] bg-[var(--card-bg)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text-main)] shadow-[3px_3px_0_var(--hard)]"
        >
          {t('common.boutKick')}
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{t('common.boutHint')}</p>
    </div>
  )
}
