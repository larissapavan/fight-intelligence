import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface FloatingUfcGloveProps {
  className?: string
  interactive?: boolean
  showLightingAccents?: boolean
}

/**
 * Procedural leather micro-relief grain texture generated in dynamic HTML5 canvas.
 * Simulates high-density combat leather grain for bump/normal micro-relief.
 */
function createProceduralLeatherTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  if (ctx) {
    ctx.fillStyle = '#1c1f26'
    ctx.fillRect(0, 0, size, size)

    const imgData = ctx.getImageData(0, 0, size, size)
    const data = imgData.data

    // High-frequency cellular leather noise
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 45
      const val = Math.max(0, Math.min(255, 40 + noise))
      data[i] = val
      data[i + 1] = val
      data[i + 2] = val
      data[i + 3] = 255
    }
    ctx.putImageData(imgData, 0, 0)

    // Micro-creases & organic hide pore lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
    ctx.lineWidth = 1.2
    for (let c = 0; c < 180; c++) {
      ctx.beginPath()
      const x = Math.random() * size
      const y = Math.random() * size
      ctx.moveTo(x, y)
      ctx.lineTo(x + (Math.random() - 0.5) * 16, y + (Math.random() - 0.5) * 16)
      ctx.stroke()
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(4, 4)
  return texture
}

/**
 * Builds the official 4oz right-hand MMA glove in pure Three.js.
 * Strictly models the anatomical dorsal view of the right hand:
 * - Dorsal continuous knuckle cushion with anatomical curve
 * - 4 differentiated open finger stalls (Index, Middle, Ring, Pinky)
 * - Left-side thumb guard (anatomically correct for right hand back)
 * - Extended wrist cuff with wrap-around velcro strap and championship gold hardware
 */
function buildUfcGloveMesh(bumpMap: THREE.Texture): {
  gloveGroup: THREE.Group
  disposables: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[]; textures: THREE.Texture[] }
} {
  const gloveGroup = new THREE.Group()
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const textures: THREE.Texture[] = [bumpMap]

  // --- 1. Materials ---
  // Premium combat black matte leather
  const blackLeatherMat = new THREE.MeshStandardMaterial({
    color: 0x12141a,
    roughness: 0.48,
    metalness: 0.12,
    bumpMap: bumpMap,
    bumpScale: 0.045,
  })
  materials.push(blackLeatherMat)

  // Secondary textured trim leather (slightly darker, more matte)
  const secondaryLeatherMat = new THREE.MeshStandardMaterial({
    color: 0x0a0c10,
    roughness: 0.65,
    metalness: 0.08,
    bumpMap: bumpMap,
    bumpScale: 0.03,
  })
  materials.push(secondaryLeatherMat)

  // Championship Gold hardware (closure, trims, dorsal arc)
  const championshipGoldMat = new THREE.MeshStandardMaterial({
    color: 0xe5b842,
    roughness: 0.22,
    metalness: 0.88,
  })
  materials.push(championshipGoldMat)

  // Crimson Octagon accent piping
  const crimsonPipingMat = new THREE.MeshStandardMaterial({
    color: 0xc8102e,
    roughness: 0.38,
    metalness: 0.25,
  })
  materials.push(crimsonPipingMat)

  // --- 2. Main Dorsal Knuckle Cushion (Anatomical Dual-Curvature) ---
  // Knuckle ridge body: smooth arched capsule/box spanning over the metacarpals
  const dorsalKnuckleGeo = new THREE.SphereGeometry(1.0, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.6)
  dorsalKnuckleGeo.scale(1.08, 0.65, 0.58)
  const dorsalKnuckleMesh = new THREE.Mesh(dorsalKnuckleGeo, blackLeatherMat)
  dorsalKnuckleMesh.position.set(0, 0.42, 0.22)
  dorsalKnuckleMesh.rotation.x = 0.2
  gloveGroup.add(dorsalKnuckleMesh)
  geometries.push(dorsalKnuckleGeo)

  // Secondary impact dispersion pad (metacarpal slope)
  const metacarpalPadGeo = new THREE.CylinderGeometry(0.85, 0.72, 0.95, 32)
  metacarpalPadGeo.scale(1.15, 1, 0.48)
  const metacarpalPadMesh = new THREE.Mesh(metacarpalPadGeo, blackLeatherMat)
  metacarpalPadMesh.position.set(0, -0.15, 0.14)
  metacarpalPadMesh.rotation.x = -0.05
  gloveGroup.add(metacarpalPadMesh)
  geometries.push(metacarpalPadGeo)

  // Knuckle segmentation indentation seam
  const seamGeo = new THREE.TorusGeometry(0.88, 0.025, 16, 32, Math.PI)
  seamGeo.scale(1.1, 0.3, 0.6)
  const seamMesh = new THREE.Mesh(seamGeo, secondaryLeatherMat)
  seamMesh.position.set(0, 0.55, 0.38)
  seamMesh.rotation.x = Math.PI / 2 + 0.2
  gloveGroup.add(seamMesh)
  geometries.push(seamGeo)

  // Championship Gold Dorsal Arc (emblematic championship stripe)
  const goldArcGeo = new THREE.TorusGeometry(0.84, 0.038, 16, 48, Math.PI * 0.9)
  goldArcGeo.scale(1.05, 0.28, 0.55)
  const goldArcMesh = new THREE.Mesh(goldArcGeo, championshipGoldMat)
  goldArcMesh.position.set(0, 0.44, 0.42)
  goldArcMesh.rotation.x = Math.PI / 2 + 0.15
  gloveGroup.add(goldArcMesh)
  geometries.push(goldArcGeo)

  // --- 3. 4 Individual Open Finger Compartments (Differentiated Lengths) ---
  // Right hand dorsal view: Index (left) -> Pinky (right)
  const fingerSpecs = [
    { name: 'Index', x: -0.52, length: 0.65, radius: 0.17, curveZ: -0.15, tiltZ: 0.05 },
    { name: 'Middle', x: -0.17, length: 0.78, radius: 0.18, curveZ: -0.18, tiltZ: 0.0 }, // Longest
    { name: 'Ring', x: 0.18, length: 0.71, radius: 0.175, curveZ: -0.16, tiltZ: -0.04 },
    { name: 'Pinky', x: 0.51, length: 0.55, radius: 0.16, curveZ: -0.12, tiltZ: -0.1 },  // Shortest
  ]

  fingerSpecs.forEach((spec) => {
    const fingerGroup = new THREE.Group()
    fingerGroup.position.set(spec.x, 0.76, 0.25)
    fingerGroup.rotation.z = spec.tiltZ
    fingerGroup.rotation.x = 0.22 // Curved forward in combat stance

    // Finger stall body (open sleeve)
    const stallGeo = new THREE.CylinderGeometry(spec.radius * 0.95, spec.radius, spec.length, 24, 1, true)
    const stallMesh = new THREE.Mesh(stallGeo, blackLeatherMat)
    stallMesh.position.y = spec.length / 2
    fingerGroup.add(stallMesh)
    geometries.push(stallGeo)

    // Inner open stall cutout (dark void)
    const innerGeo = new THREE.CylinderGeometry(spec.radius * 0.9, spec.radius * 0.9, 0.1, 24)
    const innerMesh = new THREE.Mesh(innerGeo, secondaryLeatherMat)
    innerMesh.position.y = spec.length
    fingerGroup.add(innerMesh)
    geometries.push(innerGeo)

    // Championship Gold tip rim trim
    const tipTrimGeo = new THREE.TorusGeometry(spec.radius * 0.96, 0.024, 12, 24)
    const tipTrimMesh = new THREE.Mesh(tipTrimGeo, championshipGoldMat)
    tipTrimMesh.position.y = spec.length
    tipTrimMesh.rotation.x = Math.PI / 2
    fingerGroup.add(tipTrimMesh)
    geometries.push(tipTrimGeo)

    // Crimson accent loop at the base of the finger opening
    const baseTrimGeo = new THREE.TorusGeometry(spec.radius * 1.02, 0.018, 12, 24)
    const baseTrimMesh = new THREE.Mesh(baseTrimGeo, crimsonPipingMat)
    baseTrimMesh.position.y = 0.05
    baseTrimMesh.rotation.x = Math.PI / 2
    fingerGroup.add(baseTrimMesh)
    geometries.push(baseTrimGeo)

    gloveGroup.add(fingerGroup)
  })

  // --- 4. Lateral Thumb Guard (Left Side for Dorsal Right Hand) ---
  const thumbGroup = new THREE.Group()
  thumbGroup.position.set(-0.84, 0.12, 0.06)
  thumbGroup.rotation.z = 0.55
  thumbGroup.rotation.y = -0.35
  thumbGroup.rotation.x = 0.25

  // Thumb padded guard
  const thumbGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.65, 24)
  const thumbMesh = new THREE.Mesh(thumbGeo, blackLeatherMat)
  thumbMesh.position.y = 0.25
  thumbGroup.add(thumbMesh)
  geometries.push(thumbGeo)

  // Thumb tip cap with gold trim
  const thumbTipGeo = new THREE.SphereGeometry(0.18, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.5)
  const thumbTipMesh = new THREE.Mesh(thumbTipGeo, blackLeatherMat)
  thumbTipMesh.position.y = 0.55
  thumbGroup.add(thumbTipMesh)
  geometries.push(thumbTipGeo)

  const thumbGoldTrimGeo = new THREE.TorusGeometry(0.18, 0.024, 12, 24)
  const thumbGoldTrim = new THREE.Mesh(thumbGoldTrimGeo, championshipGoldMat)
  thumbGoldTrim.position.y = 0.55
  thumbGoldTrim.rotation.x = Math.PI / 2
  thumbGroup.add(thumbGoldTrim)
  geometries.push(thumbGoldTrimGeo)

  // Thumb web reinforcement loop connecting to palm
  const thumbLoopGeo = new THREE.TorusGeometry(0.24, 0.032, 12, 24, Math.PI)
  const thumbLoop = new THREE.Mesh(thumbLoopGeo, secondaryLeatherMat)
  thumbLoop.position.set(0.12, 0.1, 0)
  thumbLoop.rotation.y = Math.PI / 2
  thumbGroup.add(thumbLoop)
  geometries.push(thumbLoopGeo)

  gloveGroup.add(thumbGroup)

  // --- 5. Extended Wrist Cuff & Wrap-Around Velcro Strap ---
  // Wrist cylinder body
  const wristBodyGeo = new THREE.CylinderGeometry(0.68, 0.64, 0.85, 32)
  wristBodyGeo.scale(1.18, 1, 0.72)
  const wristBodyMesh = new THREE.Mesh(wristBodyGeo, blackLeatherMat)
  wristBodyMesh.position.set(0, -0.92, 0.04)
  gloveGroup.add(wristBodyMesh)
  geometries.push(wristBodyGeo)

  // Wrap-around velcro strap (thick layered belt)
  const strapGeo = new THREE.CylinderGeometry(0.72, 0.69, 0.42, 32, 1, true)
  strapGeo.scale(1.22, 1, 0.76)
  const strapMesh = new THREE.Mesh(strapGeo, secondaryLeatherMat)
  strapMesh.position.set(0, -0.88, 0.05)
  gloveGroup.add(strapMesh)
  geometries.push(strapGeo)

  // Crimson strap perimeter piping
  const strapTopPipingGeo = new THREE.TorusGeometry(0.72, 0.02, 12, 36)
  strapTopPipingGeo.scale(1.22, 0.76, 1)
  const strapTopPiping = new THREE.Mesh(strapTopPipingGeo, crimsonPipingMat)
  strapTopPiping.position.set(0, -0.67, 0.05)
  strapTopPiping.rotation.x = Math.PI / 2
  gloveGroup.add(strapTopPiping)
  geometries.push(strapTopPipingGeo)

  const strapBottomPipingGeo = new THREE.TorusGeometry(0.69, 0.02, 12, 36)
  strapBottomPipingGeo.scale(1.22, 0.76, 1)
  const strapBottomPiping = new THREE.Mesh(strapBottomPipingGeo, crimsonPipingMat)
  strapBottomPiping.position.set(0, -1.09, 0.05)
  strapBottomPiping.rotation.x = Math.PI / 2
  gloveGroup.add(strapBottomPiping)
  geometries.push(strapBottomPipingGeo)

  // --- 6. Championship Gold Velcro Clasp & Official 4oz Badge ---
  const goldClaspGeo = new THREE.BoxGeometry(0.55, 0.28, 0.06)
  const goldClaspMesh = new THREE.Mesh(goldClaspGeo, championshipGoldMat)
  goldClaspMesh.position.set(0.04, -0.88, 0.46)
  goldClaspMesh.rotation.y = 0.04
  gloveGroup.add(goldClaspMesh)
  geometries.push(goldClaspGeo)

  // Embossed center plate detail (UFC / Official regulation seal)
  const emblemCoreGeo = new THREE.BoxGeometry(0.42, 0.16, 0.03)
  const emblemCoreMesh = new THREE.Mesh(emblemCoreGeo, blackLeatherMat)
  emblemCoreMesh.position.set(0.04, -0.88, 0.49)
  emblemCoreMesh.rotation.y = 0.04
  gloveGroup.add(emblemCoreMesh)
  geometries.push(emblemCoreGeo)

  // Golden 4OZ regulation stamp bar
  const stampBarGeo = new THREE.BoxGeometry(0.24, 0.04, 0.02)
  const stampBarMesh = new THREE.Mesh(stampBarGeo, championshipGoldMat)
  stampBarMesh.position.set(0.04, -0.88, 0.51)
  stampBarMesh.rotation.y = 0.04
  gloveGroup.add(stampBarMesh)
  geometries.push(stampBarGeo)

  // Lower wrist trim ring
  const lowerWristTrimGeo = new THREE.TorusGeometry(0.64, 0.025, 12, 32)
  lowerWristTrimGeo.scale(1.18, 0.72, 1)
  const lowerWristTrim = new THREE.Mesh(lowerWristTrimGeo, championshipGoldMat)
  lowerWristTrim.position.set(0, -1.34, 0.04)
  lowerWristTrim.rotation.x = Math.PI / 2
  gloveGroup.add(lowerWristTrim)
  geometries.push(lowerWristTrimGeo)

  // Initial dorsal rotation angle: facing viewer with slight natural 3D isometric tilt
  gloveGroup.rotation.x = 0.15
  gloveGroup.rotation.y = -0.12
  gloveGroup.rotation.z = -0.04

  return {
    gloveGroup,
    disposables: { geometries, materials, textures },
  }
}

/**
 * Autonomous, high-performance 3D Floating UFC Glove Component.
 * Pure Three.js implementation with studio lighting, ACESFilmic tone mapping,
 * procedural leather texture, smooth cursor damping and comprehensive cleanup.
 */
export function FloatingUfcGlove({
  className = '',
  interactive = true,
  showLightingAccents = true,
}: FloatingUfcGloveProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth || 400
    const height = container.clientHeight || 400

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100)
    camera.position.set(0, 0.2, 4.2)
    camera.lookAt(0, -0.1, 0)

    // 2. WebGL Renderer with ACESFilmic Tone Mapping
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    // 3. Studio Lighting Configuration
    // Ambient fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75)
    scene.add(ambientLight)

    // Soft Key Light (Front-Top-Right Studio Softbox)
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 2.4)
    keyLight.position.set(3.0, 4.5, 3.5)
    scene.add(keyLight)

    // Lateral Fill Light (Cool slate blue for shadow depth)
    const fillLight = new THREE.DirectionalLight(0x88aacc, 1.2)
    fillLight.position.set(-3.5, 1.0, 2.0)
    scene.add(fillLight)

    // Crimson Octagon Rim Light (Back-Bottom Graze)
    const rimLight = new THREE.DirectionalLight(0xe11d48, 4.2)
    rimLight.position.set(0.5, -3.0, -3.5)
    scene.add(rimLight)

    // Top Rim Light for Championship Gold Highlights
    const goldRimLight = new THREE.DirectionalLight(0xf59e0b, 2.8)
    goldRimLight.position.set(0, 3.8, -2.0)
    scene.add(goldRimLight)

    // 4. Glove Mesh Model
    const bumpMap = createProceduralLeatherTexture()
    const { gloveGroup, disposables } = buildUfcGloveMesh(bumpMap)
    scene.add(gloveGroup)

    setIsReady(true)

    // 5. Interactive Cursor Damping & Continuous Floating Loop
    let mouseX = 0
    let mouseY = 0
    let targetRotationX = 0.15
    let targetRotationY = -0.12
    let currentRotationX = 0.15
    let currentRotationY = -0.12
    let animationFrameId: number

    const startTimestamp = performance.now()

    const onMouseMove = (e: MouseEvent) => {
      if (!interactive) return
      const rect = container.getBoundingClientRect()
      const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const normY = ((e.clientY - rect.top) / rect.height) * 2 - 1

      mouseX = normX
      mouseY = normY

      // Max rotational range: ±28 degrees
      targetRotationY = -0.12 + mouseX * 0.48
      targetRotationX = 0.15 - mouseY * 0.36
    }

    const onMouseLeave = () => {
      targetRotationX = 0.15
      targetRotationY = -0.12
    }

    if (interactive) {
      container.addEventListener('mousemove', onMouseMove)
      container.addEventListener('mouseleave', onMouseLeave)
    }

    // 6. Smooth Resize Observer
    const onResize = () => {
      if (!container) return
      const newWidth = container.clientWidth
      const newHeight = container.clientHeight
      if (newWidth === 0 || newHeight === 0) return

      camera.aspect = newWidth / newHeight
      camera.updateProjectionMatrix()
      renderer.setSize(newWidth, newHeight)
    }

    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(container)

    // 7. Render Animation Loop
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      const elapsedTime = (performance.now() - startTimestamp) * 0.001

      // Continuous subtle harmonic floating on Y axis
      const floatOffsetY = Math.sin(elapsedTime * 1.6) * 0.08
      const subtleWobble = Math.cos(elapsedTime * 1.1) * 0.03
      gloveGroup.position.y = floatOffsetY

      // Damped rotation lerp
      currentRotationX += (targetRotationX - currentRotationX) * 0.06
      currentRotationY += (targetRotationY - currentRotationY) * 0.06

      gloveGroup.rotation.x = currentRotationX + subtleWobble * 0.5
      gloveGroup.rotation.y = currentRotationY
      gloveGroup.rotation.z = -0.04 + Math.sin(elapsedTime * 0.9) * 0.02

      renderer.render(scene, camera)
    }

    animate()

    // 8. Rigorous Disposal & Teardown on Unmount
    return () => {
      cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()

      if (interactive) {
        container.removeEventListener('mousemove', onMouseMove)
        container.removeEventListener('mouseleave', onMouseLeave)
      }

      // Dispose Three.js objects
      disposables.geometries.forEach((geo) => geo.dispose())
      disposables.materials.forEach((mat) => mat.dispose())
      disposables.textures.forEach((tex) => tex.dispose())

      renderer.dispose()

      if (renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [interactive])

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center overflow-hidden select-none cursor-grab active:cursor-grabbing ${className}`}
      style={{ touchAction: 'none' }}
      aria-label="3D Interactive UFC 4oz Official Fight Glove"
      role="img"
    >
      {/* Underlying Atmospheric Radial Glow (Crimson & Championship Gold) */}
      {showLightingAccents && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-64 w-64 rounded-full bg-gradient-to-tr from-[#E11D48]/35 via-[#F59E0B]/15 to-transparent blur-3xl opacity-60 animate-pulse" />
          <div className="absolute h-48 w-48 rounded-full bg-[#E11D48]/20 blur-2xl opacity-40" />
        </div>
      )}

      {/* High-Tech Technical Overlay Stamp */}
      <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1 backdrop-blur-md">
        <span className="h-1.5 w-1.5 rounded-full bg-[#E11D48] animate-ping" />
        <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-neutral-300">
          UFC OFFICIAL 4OZ // RIGHT DORSAL
        </span>
      </div>

      {/* Fallback placeholder while canvas mounts */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-500 font-mono text-xs">
          INITIALIZING THREE.JS ENGINE...
        </div>
      )}
    </div>
  )
}
