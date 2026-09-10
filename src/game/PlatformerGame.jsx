import { useEffect, useRef, useState } from 'react'
import { sileo, Toaster } from 'sileo'
import 'sileo/styles.css'
import './PlatformerGame.css'
import gunNormalSrc from '../assets/predeterminado.png'
import gunRedSrc from '../assets/red.png'
import gunSharkSrc from '../assets/shark.png'

const WORLD_W = 960
const WORLD_H = 540

const GRAVITY = 2200
const MOVE_ACCEL = 4200
const AIR_ACCEL = 2400
const GROUND_FRICTION = 3400
const MAX_SPEED = 300
const JUMP_VELOCITY = -780
const MAX_FALL_SPEED = 1400
const COYOTE_TIME = 0.1
const JUMP_BUFFER = 0.12

const PLAYER_W = 42
const PLAYER_H = 42
const SPAWN_X = 40
const SPAWN_Y = 458
const PLAYER_MAX_HP = 100
const INVULN_TIME = 0.9
const KNOCKBACK_VX = 260
const KNOCKBACK_VY = -420
const DEATH_FADE_IN = 0.45
const DEATH_FADE_HOLD = 2.3
const DEATH_FADE_OUT = 0.55
const DEATH_TOTAL = DEATH_FADE_IN + DEATH_FADE_HOLD + DEATH_FADE_OUT
// Base damage/HP values below are the "Muy Fácil" (tier 0) baseline — DIFFICULTIES scales them up per tier.
const CONTACT_DAMAGE = 10
const PROJECTILE_DAMAGE = 6
const SLAM_DAMAGE = 14
const SPIKE_DAMAGE = 12
const SPIKE_RADIUS = 75
const LASER_DAMAGE = 14

const GUN_OFFSET = 26
const BULLET_SPEED = 980
const BULLET_LIFE = 0.9
const SHAKE_DECAY = 3.2
const SHAKE_MAX_OFFSET = 10

const BOSS_W = 132
const BOSS_H = 128
const BOSS_BASE_Y = 150
const BOSS_MAX_HP = 200
const BOSS_DASH_SPEED = 460
const BOSS_PROJECTILE_SPEED = 320
const BOSS_PROJECTILE_COUNT = 5
const BOSS_RESPAWN_DELAY = 3.2
const LASER_TELEGRAPH = 0.65
const LASER_DURATION = 0.32
const LASER_HEIGHT_BAND = 50
const ATTACK_POOL = ['dash', 'projectile', 'slam', 'spikes', 'laser']
const TICKER_SPEED = 55

const DIFFICULTIES = [
  'Muy Fácil',
  'Fácil',
  'Normal',
  'Difícil',
  'Demonio',
  'Hardcore',
  'Muy Hardcore',
  'Extremo',
  'Muy Extremo',
  'Imposible',
]

function getDifficultyParams(index) {
  const i = Math.max(0, Math.min(DIFFICULTIES.length - 1, index))
  const t = i / (DIFFICULTIES.length - 1)
  return {
    name: DIFFICULTIES[i],
    hpMult: 1 + t * 2.4,
    dmgMult: 1 + t * 1.7,
    speedMult: 1 + t * 1.0,
    telegraphMult: Math.max(0.3, 1 - t * 0.65),
    recoverMult: Math.max(0.35, 1 - t * 0.55),
    idleMult: Math.max(0.3, 1 - t * 0.6),
    chainChance: 0.12 + t * 0.6,
    projectileExtra: Math.round(t * 7),
    spikeExtraBursts: Math.round(t * 4),
    laserWaves: 1 + Math.round(t * 2),
    laserDurationMult: 1 + t * 0.5,
    trackGapMult: Math.max(0.5, 1 - t * 0.45),
    invulnMult: Math.max(0.55, 1 - t * 0.35),
  }
}

const KILL_LABELS = {
  dash: 'Embestida del jefe',
  projectile: 'Ráfaga de proyectiles',
  slam: 'Golpe de tierra',
  spikes: 'Picos del suelo',
  laser: 'Rayo láser',
  contact: 'Contacto con el jefe',
}

const DEATH_TIPS = {
  dash: [
    'Consejo: cuando el jefe empieza a brillar, prepárate para saltar a un lado.',
    'Consejo: la embestida solo golpea una vez — aléjate en cuanto la esquives.',
  ],
  projectile: [
    'Consejo: muévete en zigzag, los proyectiles no giran para seguirte.',
    'Consejo: ponte detrás de una plataforma para bloquear la ráfaga.',
  ],
  slam: [
    'Consejo: salta justo cuando el jefe caiga en picado hacia el suelo.',
    'Consejo: el golpe de tierra solo daña si estás pisando el suelo — quédate en el aire.',
  ],
  spikes: [
    'Consejo: los picos aparecen donde TÚ estabas — no dejes de moverte durante el aviso rojo.',
    'Consejo: corre en una dirección y no pares hasta que termine la ráfaga de picos.',
  ],
  laser: [
    'Consejo: sube a una plataforma elevada para esquivar el láser rasante.',
    'Consejo: salta justo antes de que termine el aviso parpadeante del láser.',
  ],
  contact: [
    'Consejo: mantén las distancias, tocar al jefe también hace daño.',
    'Consejo: dispara mientras retrocedes en vez de acercarte.',
  ],
}

const GENERIC_DEATH_TIPS = [
  'Consejo: tu arma no se sobrecalienta, dispara sin miedo.',
  'Consejo: eres invulnerable un instante después de cada golpe — aprovéchalo para escapar.',
  'Consejo: si la dificultad actual es muy alta, bájala desde el menú de abajo.',
  'Consejo: las plataformas elevadas son tu mejor refugio contra ataques a ras de suelo.',
]

const platforms = [
  { x: 0, y: 500, w: WORLD_W, h: 40 },
  { x: 60, y: 380, w: 150, h: 22 },
  { x: WORLD_W - 210, y: 380, w: 150, h: 22 },
  { x: WORLD_W / 2 - 85, y: 250, w: 170, h: 22 },
]

const PLAYER_COLORS = [
  { id: 'blanco', name: 'Blanco', hex: '#ffffff' },
  { id: 'naranja', name: 'Naranja', hex: '#ff8a4d' },
  { id: 'azul', name: 'Azul', hex: '#4d9bff' },
  { id: 'verde', name: 'Verde', hex: '#4ddc8a' },
  { id: 'rojo', name: 'Rojo', hex: '#ff5d5d' },
  { id: 'morado', name: 'Morado', hex: '#b070ff' },
  { id: 'plata', name: 'Plata', hex: '#c7d0dc' },
  { id: 'amarillo', name: 'Amarillo', hex: '#ffd23f' },
]

const PLAYER_SKINS = [
  { id: 'fantasma', name: 'Fantasma' },
  { id: 'calabaza', name: 'Calabaza de Halloween' },
]

// 3 weapon tiers, each a different sprite with its own damage/fire-rate trade-off.
// gripFracX/Y and muzzleFracX/Y are fractions of the source image's width/height, measured
// from each PNG (the hand/trigger position, and the leftmost opaque pixel = muzzle tip) —
// they let the sprite be redrawn mirrored (barrel forward) and pinned to the player's hand
// without hardcoding per-image pixel offsets everywhere the gun is used.
const GUN_LEVELS = [
  {
    id: 'normal',
    name: '1. Normal',
    src: gunNormalSrc,
    damage: 9,
    fireRate: 0.14,
    gripFracX: 0.62,
    gripFracY: 0.5,
    muzzleFracX: 12 / 1536,
    muzzleFracY: 357 / 1024,
    drawW: 66,
  },
  {
    id: 'red',
    name: '2. Red',
    src: gunRedSrc,
    damage: 14,
    fireRate: 0.1,
    gripFracX: 0.63,
    gripFracY: 0.56,
    muzzleFracX: 27 / 1536,
    muzzleFracY: 364 / 1024,
    drawW: 59,
  },
  {
    id: 'shark',
    name: '3. Shark',
    src: gunSharkSrc,
    damage: 21,
    fireRate: 0.07,
    gripFracX: 0.42,
    gripFracY: 0.48,
    muzzleFracX: 75 / 1536,
    muzzleFracY: 252 / 1024,
    drawW: 84,
  },
].map((lvl) => ({ ...lvl, barrelLen: (lvl.gripFracX - lvl.muzzleFracX) * lvl.drawW }))

const GUN_IMAGES = GUN_LEVELS.map((lvl) => {
  const img = new Image()
  img.src = lvl.src
  return img
})

const FACE_OPTIONS = [
  { id: 'omaka', name: 'OMAKA' },
  { id: 'redondo', name: 'Redondos' },
  { id: 'feliz', name: 'Felices' },
  { id: 'decidido', name: 'Decididos' },
  { id: 'guino', name: 'Guiño' },
  { id: 'ox', name: 'O x' },
]

const CROSSHAIR_STYLES = [
  { id: 'cruz', name: 'Cruz' },
  { id: 'circulo', name: 'Círculo' },
  { id: 'diamante', name: 'Diamante' },
  { id: 'punto', name: 'Punto' },
]

// 10 boss skins, ranked noob -> pro. Only cosmetic — stats/hp still come from difficulty.
// Each style is built from exactly two user-editable colors: colorA (body) and colorB (accent/trim).
// The flags below (neon, chrome, wood, gold, holo, crooked, particles, badge) control the *effect*,
// not the hue — those come entirely from colorA/colorB, which the player can repaint freely.
const BOSS_STYLES = [
  { id: 'noob', name: '1. Noob', colorA: '#9a9a9a', colorB: '#7a7f86', aura: 0, badge: null, crooked: true },
  { id: 'principiante', name: '2. Principiante', colorA: '#b9cfe3', colorB: '#5ec8ff', aura: 0.12, badge: null },
  { id: 'amateur', name: '3. Amateur', colorA: '#c7d8ea', colorB: '#5ec8ff', aura: 0.28, badge: null },
  { id: 'competente', name: '4. Competente', colorA: '#c9954f', colorB: '#ffe6ad', aura: 0.22, badge: null, wood: true },
  { id: 'avanzado', name: '5. Avanzado', colorA: '#12151a', colorB: '#39ff9e', aura: 0.55, badge: null, neon: true },
  { id: 'experto', name: '6. Experto', colorA: '#c7cfd6', colorB: '#eef2f6', aura: 0.3, badge: null, chrome: true },
  { id: 'elite', name: '7. Élite', colorA: '#3a1330', colorB: '#ff5d7a', aura: 0.42, badge: null },
  { id: 'maestro', name: '8. Maestro', colorA: '#caa023', colorB: '#fff0c2', aura: 0.45, badge: 'crown', gold: true },
  { id: 'leyenda', name: '9. Leyenda', colorA: '#ff5ec8', colorB: '#5ec8ff', aura: 0.6, badge: 'star', holo: true, particles: 8 },
  { id: 'pro', name: '10. PRO', colorA: '#0a0a0f', colorB: '#00eaff', aura: 0.8, badge: 'PRO', neon: true, chrome: true, particles: 14 },
]

// 4 selectable arena backdrops. Each is built from exactly two user-editable colors
// (colorA/colorB) so players can repaint the scene, same pattern as BOSS_STYLES above.
const BACKGROUNDS = [
  { id: 'ciudad-noche', name: 'Ciudad futurista (noche)', colorA: '#0b1030', colorB: '#ff2fd1', hintA: 'Cielo', hintB: 'Luces de neón' },
  { id: 'ciudad-dia', name: 'Ciudad futurista (día)', colorA: '#8ec9ff', colorB: '#5ec8ff', hintA: 'Cielo', hintB: 'Reflejos' },
  { id: 'playa-dia', name: 'Playa (día)', colorA: '#8fd4f5', colorB: '#ffd23f', hintA: 'Cielo / mar', hintB: 'Sol' },
  { id: 'playa-noche', name: 'Playa (noche)', colorA: '#0c1440', colorB: '#cfe0ff', hintA: 'Cielo / mar', hintB: 'Luna' },
]

// Deterministic pseudo-random skyline, generated once at module load so buildings/windows
// stay put across frames instead of jittering every render.
const CITY_BUILDINGS = (() => {
  let seed = 42
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  const far = []
  let x = -20
  while (x < WORLD_W + 20) {
    const w = 40 + rand() * 50
    const h = 90 + rand() * 90
    far.push({ x, w, h })
    x += w + 6 + rand() * 10
  }
  const near = []
  x = -30
  while (x < WORLD_W + 30) {
    const w = 50 + rand() * 70
    const h = 130 + rand() * 160
    const cols = Math.max(1, Math.floor(w / 14))
    const rows = Math.max(1, Math.floor(h / 18))
    const windows = Array.from({ length: cols * rows }, () => rand() > 0.55)
    near.push({ x, w, h, cols, rows, windows })
    x += w + 10 + rand() * 14
  }
  return { far, near }
})()

const STAR_FIELD = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 53.7) % WORLD_W,
  y: (i * 31.3) % 260,
  r: 0.5 + ((i * 17) % 10) / 10,
  phase: i,
}))

const BEACH_WAVES = Array.from({ length: 4 }, (_, i) => ({ y: 312 + i * 11, speed: 20 + i * 5, phase: i * 1.7 }))

function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16)
  const clamp = (v) => Math.max(0, Math.min(255, v))
  const r = clamp((num >> 16) + Math.round(2.55 * percent))
  const g = clamp(((num >> 8) & 0xff) + Math.round(2.55 * percent))
  const b = clamp((num & 0xff) + Math.round(2.55 * percent))
  return `rgb(${r},${g},${b})`
}

function hexToRgb(hex) {
  const num = parseInt(hex.slice(1), 16)
  return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff }
}

function mixHexColors(hexA, hexB, t) {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  const r = Math.round(a.r + (b.r - a.r) * t)
  const g = Math.round(a.g + (b.g - a.g) * t)
  const bch = Math.round(a.b + (b.b - a.b) * t)
  return `rgb(${r},${g},${bch})`
}

const approach = (current, target, rate, dt) =>
  current + (target - current) * (1 - Math.exp(-rate * dt))

function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export default function PlatformerGame() {
  const canvasRef = useRef(null)
  const diffRef = useRef(2)
  const colorRef = useRef(0)
  const faceRef = useRef(0)
  const skinRef = useRef(0)
  const gunLevelRef = useRef(0)
  const bossImageRef = useRef(null)
  const bossNameRef = useRef('JEFE')
  const bossMessageRef = useRef('')
  const bossStyleRef = useRef(0)
  const bossColorARef = useRef(BOSS_STYLES[0].colorA)
  const bossColorBRef = useRef(BOSS_STYLES[0].colorB)
  const crosshairStyleRef = useRef(0)
  const crosshairColorRef = useRef('#ffffff')
  const bgStyleRef = useRef(0)
  const bgColorARef = useRef(BACKGROUNDS[0].colorA)
  const bgColorBRef = useRef(BACKGROUNDS[0].colorB)
  const gameControlsRef = useRef(null)
  const [difficultyIndex, setDifficultyIndex] = useState(2)
  const [colorIndex, setColorIndex] = useState(0)
  const [faceIndex, setFaceIndex] = useState(0)
  const [skinIndex, setSkinIndex] = useState(0)
  const [gunLevelIndex, setGunLevelIndex] = useState(0)
  const [bossImageName, setBossImageName] = useState('')
  const [bossName, setBossName] = useState('JEFE')
  const [bossMessage, setBossMessage] = useState('')
  const [bossStyleIndex, setBossStyleIndex] = useState(0)
  const [bossColorA, setBossColorA] = useState(BOSS_STYLES[0].colorA)
  const [bossColorB, setBossColorB] = useState(BOSS_STYLES[0].colorB)
  const [crosshairStyleIndex, setCrosshairStyleIndex] = useState(0)
  const [crosshairColor, setCrosshairColor] = useState('#ffffff')
  const [bgStyleIndex, setBgStyleIndex] = useState(0)
  const [bgColorA, setBgColorA] = useState(BACKGROUNDS[0].colorA)
  const [bgColorB, setBgColorB] = useState(BACKGROUNDS[0].colorB)

  const onDifficultyChange = (e) => {
    const idx = Number(e.target.value)
    diffRef.current = idx
    setDifficultyIndex(idx)
    gameControlsRef.current?.resetFight()
    sileo.info({ title: 'Dificultad', description: `${idx + 1}. ${DIFFICULTIES[idx]}` })
  }

  const onColorChange = (idx) => {
    colorRef.current = idx
    setColorIndex(idx)
    sileo.info({ title: 'Color', description: PLAYER_COLORS[idx].name })
  }

  const onFaceChange = (e) => {
    const idx = Number(e.target.value)
    faceRef.current = idx
    setFaceIndex(idx)
    sileo.info({ title: 'Cara', description: FACE_OPTIONS[idx].name })
  }

  const onSkinChange = (e) => {
    const idx = Number(e.target.value)
    skinRef.current = idx
    setSkinIndex(idx)
    // Suggest a matching color per skin — orange for the pumpkin, white for the ghost —
    // still fully repaintable via the color swatches below.
    const suggestedColor = PLAYER_SKINS[idx].id === 'calabaza' ? 'naranja' : 'blanco'
    const colorIdx = PLAYER_COLORS.findIndex((c) => c.id === suggestedColor)
    if (colorIdx >= 0) {
      colorRef.current = colorIdx
      setColorIndex(colorIdx)
    }
    sileo.info({ title: 'Skin', description: PLAYER_SKINS[idx].name })
  }

  const onGunLevelChange = (e) => {
    const idx = Number(e.target.value)
    gunLevelRef.current = idx
    setGunLevelIndex(idx)
    const lvl = GUN_LEVELS[idx]
    sileo.info({
      title: 'Arma',
      description: `${lvl.name} · Daño ${lvl.damage} · Cadencia ${lvl.fireRate.toFixed(2)}s`,
    })
  }

  const onBossImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        bossImageRef.current = img
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
    setBossImageName(file.name)
    sileo.success({ title: 'Logo del jefe', description: file.name })
  }

  const onBossNameChange = (e) => {
    const val = e.target.value
    setBossName(val)
    bossNameRef.current = val.trim() || 'JEFE'
  }

  const onBossNameBlur = () => {
    sileo.info({ title: 'Nombre del jefe', description: bossNameRef.current })
  }

  const onBossMessageChange = (e) => {
    const val = e.target.value
    setBossMessage(val)
    bossMessageRef.current = val
  }

  const onBossMessageBlur = () => {
    const msg = bossMessageRef.current.trim()
    if (msg) {
      const preview = msg.length > 60 ? `${msg.slice(0, 60)}…` : msg
      sileo.info({ title: 'Mensaje del jefe', description: preview })
    }
  }

  const onBossStyleChange = (e) => {
    const idx = Number(e.target.value)
    bossStyleRef.current = idx
    setBossStyleIndex(idx)
    // Reset to that style's recommended palette — still fully repaintable below.
    bossColorARef.current = BOSS_STYLES[idx].colorA
    bossColorBRef.current = BOSS_STYLES[idx].colorB
    setBossColorA(BOSS_STYLES[idx].colorA)
    setBossColorB(BOSS_STYLES[idx].colorB)
    sileo.info({ title: 'Estilo del jefe', description: BOSS_STYLES[idx].name })
  }

  const onBossColorAChange = (e) => {
    const val = e.target.value
    bossColorARef.current = val
    setBossColorA(val)
  }

  const onBossColorBChange = (e) => {
    const val = e.target.value
    bossColorBRef.current = val
    setBossColorB(val)
  }

  const onCrosshairStyleChange = (e) => {
    const idx = Number(e.target.value)
    crosshairStyleRef.current = idx
    setCrosshairStyleIndex(idx)
    sileo.info({ title: 'Mira', description: CROSSHAIR_STYLES[idx].name })
  }

  const onCrosshairColorChange = (e) => {
    const val = e.target.value
    crosshairColorRef.current = val
    setCrosshairColor(val)
  }

  const onBgStyleChange = (e) => {
    const idx = Number(e.target.value)
    bgStyleRef.current = idx
    setBgStyleIndex(idx)
    // Reset to that background's recommended palette — still fully repaintable below.
    bgColorARef.current = BACKGROUNDS[idx].colorA
    bgColorBRef.current = BACKGROUNDS[idx].colorB
    setBgColorA(BACKGROUNDS[idx].colorA)
    setBgColorB(BACKGROUNDS[idx].colorB)
    sileo.info({ title: 'Fondo', description: BACKGROUNDS[idx].name })
  }

  const onBgColorAChange = (e) => {
    const val = e.target.value
    bgColorARef.current = val
    setBgColorA(val)
  }

  const onBgColorBChange = (e) => {
    const val = e.target.value
    bgColorBRef.current = val
    setBgColorB(val)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const mainCtx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = WORLD_W * dpr
    canvas.height = WORLD_H * dpr
    mainCtx.scale(dpr, dpr)

    // Offscreen buffer used only during the death blur transition: the world is drawn to it at
    // normal speed (no filter), then composited onto the main canvas with a single blurred
    // drawImage call. Applying ctx.filter directly to every individual draw call (background,
    // platforms, particles, boss shapes, ...) was the slow path — blurring ~40 shapes per frame
    // instead of one final bitmap.
    const offCanvas = document.createElement('canvas')
    offCanvas.width = WORLD_W * dpr
    offCanvas.height = WORLD_H * dpr
    const offCtx = offCanvas.getContext('2d')
    offCtx.scale(dpr, dpr)

    let ctx = mainCtx

    const isTypingTarget = (target) =>
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)

    const keys = new Set()
    const onKeyDown = (e) => {
      if (isTypingTarget(e.target)) return
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        e.preventDefault()
      }
      keys.add(e.code)
      if (e.code === 'Space') player.jumpBuffer = JUMP_BUFFER
    }
    const onKeyUp = (e) => {
      if (isTypingTarget(e.target)) return
      keys.delete(e.code)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const mouse = { x: WORLD_W / 2, y: WORLD_H / 2 }
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * WORLD_W
      mouse.y = ((e.clientY - rect.top) / rect.height) * WORLD_H
    }
    window.addEventListener('mousemove', onMouseMove)

    let firing = false
    const onMouseDown = (e) => {
      if (e.button === 0 && !isTypingTarget(e.target)) firing = true
    }
    const onMouseUp = (e) => {
      if (e.button === 0) firing = false
    }
    const onBlur = () => {
      firing = false
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('blur', onBlur)

    let fireCooldown = 0
    let shakeTrauma = 0
    let message = null
    let deathFade = null
    let tickerOffset = 0
    const bullets = []
    const bossBullets = []
    const flashes = []
    const shockwaves = []

    const player = {
      x: SPAWN_X,
      y: SPAWN_Y,
      vx: 0,
      vy: 0,
      grounded: false,
      coyoteTimer: 0,
      jumpBuffer: 0,
      facing: 1,
      aimFacing: 1,
      gunAngle: 0,
      gunPivotX: 0,
      gunPivotY: 0,
      gunKick: 0,
      squashX: 1,
      squashY: 1,
      lean: 0,
      bob: 0,
      runCycle: 0,
      wasGrounded: false,
      dustTimer: 0,
      hp: PLAYER_MAX_HP,
      invuln: 0,
      hitFlash: 0,
      lastHitType: 'contact',
      dead: false,
    }

    const initialDiff = getDifficultyParams(diffRef.current)
    const boss = {
      x: WORLD_W - 220,
      y: BOSS_BASE_Y,
      w: BOSS_W,
      h: BOSS_H,
      hp: Math.round(BOSS_MAX_HP * initialDiff.hpMult),
      maxHp: Math.round(BOSS_MAX_HP * initialDiff.hpMult),
      state: 'idle',
      stateTimer: 0.9,
      attackType: null,
      lastAttackType: null,
      hoverPhase: Math.random() * Math.PI * 2,
      facing: -1,
      hitFlash: 0,
      dashDir: 0,
      hasHitPlayerThisDash: false,
      slamOriginY: BOSS_BASE_Y,
      spikeStep: 0,
      spikeTargetX: 0,
      spikeTotalSteps: 3,
      laserY: 470,
      laserWaveIndex: 0,
      laserWavesTotal: 1,
    }

    const particles = []
    const spikes = []

    function spawnDust(x, y, count, spread, life) {
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread
        const speed = 60 + Math.random() * 90
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life,
          maxLife: life,
          size: 3 + Math.random() * 3,
        })
      }
    }

    function spawnMuzzleFlash(x, y) {
      flashes.push({ x, y, life: 0.06, maxLife: 0.06 })
    }

    function shoot() {
      const level = GUN_LEVELS[gunLevelRef.current] || GUN_LEVELS[0]
      const angle = player.gunAngle
      const muzzleX = player.gunPivotX + Math.cos(angle) * level.barrelLen
      const muzzleY = player.gunPivotY + Math.sin(angle) * level.barrelLen
      bullets.push({
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(angle) * BULLET_SPEED,
        vy: Math.sin(angle) * BULLET_SPEED,
        life: BULLET_LIFE,
        damage: level.damage,
      })
      spawnMuzzleFlash(muzzleX, muzzleY)
      player.gunKick = 1
      shakeTrauma = Math.min(1, shakeTrauma + 0.4)
    }

    function damagePlayer(amount, sourceX, type = 'contact') {
      if (player.invuln > 0) return
      const d = getDifficultyParams(diffRef.current)
      player.hp = Math.max(0, player.hp - amount * d.dmgMult)
      player.invuln = INVULN_TIME * d.invulnMult
      player.hitFlash = 1
      player.lastHitType = type
      const dir = player.x + PLAYER_W / 2 < sourceX ? -1 : 1
      player.vx = dir * KNOCKBACK_VX
      player.vy = KNOCKBACK_VY
      player.grounded = false
      shakeTrauma = Math.min(1, shakeTrauma + 0.35)
      spawnDust(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, 10, Math.PI * 2, 0.4)
      if (player.hp <= 0) triggerDefeat()
    }

    function triggerDefeat() {
      const type = player.lastHitType || 'contact'
      const label = KILL_LABELS[type] || KILL_LABELS.contact
      const pool = [...(DEATH_TIPS[type] || []), ...GENERIC_DEATH_TIPS]
      const tip = pool[Math.floor(Math.random() * pool.length)]
      message = {
        text: 'DERROTA',
        subtitle: `Eliminado por: ${label}`,
        tip,
        timer: DEATH_TOTAL,
        maxTimer: DEATH_TOTAL,
        color: '#ff5b5b',
        useDeathFade: true,
      }
      player.dead = true
      player.vx = 0
      player.vy = 0
      deathFade = {
        timer: 0,
        totalIn: DEATH_FADE_IN,
        totalHold: DEATH_FADE_HOLD,
        totalOut: DEATH_FADE_OUT,
        resetDone: false,
      }
      sileo.error({ title: 'DERROTA', description: `Eliminado por: ${label}`, duration: 2600 })
    }

    function getDeathOverlayAlpha() {
      if (!deathFade) return 0
      const { timer, totalIn, totalHold, totalOut } = deathFade
      if (timer < totalIn) return totalIn > 0 ? timer / totalIn : 1
      if (timer < totalIn + totalHold) return 1
      const outT = timer - totalIn - totalHold
      return Math.max(0, 1 - (totalOut > 0 ? outT / totalOut : 1))
    }

    function updateDeathFade(dt) {
      if (!deathFade) return
      deathFade.timer += dt
      const { timer, totalIn, totalHold, totalOut } = deathFade
      const total = totalIn + totalHold + totalOut

      if (!deathFade.resetDone && timer >= totalIn) {
        const d = getDifficultyParams(diffRef.current)
        player.x = SPAWN_X
        player.y = SPAWN_Y
        player.vx = 0
        player.vy = 0
        player.hp = PLAYER_MAX_HP
        player.invuln = 1.6 * d.invulnMult
        deathFade.resetDone = true
      }

      if (message) {
        message.timer -= dt
        if (message.timer <= 0) message = null
      }

      if (timer >= total) {
        deathFade = null
        player.dead = false
      }
    }

    function tryDamagePlayerFromBoss(amount, type = 'contact') {
      const bossRect = { x: boss.x, y: boss.y, w: boss.w, h: boss.h }
      const playerRect = { x: player.x, y: player.y, w: PLAYER_W, h: PLAYER_H }
      if (aabbOverlap(playerRect, bossRect) && player.invuln <= 0) {
        damagePlayer(amount, boss.x + boss.w / 2, type)
        return true
      }
      return false
    }

    function damageBoss(amount, hitX, hitY) {
      if (boss.state === 'dead') return
      boss.hp = Math.max(0, boss.hp - amount)
      boss.hitFlash = 1
      spawnDust(hitX, hitY, 4, Math.PI * 2, 0.25)
      if (boss.hp <= 0) triggerBossDeath()
    }

    function triggerBossDeath() {
      const name = bossNameRef.current || 'JEFE'
      boss.state = 'dead'
      boss.stateTimer = BOSS_RESPAWN_DELAY
      shakeTrauma = 1
      spawnDust(boss.x + boss.w / 2, boss.y + boss.h / 2, 40, Math.PI * 2, 0.9)
      message = {
        text: 'VICTORIA',
        subtitle: `Has derrotado a ${name}`,
        timer: 2.6,
        maxTimer: 2.6,
        color: '#ffd23f',
      }
      sileo.success({ title: '¡VICTORIA!', description: `Has derrotado a ${name}`, duration: 2600 })
    }

    function respawnBoss() {
      const d = getDifficultyParams(diffRef.current)
      boss.maxHp = Math.round(BOSS_MAX_HP * d.hpMult)
      boss.hp = boss.maxHp
      boss.state = 'idle'
      boss.stateTimer = 1.2 * d.idleMult
      boss.x = WORLD_W - 220
      boss.y = BOSS_BASE_Y
      boss.hitFlash = 0
      const name = bossNameRef.current || 'JEFE'
      sileo.info({ title: `${name} ha vuelto`, description: 'La arena tiembla de nuevo', duration: 2200 })
    }

    function resetFight() {
      const d = getDifficultyParams(diffRef.current)
      boss.maxHp = Math.round(BOSS_MAX_HP * d.hpMult)
      boss.hp = boss.maxHp
      boss.state = 'idle'
      boss.stateTimer = 0.9 * d.idleMult
      boss.x = WORLD_W - 220
      boss.y = BOSS_BASE_Y
      boss.hitFlash = 0
      boss.lastAttackType = null
      player.hp = PLAYER_MAX_HP
      player.x = SPAWN_X
      player.y = SPAWN_Y
      player.vx = 0
      player.vy = 0
      player.invuln = 0.6
      player.dead = false
      deathFade = null
      bullets.length = 0
      bossBullets.length = 0
      particles.length = 0
      spikes.length = 0
      shockwaves.length = 0
      flashes.length = 0
      message = null
      shakeTrauma = 0
    }

    function fireBossBarrage() {
      const d = getDifficultyParams(diffRef.current)
      const count = BOSS_PROJECTILE_COUNT + d.projectileExtra
      const speed = BOSS_PROJECTILE_SPEED * d.speedMult
      const originX = boss.x + boss.w / 2
      const originY = boss.y + boss.h / 2
      const baseAngle = Math.atan2(player.y + PLAYER_H / 2 - originY, player.x + PLAYER_W / 2 - originX)
      const spread = 0.5
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : i / (count - 1) - 0.5
        const angle = baseAngle + t * spread
        bossBullets.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 2.2,
        })
      }
      shakeTrauma = Math.min(1, shakeTrauma + 0.25)
    }

    function slamImpact() {
      const cx = boss.x + boss.w / 2
      shockwaves.push({ x: cx, y: 500, life: 0.5, maxLife: 0.5 })
      spawnDust(cx, 500, 20, Math.PI * 2, 0.5)
      shakeTrauma = 1
      const dist = Math.abs(player.x + PLAYER_W / 2 - cx)
      if (dist < 190 && player.grounded && player.invuln <= 0) {
        damagePlayer(SLAM_DAMAGE, cx, 'slam')
      }
    }

    function eruptSpike(x) {
      spikes.push({ x, life: 0.35, maxLife: 0.35 })
      spawnDust(x, 500, 14, Math.PI, 0.4)
      shakeTrauma = Math.min(1, shakeTrauma + 0.5)
      const dist = Math.abs(player.x + PLAYER_W / 2 - x)
      if (dist < SPIKE_RADIUS && player.grounded && player.invuln <= 0) {
        damagePlayer(SPIKE_DAMAGE, x, 'spikes')
      }
    }

    function chooseAttack(d) {
      let choice = ATTACK_POOL[Math.floor(Math.random() * ATTACK_POOL.length)]
      if (choice === boss.lastAttackType) {
        choice = ATTACK_POOL[Math.floor(Math.random() * ATTACK_POOL.length)]
      }
      boss.attackType = choice
      boss.lastAttackType = choice
      boss.state = 'telegraph'
      boss.stateTimer = 0.45 * d.telegraphMult
    }

    function updateBoss(dt) {
      const d = getDifficultyParams(diffRef.current)
      boss.hitFlash = Math.max(0, boss.hitFlash - dt * 4)
      boss.facing = player.x + PLAYER_W / 2 < boss.x + boss.w / 2 ? -1 : 1

      if (boss.state === 'dead') {
        boss.stateTimer -= dt
        if (boss.stateTimer <= 0) respawnBoss()
        return
      }

      boss.hoverPhase += dt

      if (boss.state === 'idle') {
        const desiredGap = 260 * d.trackGapMult
        let targetX = player.x + PLAYER_W / 2 - boss.w / 2 - boss.facing * desiredGap
        targetX = Math.max(20, Math.min(WORLD_W - boss.w - 20, targetX))
        boss.x = approach(boss.x, targetX, 1.6 * d.speedMult, dt)
        boss.y = BOSS_BASE_Y + Math.sin(boss.hoverPhase * 1.6) * 12
        boss.stateTimer -= dt
        if (boss.stateTimer <= 0) chooseAttack(d)
      } else if (boss.state === 'telegraph') {
        boss.y = BOSS_BASE_Y + Math.sin(boss.hoverPhase * 1.6) * 12
        boss.stateTimer -= dt
        if (boss.stateTimer <= 0) {
          if (boss.attackType === 'dash') {
            boss.dashDir = player.x + PLAYER_W / 2 < boss.x + boss.w / 2 ? -1 : 1
            boss.hasHitPlayerThisDash = false
            boss.state = 'dash'
            boss.stateTimer = 0.5
          } else if (boss.attackType === 'projectile') {
            fireBossBarrage()
            boss.state = 'recover'
            boss.stateTimer = 0.55 * d.recoverMult
          } else if (boss.attackType === 'slam') {
            boss.slamOriginY = boss.y
            boss.state = 'slamRise'
            boss.stateTimer = 0.3 * d.telegraphMult
          } else if (boss.attackType === 'spikes') {
            boss.spikeStep = 0
            boss.spikeTotalSteps = 3 + d.spikeExtraBursts
            boss.spikeTargetX = player.x + PLAYER_W / 2
            boss.state = 'spikeTelegraph'
            boss.stateTimer = 0.5 * d.telegraphMult
          } else if (boss.attackType === 'laser') {
            boss.laserY = 470
            boss.laserWaveIndex = 0
            boss.laserWavesTotal = d.laserWaves
            boss.state = 'laserTelegraph'
            boss.stateTimer = LASER_TELEGRAPH * d.telegraphMult
          }
        }
      } else if (boss.state === 'dash') {
        boss.x += boss.dashDir * BOSS_DASH_SPEED * d.speedMult * dt
        boss.x = Math.max(-boss.w * 0.3, Math.min(WORLD_W - boss.w * 0.7, boss.x))
        boss.y = BOSS_BASE_Y + Math.sin(boss.hoverPhase * 4) * 6
        if (!boss.hasHitPlayerThisDash && tryDamagePlayerFromBoss(CONTACT_DAMAGE, 'dash')) {
          boss.hasHitPlayerThisDash = true
        }
        boss.stateTimer -= dt
        if (boss.stateTimer <= 0) {
          boss.state = 'recover'
          boss.stateTimer = 0.4 * d.recoverMult
        }
      } else if (boss.state === 'slamRise') {
        boss.y = approach(boss.y, boss.slamOriginY - 46, 14, dt)
        boss.stateTimer -= dt
        if (boss.stateTimer <= 0) {
          boss.state = 'slamFall'
          boss.stateTimer = Math.max(0.08, 0.16 * d.telegraphMult)
        }
      } else if (boss.state === 'slamFall') {
        boss.y = approach(boss.y, BOSS_BASE_Y + 30, 30, dt)
        boss.stateTimer -= dt
        if (boss.stateTimer <= 0) {
          slamImpact()
          boss.state = 'recover'
          boss.stateTimer = 0.55 * d.recoverMult
        }
      } else if (boss.state === 'spikeTelegraph') {
        boss.y = BOSS_BASE_Y + Math.sin(boss.hoverPhase * 1.6) * 12
        boss.stateTimer -= dt
        if (boss.stateTimer <= 0) {
          eruptSpike(boss.spikeTargetX)
          boss.spikeStep += 1
          if (boss.spikeStep < boss.spikeTotalSteps) {
            boss.spikeTargetX = player.x + PLAYER_W / 2
            boss.stateTimer = 0.4 * d.telegraphMult
          } else {
            boss.state = 'recover'
            boss.stateTimer = 0.45 * d.recoverMult
          }
        }
      } else if (boss.state === 'laserTelegraph') {
        boss.y = BOSS_BASE_Y + Math.sin(boss.hoverPhase * 1.6) * 12
        boss.stateTimer -= dt
        if (boss.stateTimer <= 0) {
          boss.state = 'laserFire'
          boss.stateTimer = LASER_DURATION * d.laserDurationMult
          shakeTrauma = Math.min(1, shakeTrauma + 0.4)
        }
      } else if (boss.state === 'laserFire') {
        boss.stateTimer -= dt
        if (player.invuln <= 0) {
          const playerRect = { x: player.x, y: player.y, w: PLAYER_W, h: PLAYER_H }
          const laserRect = { x: 0, y: boss.laserY - LASER_HEIGHT_BAND / 2, w: WORLD_W, h: LASER_HEIGHT_BAND }
          if (aabbOverlap(playerRect, laserRect)) {
            damagePlayer(LASER_DAMAGE, boss.x + boss.w / 2, 'laser')
          }
        }
        if (boss.stateTimer <= 0) {
          boss.laserWaveIndex += 1
          if (boss.laserWaveIndex < boss.laserWavesTotal) {
            boss.laserY = boss.laserY === 470 ? 300 : 470
            boss.state = 'laserTelegraph'
            boss.stateTimer = LASER_TELEGRAPH * d.telegraphMult * 0.75
          } else {
            boss.state = 'recover'
            boss.stateTimer = 0.5 * d.recoverMult
          }
        }
      } else if (boss.state === 'recover') {
        boss.y = approach(boss.y, BOSS_BASE_Y, 8, dt)
        boss.stateTimer -= dt
        if (boss.stateTimer <= 0) {
          if (Math.random() < d.chainChance) {
            chooseAttack(d)
          } else {
            boss.state = 'idle'
            boss.stateTimer = (0.6 + Math.random() * 0.5) * d.idleMult
          }
        }
      }

      if (boss.state !== 'dash') {
        tryDamagePlayerFromBoss(CONTACT_DAMAGE * 0.6)
      }
    }

    let animId
    let lastTime = performance.now()

    function update(dt) {
      if (player.dead) {
        updateDeathFade(dt)
        return
      }

      const left = keys.has('ArrowLeft') || keys.has('KeyA')
      const right = keys.has('ArrowRight') || keys.has('KeyD')

      const accel = player.grounded ? MOVE_ACCEL : AIR_ACCEL
      if (left && !right) {
        player.vx = approach(player.vx, -MAX_SPEED, accel / MAX_SPEED, dt)
        player.facing = -1
      } else if (right && !left) {
        player.vx = approach(player.vx, MAX_SPEED, accel / MAX_SPEED, dt)
        player.facing = 1
      } else if (player.grounded) {
        player.vx = approach(player.vx, 0, GROUND_FRICTION / MAX_SPEED, dt)
      } else {
        player.vx = approach(player.vx, 0, (AIR_ACCEL * 0.3) / MAX_SPEED, dt)
      }

      player.vy = Math.min(player.vy + GRAVITY * dt, MAX_FALL_SPEED)

      if (player.grounded) player.coyoteTimer = COYOTE_TIME
      else player.coyoteTimer = Math.max(0, player.coyoteTimer - dt)
      player.jumpBuffer = Math.max(0, player.jumpBuffer - dt)

      if (player.jumpBuffer > 0 && player.coyoteTimer > 0) {
        player.vy = JUMP_VELOCITY
        player.grounded = false
        player.coyoteTimer = 0
        player.jumpBuffer = 0
        player.squashX = 0.6
        player.squashY = 1.5
        spawnDust(player.x + PLAYER_W / 2, player.y + PLAYER_H, 6, 1.4, 0.3)
      }

      // Horizontal movement + collision
      player.x += player.vx * dt
      player.x = Math.max(0, Math.min(WORLD_W - PLAYER_W, player.x))
      const bodyX = { x: player.x, y: player.y, w: PLAYER_W, h: PLAYER_H }
      for (const p of platforms) {
        if (aabbOverlap(bodyX, p)) {
          if (player.vx > 0) player.x = p.x - PLAYER_W
          else if (player.vx < 0) player.x = p.x + p.w
          player.vx = 0
          bodyX.x = player.x
        }
      }

      // Vertical movement + collision
      player.wasGrounded = player.grounded
      player.grounded = false
      const incomingVy = player.vy
      player.y += player.vy * dt
      const bodyY = { x: player.x, y: player.y, w: PLAYER_W, h: PLAYER_H }
      for (const p of platforms) {
        if (aabbOverlap(bodyY, p)) {
          if (player.vy > 0) {
            player.y = p.y - PLAYER_H
            player.grounded = true
          } else if (player.vy < 0) {
            player.y = p.y + p.h
          }
          player.vy = 0
          bodyY.y = player.y
        }
      }

      // Landing feedback
      if (player.grounded && !player.wasGrounded) {
        const impact = Math.min(1, Math.abs(incomingVy) / MAX_FALL_SPEED)
        player.squashX = 1 + 0.4 * Math.max(impact, 0.35)
        player.squashY = 1 - 0.4 * Math.max(impact, 0.35)
        spawnDust(player.x + PLAYER_W / 2, player.y + PLAYER_H, 8 + Math.floor(impact * 6), 2.2, 0.35)
      }

      // Running dust
      if (player.grounded && Math.abs(player.vx) > 60) {
        player.dustTimer -= dt
        if (player.dustTimer <= 0) {
          player.dustTimer = 0.09
          spawnDust(player.x + PLAYER_W / 2 - player.facing * 12, player.y + PLAYER_H, 1, 0.9, 0.25)
        }
      } else {
        player.dustTimer = 0
      }

      // Squash/stretch targets driven by vertical speed while airborne
      // (stretches taller/thinner the faster it moves, up or down)
      if (!player.grounded) {
        const speedN = Math.min(1, Math.abs(player.vy) / 900)
        const targetSY = 1 + speedN * 0.25
        const targetSX = 1 - speedN * 0.2
        player.squashY = approach(player.squashY, targetSY, 10, dt)
        player.squashX = approach(player.squashX, targetSX, 10, dt)
      } else {
        player.squashX = approach(player.squashX, 1, 9, dt)
        player.squashY = approach(player.squashY, 1, 9, dt)
      }

      // Run cycle bob
      if (player.grounded && Math.abs(player.vx) > 10) {
        player.runCycle += dt * (4 + (Math.abs(player.vx) / MAX_SPEED) * 6)
        player.bob = Math.abs(Math.sin(player.runCycle)) * 4
      } else {
        player.runCycle = 0
        player.bob = approach(player.bob, 0, 12, dt)
      }

      // Lean into movement direction
      const leanTarget = player.grounded
        ? (player.vx / MAX_SPEED) * 8
        : (player.vx / MAX_SPEED) * 5
      player.lean = approach(player.lean, leanTarget, 8, dt)

      // Gun aims at the mouse cursor, held out away from the body
      const shoulderX = player.x + PLAYER_W / 2
      const shoulderY = player.y + PLAYER_H * 0.45 - player.bob
      player.gunAngle = Math.atan2(mouse.y - shoulderY, mouse.x - shoulderX)
      player.aimFacing = Math.cos(player.gunAngle) < 0 ? -1 : 1
      player.gunPivotX = shoulderX + Math.cos(player.gunAngle) * GUN_OFFSET
      player.gunPivotY = shoulderY + Math.sin(player.gunAngle) * GUN_OFFSET
      player.gunKick = approach(player.gunKick, 0, 16, dt)

      // Firing
      fireCooldown = Math.max(0, fireCooldown - dt)
      if (firing && fireCooldown <= 0) {
        shoot()
        fireCooldown = (GUN_LEVELS[gunLevelRef.current] || GUN_LEVELS[0]).fireRate
      }
      shakeTrauma = Math.max(0, shakeTrauma - SHAKE_DECAY * dt)
      tickerOffset -= TICKER_SPEED * dt

      // Player status timers
      player.invuln = Math.max(0, player.invuln - dt)
      player.hitFlash = Math.max(0, player.hitFlash - dt * 5)

      // Boss AI
      updateBoss(dt)

      // Boss projectiles
      for (let i = bossBullets.length - 1; i >= 0; i--) {
        const b = bossBullets[i]
        b.life -= dt
        b.x += b.vx * dt
        b.y += b.vy * dt
        let hit = false
        if (player.invuln <= 0) {
          const playerRect = { x: player.x, y: player.y, w: PLAYER_W, h: PLAYER_H }
          const bulletRect = { x: b.x - 6, y: b.y - 6, w: 12, h: 12 }
          if (aabbOverlap(playerRect, bulletRect)) {
            damagePlayer(PROJECTILE_DAMAGE, b.x, 'projectile')
            hit = true
          }
        }
        if (hit || b.life <= 0 || b.x < -30 || b.x > WORLD_W + 30 || b.y < -30 || b.y > WORLD_H + 30) {
          bossBullets.splice(i, 1)
        }
      }

      // Shockwaves
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        shockwaves[i].life -= dt
        if (shockwaves[i].life <= 0) shockwaves.splice(i, 1)
      }

      // Ground spikes
      for (let i = spikes.length - 1; i >= 0; i--) {
        spikes[i].life -= dt
        if (spikes[i].life <= 0) spikes.splice(i, 1)
      }

      // Player bullets (also test against the boss)
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i]
        b.life -= dt
        b.x += b.vx * dt
        b.y += b.vy * dt

        let hitBoss = false
        if (boss.state !== 'dead') {
          const bossRect = { x: boss.x, y: boss.y, w: boss.w, h: boss.h }
          const bulletRect = { x: b.x - 7, y: b.y - 4, w: 14, h: 8 }
          if (aabbOverlap(bulletRect, bossRect)) {
            damageBoss(b.damage, b.x, b.y)
            hitBoss = true
          }
        }

        if (hitBoss || b.life <= 0 || b.x < -20 || b.x > WORLD_W + 20 || b.y < -20 || b.y > WORLD_H + 20) {
          bullets.splice(i, 1)
        }
      }

      // Muzzle flashes
      for (let i = flashes.length - 1; i >= 0; i--) {
        flashes[i].life -= dt
        if (flashes[i].life <= 0) flashes.splice(i, 1)
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i]
        pt.life -= dt
        if (pt.life <= 0) {
          particles.splice(i, 1)
          continue
        }
        pt.vy += 400 * dt
        pt.x += pt.vx * dt
        pt.y += pt.vy * dt
      }

      // Message banner
      if (message) {
        message.timer -= dt
        if (message.timer <= 0) message = null
      }
    }

    function drawArenaBackground() {
      const style = BACKGROUNDS[bgStyleRef.current] || BACKGROUNDS[0]
      const colorA = bgColorARef.current || style.colorA
      const colorB = bgColorBRef.current || style.colorB
      if (style.id === 'ciudad-dia') drawCityBackground(colorA, colorB, false)
      else if (style.id === 'playa-dia') drawBeachBackground(colorA, colorB, false)
      else if (style.id === 'playa-noche') drawBeachBackground(colorA, colorB, true)
      else drawCityBackground(colorA, colorB, true)
    }

    function drawCityBackground(colorA, colorB, isNight) {
      const skyline = 340
      const grad = ctx.createLinearGradient(0, 0, 0, WORLD_H)
      grad.addColorStop(0, shadeColor(colorA, isNight ? -8 : 25))
      grad.addColorStop(0.6, colorA)
      grad.addColorStop(1, shadeColor(colorA, isNight ? -30 : -8))
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, WORLD_W, WORLD_H)

      const rgbB = hexToRgb(colorB)

      if (isNight) {
        for (const s of STAR_FIELD) {
          const tw = 0.35 + Math.abs(Math.sin(performance.now() / 500 + s.phase)) * 0.55
          ctx.fillStyle = `rgba(255,255,255,${tw})`
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
          ctx.fill()
        }
        const moonX = WORLD_W - 120
        const moonY = 90
        const glow = ctx.createRadialGradient(moonX, moonY, 4, moonX, moonY, 100)
        glow.addColorStop(0, `rgba(${rgbB.r},${rgbB.g},${rgbB.b},0.35)`)
        glow.addColorStop(1, `rgba(${rgbB.r},${rgbB.g},${rgbB.b},0)`)
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(moonX, moonY, 100, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#eef3ff'
        ctx.beginPath()
        ctx.arc(moonX, moonY, 26, 0, Math.PI * 2)
        ctx.fill()
      } else {
        const sunX = 140
        const sunY = 90
        const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130)
        glow.addColorStop(0, 'rgba(255,244,200,0.55)')
        glow.addColorStop(1, 'rgba(255,244,200,0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(sunX, sunY, 130, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff6d8'
        ctx.beginPath()
        ctx.arc(sunX, sunY, 32, 0, Math.PI * 2)
        ctx.fill()
      }

      // far skyline layer
      ctx.fillStyle = isNight ? shadeColor(colorA, -22) : shadeColor(colorA, -14)
      for (const b of CITY_BUILDINGS.far) {
        ctx.fillRect(b.x, skyline - b.h, b.w, b.h)
      }

      // near skyline layer, with lit windows
      for (const b of CITY_BUILDINGS.near) {
        ctx.fillStyle = isNight ? '#0c0f18' : shadeColor(colorA, -34)
        ctx.fillRect(b.x, skyline - b.h, b.w, b.h)
        let wi = 0
        for (let row = 0; row < b.rows; row++) {
          for (let col = 0; col < b.cols; col++) {
            const lit = b.windows[wi]
            wi++
            if (!lit) continue
            const wx = b.x + 5 + col * 14
            const wy = skyline - b.h + 6 + row * 18
            if (wx > b.x + b.w - 8 || wy > skyline - 10) continue
            const flicker = isNight ? 0.55 + Math.sin(performance.now() / 700 + wi) * 0.35 : 0.5
            ctx.fillStyle = isNight
              ? `rgba(${rgbB.r},${rgbB.g},${rgbB.b},${Math.max(0.15, flicker)})`
              : 'rgba(255,255,255,0.55)'
            ctx.fillRect(wx, wy, 6, 8)
          }
        }
      }

      ctx.fillStyle = isNight ? 'rgba(6,8,16,0.55)' : 'rgba(255,255,255,0.18)'
      ctx.fillRect(0, skyline - 6, WORLD_W, 46)
    }

    function drawPalm(x, baseY, isNight) {
      const trunkColor = isNight ? '#1c1712' : '#3a2916'
      const leafColor = isNight ? '#0f1c14' : '#1f5c3a'
      ctx.save()
      ctx.translate(x, baseY)
      ctx.strokeStyle = trunkColor
      ctx.lineWidth = 7
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(10, -40, 4, -78)
      ctx.stroke()
      ctx.fillStyle = leafColor
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i - 2) * 0.5
        const lx = 4 + Math.cos(angle) * 42
        const ly = -78 + Math.sin(angle) * 26
        ctx.beginPath()
        ctx.ellipse(4 + (lx - 4) * 0.55, -78 + (ly + 78) * 0.55, 26, 9, angle, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    function drawBeachBackground(colorA, colorB, isNight) {
      const horizon = 330
      const grad = ctx.createLinearGradient(0, 0, 0, horizon)
      grad.addColorStop(0, shadeColor(colorA, isNight ? -12 : 22))
      grad.addColorStop(1, colorA)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, WORLD_W, horizon)

      if (isNight) {
        for (const s of STAR_FIELD) {
          const tw = 0.3 + Math.abs(Math.sin(performance.now() / 550 + s.phase)) * 0.55
          ctx.fillStyle = `rgba(255,255,255,${tw})`
          ctx.beginPath()
          ctx.arc(s.x, s.y * 0.85, s.r, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      const rgbB = hexToRgb(colorB)
      const bodyX = WORLD_W - 170
      const bodyY = 100
      const glow = ctx.createRadialGradient(bodyX, bodyY, 4, bodyX, bodyY, isNight ? 90 : 130)
      glow.addColorStop(0, `rgba(${rgbB.r},${rgbB.g},${rgbB.b},${isNight ? 0.4 : 0.55})`)
      glow.addColorStop(1, `rgba(${rgbB.r},${rgbB.g},${rgbB.b},0)`)
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(bodyX, bodyY, isNight ? 90 : 130, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = colorB
      ctx.beginPath()
      ctx.arc(bodyX, bodyY, isNight ? 24 : 32, 0, Math.PI * 2)
      ctx.fill()

      // sea band
      const seaGrad = ctx.createLinearGradient(0, horizon - 20, 0, horizon + 60)
      seaGrad.addColorStop(0, isNight ? shadeColor(colorA, -10) : shadeColor(colorA, 12))
      seaGrad.addColorStop(1, isNight ? shadeColor(colorA, -35) : shadeColor(colorA, -18))
      ctx.fillStyle = seaGrad
      ctx.fillRect(0, horizon - 20, WORLD_W, 80)

      // moving wave lines, catching the sun/moon color as a highlight
      const t = performance.now() / 1000
      for (const w of BEACH_WAVES) {
        ctx.strokeStyle = isNight
          ? `rgba(${rgbB.r},${rgbB.g},${rgbB.b},0.22)`
          : 'rgba(255,255,255,0.4)'
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let x = 0; x <= WORLD_W; x += 12) {
          const yy = w.y + Math.sin(x / 42 + t * (w.speed / 18) + w.phase) * 3
          if (x === 0) ctx.moveTo(x, yy)
          else ctx.lineTo(x, yy)
        }
        ctx.stroke()
      }

      // sand strip down to the ground platform
      ctx.fillStyle = isNight ? '#3a3222' : '#e8cf9a'
      ctx.fillRect(0, horizon + 40, WORLD_W, 120)
      ctx.fillStyle = isNight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)'
      ctx.fillRect(0, horizon + 40, WORLD_W, 6)

      drawPalm(72, horizon + 60, isNight)
      drawPalm(WORLD_W - 72, horizon + 60, isNight)
    }

    function drawPlatform(p, isGround) {
      ctx.fillStyle = isGround ? '#4a3a3d' : '#5c4750'
      ctx.fillRect(p.x, p.y, p.w, p.h)
      ctx.fillStyle = 'rgba(255,180,120,0.18)'
      ctx.fillRect(p.x, p.y, p.w, 6)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4)
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      ctx.lineWidth = 1
      for (let lx = p.x + 30; lx < p.x + p.w; lx += 60) {
        ctx.beginPath()
        ctx.moveTo(lx, p.y + 6)
        ctx.lineTo(lx, p.y + p.h)
        ctx.stroke()
      }
    }

    function drawGhostBody(w, h, baseColor) {
      // rounded dome + a wavy scalloped tail
      const domeR = w / 2
      const sideBottom = -h * 0.22
      const tailBottom = 0
      ctx.beginPath()
      ctx.moveTo(-w / 2, sideBottom)
      ctx.lineTo(-w / 2, -h + domeR)
      ctx.arc(0, -h + domeR, domeR, Math.PI, 0, false)
      ctx.lineTo(w / 2, sideBottom)
      const scallops = 3
      const segW = w / scallops
      for (let i = 0; i < scallops; i++) {
        const xStart = w / 2 - segW * i
        const xMid = xStart - segW / 2
        const xEnd = xStart - segW
        ctx.quadraticCurveTo(xMid, tailBottom, xEnd, sideBottom)
      }
      ctx.closePath()

      const grad = ctx.createLinearGradient(0, -h, 0, 0)
      grad.addColorStop(0, shadeColor(baseColor, 22))
      grad.addColorStop(1, shadeColor(baseColor, -10))
      ctx.globalAlpha = 0.88
      ctx.fillStyle = grad
      ctx.fill()

      if (player.hitFlash > 0) {
        ctx.globalAlpha = player.hitFlash * 0.8
        ctx.fillStyle = '#ffffff'
        ctx.fill()
      }
      ctx.globalAlpha = 1

      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.beginPath()
      ctx.ellipse(-w * 0.16, -h * 0.62, w * 0.22, h * 0.15, -0.4, 0, Math.PI * 2)
      ctx.fill()
    }

    function drawPumpkinBody(w, h, baseColor) {
      // squat jack-o'-lantern: ridged round body + a bent stem and a little leaf
      const rx = (w / 2) * 1.1
      const ry = (h / 2) * 0.92
      const cy = -h / 2
      ctx.beginPath()
      ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2)

      const grad = ctx.createLinearGradient(0, cy - ry, 0, cy + ry)
      grad.addColorStop(0, shadeColor(baseColor, 20))
      grad.addColorStop(1, shadeColor(baseColor, -16))
      ctx.globalAlpha = 0.94
      ctx.fillStyle = grad
      ctx.fill()

      if (player.hitFlash > 0) {
        ctx.globalAlpha = player.hitFlash * 0.8
        ctx.fillStyle = '#ffffff'
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // vertical ridge lines following the pumpkin's curvature
      ctx.lineWidth = 1.4
      ctx.strokeStyle = shadeColor(baseColor, -38)
      for (const f of [-0.58, -0.22, 0.22, 0.58]) {
        const x = f * rx
        const half = ry * Math.sqrt(Math.max(0, 1 - f * f))
        const yTop = cy - half
        const yBottom = cy + half
        ctx.beginPath()
        ctx.moveTo(x, yTop)
        ctx.quadraticCurveTo(x + (f > 0 ? 2 : -2), cy, x, yBottom)
        ctx.stroke()
      }

      // stem
      ctx.save()
      ctx.translate(0, cy - ry)
      ctx.rotate(-0.18)
      ctx.fillStyle = '#5a3a1e'
      ctx.beginPath()
      ctx.moveTo(-3, 2)
      ctx.lineTo(3, 2)
      ctx.lineTo(2, -10)
      ctx.lineTo(-2, -10)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // leaf
      ctx.save()
      ctx.translate(6, cy - ry + 1)
      ctx.rotate(0.5)
      ctx.fillStyle = '#3f7d3a'
      ctx.beginPath()
      ctx.ellipse(0, 0, 7, 3.4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.beginPath()
      ctx.ellipse(-w * 0.16, cy - ry * 0.4, w * 0.2, h * 0.13, -0.4, 0, Math.PI * 2)
      ctx.fill()
    }

    function drawPlayer() {
      if (player.invuln > 0 && Math.floor(performance.now() / 80) % 2 === 0) return

      const cx = player.x + PLAYER_W / 2
      const groundY = 500
      const feetY = player.y + PLAYER_H
      const heightOff = Math.max(0, groundY - feetY)
      const shadowScale = Math.max(0.3, 1 - heightOff / 260)

      ctx.save()
      ctx.translate(cx, groundY + 2)
      ctx.scale(shadowScale, 0.35 * shadowScale)
      ctx.beginPath()
      ctx.fillStyle = `rgba(0,0,0,${0.28 * shadowScale})`
      ctx.arc(0, 0, PLAYER_W * 0.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      ctx.save()
      ctx.translate(cx, player.y + PLAYER_H - player.bob)
      ctx.rotate((player.lean * Math.PI) / 180)
      ctx.scale(player.squashX, player.squashY)

      const w = PLAYER_W
      const h = PLAYER_H
      const baseColor = PLAYER_COLORS[colorRef.current]?.hex || PLAYER_COLORS[0].hex
      const skinId = PLAYER_SKINS[skinRef.current]?.id || 'fantasma'

      if (skinId === 'calabaza') drawPumpkinBody(w, h, baseColor)
      else drawGhostBody(w, h, baseColor)

      drawFace(player.aimFacing * 6, h)

      ctx.restore()
    }

    function drawFace(eyeOffsetX, h) {
      const eyeY = -h / 2 - 2
      const eyeColor = '#1c1712'
      const eyeDark = '#000000'
      const faceId = FACE_OPTIONS[faceRef.current]?.id || 'redondo'

      function roundEye(x, y, radius) {
        ctx.fillStyle = eyeColor
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = eyeDark
        ctx.beginPath()
        ctx.arc(x, y, radius * 0.45, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.beginPath()
        ctx.arc(x - radius * 0.3, y - radius * 0.32, radius * 0.25, 0, Math.PI * 2)
        ctx.fill()
      }

      function happyEye(x, y, radius) {
        ctx.strokeStyle = eyeColor
        ctx.lineWidth = 2.6
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.arc(x, y + radius * 0.3, radius, Math.PI, Math.PI * 2)
        ctx.stroke()
      }

      function determinedEye(x, y, radius, side) {
        ctx.fillStyle = eyeColor
        ctx.beginPath()
        ctx.moveTo(x - radius * side, y - radius * 0.5)
        ctx.lineTo(x + radius * side, y - radius * 0.15)
        ctx.lineTo(x + radius * side, y + radius * 0.55)
        ctx.lineTo(x - radius * side, y + radius * 0.3)
        ctx.closePath()
        ctx.fill()
      }

      function winkEye(x, y, radius) {
        ctx.strokeStyle = eyeColor
        ctx.lineWidth = 2.6
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(x - radius, y)
        ctx.lineTo(x + radius, y)
        ctx.stroke()
      }

      function xEye(x, y, radius) {
        ctx.strokeStyle = eyeColor
        ctx.lineWidth = 2.4
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(x - radius, y - radius)
        ctx.lineTo(x + radius, y + radius)
        ctx.moveTo(x + radius, y - radius)
        ctx.lineTo(x - radius, y + radius)
        ctx.stroke()
      }

      // ">" / "<" chevron, for the OMAKA squint
      function chevronEye(x, y, radius, pointsRight) {
        ctx.strokeStyle = eyeColor
        ctx.lineWidth = 2.6
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        const tip = pointsRight ? radius * 0.7 : -radius * 0.7
        const base = pointsRight ? -radius * 0.7 : radius * 0.7
        ctx.moveTo(x + base, y - radius)
        ctx.lineTo(x + tip, y)
        ctx.lineTo(x + base, y + radius)
        ctx.stroke()
      }

      const leftX = eyeOffsetX - 6
      const rightX = eyeOffsetX + 6
      const r = 4.4

      if (faceId === 'omaka') {
        chevronEye(eyeOffsetX - 9, eyeY, r, true)
        chevronEye(eyeOffsetX + 9, eyeY, r, false)
      } else if (faceId === 'feliz') {
        happyEye(leftX, eyeY, r)
        happyEye(rightX, eyeY, r)
        ctx.strokeStyle = eyeColor
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.arc(eyeOffsetX, eyeY + 8, 5, 0.15 * Math.PI, 0.85 * Math.PI)
        ctx.stroke()
      } else if (faceId === 'decidido') {
        determinedEye(leftX, eyeY, r, -1)
        determinedEye(rightX, eyeY, r, 1)
        ctx.strokeStyle = eyeColor
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(eyeOffsetX - 4, eyeY + 9)
        ctx.lineTo(eyeOffsetX + 4, eyeY + 9)
        ctx.stroke()
      } else if (faceId === 'guino') {
        roundEye(leftX, eyeY, r)
        winkEye(rightX, eyeY, r)
        ctx.strokeStyle = eyeColor
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.arc(eyeOffsetX, eyeY + 8, 4, 0.15 * Math.PI, 0.85 * Math.PI)
        ctx.stroke()
      } else if (faceId === 'ox') {
        roundEye(leftX, eyeY, r)
        xEye(rightX, eyeY, r * 0.6)
      } else {
        roundEye(leftX, eyeY, r)
        roundEye(rightX, eyeY, r)
      }
    }

    function drawGun() {
      const level = GUN_LEVELS[gunLevelRef.current] || GUN_LEVELS[0]
      const img = GUN_IMAGES[gunLevelRef.current] || GUN_IMAGES[0]
      if (!img.complete || img.naturalWidth === 0) return

      ctx.save()
      ctx.translate(player.gunPivotX, player.gunPivotY)
      ctx.rotate(player.gunAngle)
      if (Math.cos(player.gunAngle) < 0) ctx.scale(1, -1)
      ctx.translate(-player.gunKick * 5, 0)

      // Source art faces left (muzzle at the low-x edge) with the grip near gripFrac*size.
      // Canvas drawImage does NOT mirror on a negative dWidth (verified empirically) — an
      // explicit ctx.scale(-1,1) is required to actually flip the sprite so the barrel points
      // forward along local +x, then the offset below pins the grip to the pivot (0,0).
      ctx.scale(-1, 1)
      const drawW = level.drawW
      const drawH = drawW * (img.naturalHeight / img.naturalWidth)
      const dx = -level.gripFracX * drawW
      const dy = -level.gripFracY * drawH
      ctx.drawImage(img, dx, dy, drawW, drawH)

      ctx.restore()
    }

    function drawWeaponLaserSight() {
      if (player.dead) return
      const level = GUN_LEVELS[gunLevelRef.current] || GUN_LEVELS[0]
      const angle = player.gunAngle
      const originX = player.gunPivotX + Math.cos(angle) * level.barrelLen
      const originY = player.gunPivotY + Math.sin(angle) * level.barrelLen
      const beamLen = 1400
      const endX = originX + Math.cos(angle) * beamLen
      const endY = originY + Math.sin(angle) * beamLen
      const pulse = 0.75 + Math.sin(performance.now() / 90) * 0.25

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      ctx.strokeStyle = `rgba(255,40,40,${0.18 * pulse})`
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(originX, originY)
      ctx.lineTo(endX, endY)
      ctx.stroke()

      ctx.strokeStyle = `rgba(255,130,120,${0.6 * pulse})`
      ctx.lineWidth = 1.3
      ctx.beginPath()
      ctx.moveTo(originX, originY)
      ctx.lineTo(endX, endY)
      ctx.stroke()
      ctx.restore()

      ctx.fillStyle = 'rgba(255,90,70,0.95)'
      ctx.beginPath()
      ctx.arc(originX, originY, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }

    function drawBossBadge(badge, rim, accent, h, facing) {
      const by = -h / 2 - 40
      const unmirror = badge === 'PRO' && facing < 0
      if (unmirror) {
        ctx.save()
        ctx.scale(-1, 1)
      }
      if (badge === 'crown') {
        ctx.fillStyle = rim
        ctx.beginPath()
        ctx.moveTo(-14, by + 10)
        ctx.lineTo(-14, by)
        ctx.lineTo(-7, by + 7)
        ctx.lineTo(0, by - 5)
        ctx.lineTo(7, by + 7)
        ctx.lineTo(14, by)
        ctx.lineTo(14, by + 10)
        ctx.closePath()
        ctx.fill()
      } else if (badge === 'star') {
        ctx.fillStyle = accent
        ctx.beginPath()
        const spikes = 5
        const outerR = 11
        const innerR = 4.8
        for (let i = 0; i < spikes * 2; i++) {
          const rad = i % 2 === 0 ? outerR : innerR
          const angle = (Math.PI / spikes) * i - Math.PI / 2
          const px = Math.cos(angle) * rad
          const py = by + Math.sin(angle) * rad
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.fill()
      } else if (badge === 'PRO') {
        ctx.font = 'bold 11px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const textW = ctx.measureText('PRO').width
        const pw = textW + 16
        const ph = 17
        ctx.beginPath()
        ctx.moveTo(-pw / 2 + 8, by - ph / 2)
        ctx.arcTo(pw / 2, by - ph / 2, pw / 2, by + ph / 2, 8)
        ctx.arcTo(pw / 2, by + ph / 2, -pw / 2, by + ph / 2, 8)
        ctx.arcTo(-pw / 2, by + ph / 2, -pw / 2, by - ph / 2, 8)
        ctx.arcTo(-pw / 2, by - ph / 2, pw / 2, by - ph / 2, 8)
        ctx.closePath()
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fill()
        ctx.strokeStyle = rim
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = accent
        ctx.fillText('PRO', 0, by + 1)
      }
      if (unmirror) ctx.restore()
    }

    function drawBossAntennae(style, colorA, accent, accentRgb, rim, w, h) {
      const baseY = -h / 2

      if (style.id === 'noob') {
        // lopsided: one long crooked antenna, one stubby afterthought
        ctx.strokeStyle = rim
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(-w * 0.15, baseY)
        ctx.lineTo(-w * 0.28, baseY - 18)
        ctx.lineTo(-w * 0.11, baseY - 30)
        ctx.moveTo(w * 0.2, baseY)
        ctx.lineTo(w * 0.25, baseY - 9)
        ctx.stroke()
        ctx.fillStyle = rim
        ctx.beginPath()
        ctx.arc(-w * 0.11, baseY - 30, 4.6, 0, Math.PI * 2)
        ctx.fill()
      } else if (style.id === 'principiante') {
        // plain, straight, perfectly symmetric — the basic default
        ctx.strokeStyle = rim
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(-w * 0.22, baseY)
        ctx.lineTo(-w * 0.22, baseY - 24)
        ctx.moveTo(w * 0.22, baseY)
        ctx.lineTo(w * 0.22, baseY - 24)
        ctx.stroke()
        ctx.fillStyle = accent
        ctx.beginPath()
        ctx.arc(-w * 0.22, baseY - 24, 5, 0, Math.PI * 2)
        ctx.arc(w * 0.22, baseY - 24, 5, 0, Math.PI * 2)
        ctx.fill()
      } else if (style.id === 'competente') {
        // wooden rabbit-ear V, meeting at a single base like an old TV set
        ctx.strokeStyle = rim
        ctx.lineWidth = 5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(0, baseY)
        ctx.lineTo(-w * 0.26, baseY - 28)
        ctx.moveTo(0, baseY)
        ctx.lineTo(w * 0.26, baseY - 28)
        ctx.stroke()
        ctx.fillStyle = rim
        ctx.beginPath()
        ctx.arc(0, baseY, 4.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = accent
        ctx.beginPath()
        ctx.arc(-w * 0.26, baseY - 28, 4.2, 0, Math.PI * 2)
        ctx.arc(w * 0.26, baseY - 28, 4.2, 0, Math.PI * 2)
        ctx.fill()
      } else if (style.id === 'avanzado') {
        // straight glowing neon tubes with a soft halo
        const glowT = 0.6 + Math.sin(performance.now() / 200) * 0.4
        for (const side of [-1, 1]) {
          const bx = side * w * 0.22
          const tx = side * w * 0.3
          const ty = baseY - 28
          ctx.strokeStyle = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},${0.25 + glowT * 0.3})`
          ctx.lineWidth = 7
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(bx, baseY)
          ctx.lineTo(tx, ty)
          ctx.stroke()
          ctx.strokeStyle = accent
          ctx.lineWidth = 2.2
          ctx.beginPath()
          ctx.moveTo(bx, baseY)
          ctx.lineTo(tx, ty)
          ctx.stroke()
          ctx.fillStyle = accent
          ctx.beginPath()
          ctx.arc(tx, ty, 3.4, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (style.id === 'experto') {
        // chrome telescoping segments, tapering toward the tip
        const widths = [3.8, 2.7, 1.8]
        for (const side of [-1, 1]) {
          const bx = side * w * 0.22
          let y = baseY
          const segH = 9
          for (const segW of widths) {
            const grad = ctx.createLinearGradient(bx - segW / 2, 0, bx + segW / 2, 0)
            grad.addColorStop(0, '#7d848f')
            grad.addColorStop(0.5, '#f2f5f8')
            grad.addColorStop(1, '#7d848f')
            ctx.fillStyle = grad
            ctx.fillRect(bx - segW / 2, y - segH, segW, segH)
            y -= segH
          }
          ctx.fillStyle = accent
          ctx.beginPath()
          ctx.arc(bx, y - 2, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (style.id === 'elite') {
        // elegant curved wire tipped with a little gem
        for (const side of [-1, 1]) {
          const bx = side * w * 0.2
          const tx = side * w * 0.32
          const ty = baseY - 30
          ctx.strokeStyle = rim
          ctx.lineWidth = 2.4
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(bx, baseY)
          ctx.quadraticCurveTo(side * w * 0.4, baseY - 16, tx, ty)
          ctx.stroke()
          ctx.save()
          ctx.translate(tx, ty)
          ctx.rotate(Math.PI / 4)
          ctx.fillStyle = accent
          ctx.fillRect(-3.6, -3.6, 7.2, 7.2)
          ctx.restore()
        }
      } else if (style.id === 'maestro') {
        // twisted gold filigree with a tiny jeweled tip
        for (const side of [-1, 1]) {
          const bx = side * w * 0.22
          ctx.strokeStyle = shadeColor(colorA, 35)
          ctx.lineWidth = 3
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(bx, baseY)
          for (let t = 0.1; t <= 1; t += 0.1) {
            const yy = baseY - t * 28
            const xx = bx + Math.sin(t * Math.PI * 3) * 4 * side
            ctx.lineTo(xx, yy)
          }
          ctx.stroke()
          ctx.fillStyle = accent
          ctx.beginPath()
          ctx.arc(bx, baseY - 28, 4.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = 'rgba(255,255,255,0.85)'
          ctx.beginPath()
          ctx.arc(bx - 1.5, baseY - 29.5, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (style.id === 'leyenda') {
        // holographic wire topped with a little sparkle star
        const mixT = (Math.sin(performance.now() / 700) + 1) / 2
        for (const side of [-1, 1]) {
          const bx = side * w * 0.22
          const tx = side * w * 0.3
          const ty = baseY - 27
          ctx.strokeStyle = mixHexColors(colorA, accent, mixT)
          ctx.lineWidth = 2.4
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(bx, baseY)
          ctx.lineTo(tx, ty)
          ctx.stroke()
          ctx.save()
          ctx.translate(tx, ty)
          ctx.fillStyle = accent
          ctx.beginPath()
          const outerR = 6
          const innerR = 1.8
          for (let i = 0; i < 8; i++) {
            const rad = i % 2 === 0 ? outerR : innerR
            const angle = (Math.PI / 4) * i
            const px = Math.cos(angle) * rad
            const py = Math.sin(angle) * rad
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
      } else if (style.id === 'pro') {
        // futuristic segmented mast with a blinking LED and a signal arc
        const blink = Math.sin(performance.now() / 150) > 0
        for (const side of [-1, 1]) {
          const bx = side * w * 0.2
          const midY = baseY - 14
          const topY = baseY - 30
          ctx.strokeStyle = '#aeb4bd'
          ctx.lineWidth = 3
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(bx, baseY)
          ctx.lineTo(bx, midY)
          ctx.stroke()
          ctx.strokeStyle = accent
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(bx, midY)
          ctx.lineTo(bx, topY)
          ctx.stroke()
          ctx.fillStyle = blink ? accent : shadeColor(accent, -60)
          ctx.beginPath()
          ctx.arc(bx, topY, 3.2, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.6)`
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.arc(bx, topY, 7, Math.PI * 1.2, Math.PI * 1.8)
          ctx.stroke()
        }
      } else {
        // amateur (and any unmatched style) — the friendly curved default with a little highlight bobble
        ctx.strokeStyle = rim
        ctx.lineWidth = 4
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(-w * 0.22, baseY)
        ctx.quadraticCurveTo(-w * 0.34, baseY - 14, -w * 0.3, baseY - 26)
        ctx.moveTo(w * 0.22, baseY)
        ctx.quadraticCurveTo(w * 0.34, baseY - 14, w * 0.3, baseY - 26)
        ctx.stroke()
        ctx.fillStyle = accent
        ctx.beginPath()
        ctx.arc(-w * 0.3, baseY - 29, 7.5, 0, Math.PI * 2)
        ctx.arc(w * 0.3, baseY - 29, 7.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.beginPath()
        ctx.arc(-w * 0.3 - 2.4, baseY - 31.4, 2.4, 0, Math.PI * 2)
        ctx.arc(w * 0.3 - 2.4, baseY - 31.4, 2.4, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function drawBossEyeRound(x, y, r, color, outline) {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = Math.max(1.4, r * 0.22)
      ctx.strokeStyle = outline
      ctx.stroke()
      ctx.fillStyle = shadeColor(color, -55)
      ctx.beginPath()
      ctx.arc(x, y, r * 0.45, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.beginPath()
      ctx.arc(x - r * 0.3, y - r * 0.32, r * 0.25, 0, Math.PI * 2)
      ctx.fill()
    }

    function drawBossEyeX(x, y, r, color, lineWidth, outline) {
      // draw a wider outline stroke underneath, then the thinner colored X on top
      ctx.strokeStyle = outline
      ctx.lineWidth = lineWidth + 2.4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x - r, y - r)
      ctx.lineTo(x + r, y + r)
      ctx.moveTo(x + r, y - r)
      ctx.lineTo(x - r, y + r)
      ctx.stroke()

      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x - r, y - r)
      ctx.lineTo(x + r, y + r)
      ctx.moveTo(x + r, y - r)
      ctx.lineTo(x - r, y + r)
      ctx.stroke()
    }

    function drawBoss() {
      if (boss.state === 'dead') return
      const style = BOSS_STYLES[bossStyleRef.current] || BOSS_STYLES[0]
      const colorA = bossColorARef.current || style.colorA
      const colorB = bossColorBRef.current || style.colorB
      const accent = colorB
      const rim = shadeColor(colorA, -40)
      const accentRgb = hexToRgb(accent)
      const cx = boss.x + boss.w / 2
      const cy = boss.y + boss.h / 2

      const groundY = 500
      const shadowScale = Math.max(0.35, 1 - Math.max(0, groundY - (boss.y + boss.h)) / 300)
      ctx.save()
      ctx.translate(cx, groundY + 4)
      ctx.scale(shadowScale, 0.3 * shadowScale)
      ctx.beginPath()
      ctx.fillStyle = `rgba(0,0,0,${0.35 * shadowScale})`
      ctx.arc(0, 0, boss.w * 0.55, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      const pulse = boss.state === 'telegraph' ? 1 + Math.sin(performance.now() / 40) * 0.05 : 1

      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(boss.facing * pulse, pulse)

      const w = boss.w
      const h = boss.h

      // orbiting particles, for the flashiest tiers
      if (style.particles) {
        const t = performance.now() / 900
        for (let i = 0; i < style.particles; i++) {
          const a = t + (i / style.particles) * Math.PI * 2
          const px = Math.cos(a) * w * 0.68
          const py = Math.sin(a) * h * 0.62
          const tw = 0.5 + Math.sin(t * 3 + i) * 0.5
          ctx.fillStyle = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},${0.4 + tw * 0.5})`
          ctx.beginPath()
          ctx.arc(px, py, 2 + tw * 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // aura strength varies per style — noob tier has none, pro tiers glow strongly
      if (style.aura > 0) {
        const auraGrad = ctx.createRadialGradient(0, 0, w * 0.2, 0, 0, w * 0.78)
        auraGrad.addColorStop(0, `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},${style.aura})`)
        auraGrad.addColorStop(1, `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0)`)
        ctx.fillStyle = auraGrad
        ctx.beginPath()
        ctx.arc(0, 0, w * 0.78, 0, Math.PI * 2)
        ctx.fill()
      }

      // antennae — a distinct design per boss skin
      drawBossAntennae(style, colorA, accent, accentRgb, rim, w, h)

      if (style.badge) drawBossBadge(style.badge, rim, accent, h, boss.facing)

      // body — a television frame, shape/material varies by style (rounder corners read as cuter)
      ctx.beginPath()
      const r = style.crooked ? 10 : 26
      ctx.moveTo(-w / 2 + r, -h / 2)
      ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r)
      ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r)
      ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r)
      ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r)
      ctx.closePath()

      if (style.holo) {
        // holographic crossfade between the two chosen colors, instead of a fixed hue rotation
        const mixT = (Math.sin(performance.now() / 700) + 1) / 2
        const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
        grad.addColorStop(0, mixHexColors(colorA, colorB, mixT))
        grad.addColorStop(1, mixHexColors(colorB, colorA, mixT))
        ctx.fillStyle = grad
        ctx.globalAlpha = 0.85
        ctx.fill()
        ctx.globalAlpha = 1
      } else {
        const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
        grad.addColorStop(0, shadeColor(colorA, 20))
        grad.addColorStop(1, shadeColor(colorA, -20))
        ctx.fillStyle = grad
        ctx.fill()
      }

      if (style.wood) {
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'
        ctx.lineWidth = 2
        for (let gy = -h / 2 + 14; gy < h / 2 - 10; gy += 11) {
          ctx.beginPath()
          ctx.moveTo(-w / 2 + 6, gy)
          ctx.lineTo(w / 2 - 6, gy + 3)
          ctx.stroke()
        }
      }

      if (boss.hitFlash > 0) {
        ctx.globalAlpha = boss.hitFlash * 0.7
        ctx.fillStyle = '#ffffff'
        ctx.fill()
        ctx.globalAlpha = 1
      }

      if (style.chrome) {
        const glare = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2)
        glare.addColorStop(0, 'rgba(255,255,255,0.55)')
        glare.addColorStop(0.25, 'rgba(255,255,255,0)')
        glare.addColorStop(0.55, 'rgba(255,255,255,0)')
        glare.addColorStop(0.7, 'rgba(255,255,255,0.35)')
        glare.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = glare
        ctx.fill()
      }

      // bezel rim — neon tiers get an extra glow pass
      if (style.neon) {
        ctx.lineWidth = 6
        ctx.strokeStyle = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.35)`
        ctx.stroke()
      }
      ctx.lineWidth = style.gold ? 4 : 3
      ctx.strokeStyle = style.crooked ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.55)'
      ctx.stroke()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = rim
      ctx.stroke()

      // control knobs — the noob skin skips this detail entirely
      if (!style.crooked) {
        ctx.fillStyle = rim
        ctx.beginPath()
        ctx.arc(-w / 2 + 9, h * 0.32, 6, 0, Math.PI * 2)
        ctx.arc(w / 2 - 9, h * 0.32, 6, 0, Math.PI * 2)
        ctx.fill()
      }

      // power LED
      const ledPulse = 0.6 + Math.sin(performance.now() / 300) * 0.4
      ctx.fillStyle = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},${ledPulse})`
      ctx.beginPath()
      ctx.arc(w / 2 - 16, h / 2 - 10, 3, 0, Math.PI * 2)
      ctx.fill()

      // eye strip, above the screen — thinner bezels so the screen shows more of the image
      const eyesStripH = h * 0.17
      const bottomStripH = h * 0.13
      const screenX = -w * 0.41
      const screenY = -h / 2 + eyesStripH
      const screenW = w * 0.82
      const screenH = h - eyesStripH - bottomStripH

      const eyeGlow = 0.85 + Math.sin(performance.now() / 220) * 0.15
      const eyeY = -h / 2 + eyesStripH / 2
      const eyeR = w * 0.09
      const eyeLineWidth = Math.max(2.6, w * 0.032)
      if (!style.crooked) {
        for (const [ex, er] of [
          [-w * 0.16, eyeR * 1.9],
          [w * 0.16, eyeR * 1.4],
        ]) {
          const eg = ctx.createRadialGradient(ex, eyeY, 1, ex, eyeY, er)
          eg.addColorStop(0, `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},${eyeGlow * 0.45})`)
          eg.addColorStop(1, `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0)`)
          ctx.fillStyle = eg
          ctx.beginPath()
          ctx.arc(ex, eyeY, er, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      // "O x" eyes — round eye on the left, a smaller x on the right
      drawBossEyeRound(-w * 0.16, eyeY, eyeR, accent, rim)
      drawBossEyeX(w * 0.16, eyeY, eyeR * 0.6, accent, eyeLineWidth, rim)

      // screen — shows the uploaded image, or a soft glow if none was set.
      // Un-mirror it when the boss faces left so the logo never flips/rotates with the body
      // (the screen rect is symmetric about x=0, so flipping x here keeps it in the same spot).
      if (boss.facing < 0) {
        ctx.save()
        ctx.scale(-1, 1)
        drawBossScreen(screenX, screenY, screenW, screenH, accent)
        ctx.restore()
      } else {
        drawBossScreen(screenX, screenY, screenW, screenH, accent)
      }

      // blush cheeks, below the screen — the thing that reads as "cute" more than anything else
      const blushY = h / 2 - bottomStripH / 2
      ctx.fillStyle = 'rgba(255,120,150,0.4)'
      ctx.beginPath()
      ctx.ellipse(-w * 0.3, blushY, w * 0.07, h * 0.035, 0, 0, Math.PI * 2)
      ctx.ellipse(w * 0.3, blushY, w * 0.07, h * 0.035, 0, 0, Math.PI * 2)
      ctx.fill()

      // small friendly smile, below the screen
      ctx.strokeStyle = rim
      ctx.lineWidth = 3.4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(0, blushY - 2, w * 0.13, 0.12 * Math.PI, 0.88 * Math.PI)
      ctx.stroke()

      ctx.restore()
    }

    function drawBossScreen(screenX, screenY, screenW, screenH, accent = '#5ec8ff') {
      const sr = 10
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(screenX + sr, screenY)
      ctx.arcTo(screenX + screenW, screenY, screenX + screenW, screenY + screenH, sr)
      ctx.arcTo(screenX + screenW, screenY + screenH, screenX, screenY + screenH, sr)
      ctx.arcTo(screenX, screenY + screenH, screenX, screenY, sr)
      ctx.arcTo(screenX, screenY, screenX + screenW, screenY, sr)
      ctx.closePath()
      ctx.clip()

      const img = bossImageRef.current
      if (img && img.naturalWidth > 0) {
        // stretched to fill the screen exactly: no crop, no letterbox bars, adapts to any
        // image size — upload one close to the ~1.21:1 screen ratio to avoid visible stretching
        ctx.drawImage(img, screenX, screenY, screenW, screenH)
      } else {
        const grad = ctx.createLinearGradient(screenX, screenY, screenX, screenY + screenH)
        grad.addColorStop(0, shadeColor(accent, -55))
        grad.addColorStop(1, '#0c1118')
        ctx.fillStyle = grad
        ctx.fillRect(screenX, screenY, screenW, screenH)
      }

      // glass glare
      const glareGrad = ctx.createLinearGradient(screenX, screenY, screenX + screenW * 0.5, screenY + screenH)
      glareGrad.addColorStop(0, 'rgba(255,255,255,0.22)')
      glareGrad.addColorStop(0.35, 'rgba(255,255,255,0)')
      ctx.fillStyle = glareGrad
      ctx.beginPath()
      ctx.moveTo(screenX, screenY)
      ctx.lineTo(screenX + screenW * 0.55, screenY)
      ctx.lineTo(screenX + screenW * 0.2, screenY + screenH)
      ctx.lineTo(screenX, screenY + screenH)
      ctx.closePath()
      ctx.fill()

      ctx.restore()
    }

    function drawBossNameplate() {
      if (boss.state === 'dead') return
      const name = (bossNameRef.current || 'JEFE').toUpperCase()
      const cx = boss.x + boss.w / 2
      const py = boss.y + boss.h + 12

      ctx.save()
      ctx.font = 'bold 13px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const textW = ctx.measureText(name).width
      const plateW = textW + 22
      const plateH = 20
      const px = cx - plateW / 2
      const pr = 9

      ctx.beginPath()
      ctx.moveTo(px + pr, py)
      ctx.arcTo(px + plateW, py, px + plateW, py + plateH, pr)
      ctx.arcTo(px + plateW, py + plateH, px, py + plateH, pr)
      ctx.arcTo(px, py + plateH, px, py, pr)
      ctx.arcTo(px, py, px + plateW, py, pr)
      ctx.closePath()
      ctx.fillStyle = 'rgba(10,16,24,0.75)'
      ctx.fill()
      ctx.lineWidth = 1.4
      ctx.strokeStyle = 'rgba(94,200,255,0.6)'
      ctx.stroke()

      ctx.fillStyle = '#dff0ff'
      ctx.fillText(name, cx, py + plateH / 2 + 1)
      ctx.restore()
    }

    function drawSponsorTicker() {
      const msg = bossMessageRef.current.trim()
      if (!msg) return

      const barW = 460
      const barH = 20
      const barX = WORLD_W / 2 - barW / 2
      const barY = 42

      ctx.save()
      ctx.beginPath()
      ctx.rect(barX, barY, barW, barH)
      ctx.clip()
      ctx.fillStyle = 'rgba(10,16,24,0.6)'
      ctx.fillRect(barX, barY, barW, barH)

      ctx.font = '12px ui-monospace, monospace'
      ctx.fillStyle = '#bfe6ff'
      ctx.textBaseline = 'middle'
      const full = `●  ${msg}  `
      const textW = ctx.measureText(full).width
      if (textW > 0) {
        let x = tickerOffset % textW
        if (x > 0) x -= textW
        for (let dx = x; dx < barW + textW; dx += textW) {
          ctx.fillText(full, barX + dx, barY + barH / 2 + 1)
        }
      }
      ctx.restore()

      ctx.strokeStyle = 'rgba(94,200,255,0.4)'
      ctx.lineWidth = 1
      ctx.strokeRect(barX, barY, barW, barH)
    }

    function drawBossBullets() {
      for (const b of bossBullets) {
        ctx.save()
        ctx.translate(b.x, b.y)
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 9)
        grad.addColorStop(0, '#ffb3e6')
        grad.addColorStop(0.5, '#a83ad1')
        grad.addColorStop(1, 'rgba(120,20,140,0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(0, 0, 9, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    function drawShockwaves() {
      for (const s of shockwaves) {
        const t = 1 - s.life / s.maxLife
        ctx.save()
        ctx.translate(s.x, s.y)
        ctx.scale(1, 0.35)
        ctx.strokeStyle = `rgba(255,180,90,${1 - t})`
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.arc(0, 0, t * 220, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
    }

    function drawSpikeWarning() {
      if (boss.state !== 'spikeTelegraph') return
      const pulse = 0.55 + Math.sin(performance.now() / 55) * 0.35
      ctx.save()
      ctx.translate(boss.spikeTargetX, 500)
      ctx.scale(1, 0.35)
      ctx.fillStyle = `rgba(255,60,60,${pulse * 0.2})`
      ctx.beginPath()
      ctx.arc(0, 0, SPIKE_RADIUS, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = `rgba(255,70,70,${pulse})`
      ctx.lineWidth = 4
      ctx.stroke()
      ctx.restore()
    }

    function drawSpikes() {
      for (const s of spikes) {
        const t = s.life / s.maxLife
        ctx.save()
        ctx.translate(s.x, 500)
        ctx.fillStyle = `rgba(220,60,50,${t})`
        for (let i = -2; i <= 2; i++) {
          const sx = i * 16
          const height = 50 * t * (1 - Math.abs(i) * 0.12)
          ctx.beginPath()
          ctx.moveTo(sx - 8, 4)
          ctx.lineTo(sx, -height)
          ctx.lineTo(sx + 8, 4)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      }
    }

    function drawLaserWarning() {
      if (boss.state !== 'laserTelegraph') return
      const pulse = 0.35 + Math.sin(performance.now() / 45) * 0.25
      ctx.fillStyle = `rgba(255,70,70,${pulse * 0.35})`
      ctx.fillRect(0, boss.laserY - LASER_HEIGHT_BAND / 2, WORLD_W, LASER_HEIGHT_BAND)
      ctx.strokeStyle = `rgba(255,90,90,${pulse + 0.3})`
      ctx.lineWidth = 2
      ctx.setLineDash([10, 8])
      ctx.beginPath()
      ctx.moveTo(0, boss.laserY)
      ctx.lineTo(WORLD_W, boss.laserY)
      ctx.stroke()
      ctx.setLineDash([])
    }

    function drawLaserBeam() {
      if (boss.state !== 'laserFire') return
      const grad = ctx.createLinearGradient(0, boss.laserY - LASER_HEIGHT_BAND / 2, 0, boss.laserY + LASER_HEIGHT_BAND / 2)
      grad.addColorStop(0, 'rgba(255,120,90,0)')
      grad.addColorStop(0.5, 'rgba(255,200,140,0.95)')
      grad.addColorStop(1, 'rgba(255,120,90,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, boss.laserY - LASER_HEIGHT_BAND / 2, WORLD_W, LASER_HEIGHT_BAND)
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillRect(0, boss.laserY - 2, WORLD_W, 4)
    }

    function drawBullets() {
      for (const b of bullets) {
        ctx.save()
        ctx.translate(b.x, b.y)
        ctx.rotate(Math.atan2(b.vy, b.vx))
        ctx.beginPath()
        ctx.moveTo(15, 0)
        ctx.quadraticCurveTo(4, 5.5, -14, 0)
        ctx.quadraticCurveTo(4, -5.5, 15, 0)
        ctx.closePath()
        ctx.fillStyle = '#ffe14d'
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = '#ff8c1a'
        ctx.stroke()
        ctx.restore()
      }
    }

    function drawFlashes() {
      for (const f of flashes) {
        const t = f.life / f.maxLife
        ctx.save()
        ctx.translate(f.x, f.y)
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 12)
        grad.addColorStop(0, `rgba(255,244,200,${t})`)
        grad.addColorStop(1, 'rgba(255,180,80,0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(0, 0, 12 * t + 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    function drawParticles() {
      for (const pt of particles) {
        const t = pt.life / pt.maxLife
        ctx.fillStyle = `rgba(255,255,255,${t * 0.7})`
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, pt.size * t, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function drawHealthBars() {
      const pbx = 20
      const pby = 18
      const pbw = 220
      const pbh = 16
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(pbx - 3, pby - 3, pbw + 6, pbh + 6)
      ctx.fillStyle = '#3a1414'
      ctx.fillRect(pbx, pby, pbw, pbh)
      const pFrac = Math.max(0, player.hp / PLAYER_MAX_HP)
      ctx.fillStyle = pFrac > 0.3 ? '#4fd15f' : '#e2483b'
      ctx.fillRect(pbx, pby, pbw * pFrac, pbh)
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(pbx, pby, pbw, pbh)
      ctx.fillStyle = '#fff'
      ctx.font = '11px ui-monospace, monospace'
      ctx.fillText('TÚ', pbx, pby - 6)

      ctx.font = 'bold 11px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const pHpText = `${Math.round(player.hp)} / ${PLAYER_MAX_HP}`
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'
      ctx.strokeText(pHpText, pbx + pbw / 2, pby + pbh / 2 + 1)
      ctx.fillStyle = '#fff'
      ctx.fillText(pHpText, pbx + pbw / 2, pby + pbh / 2 + 1)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'

      if (boss.state !== 'dead') {
        const bbw = 320
        const bbh = 16
        const bbx = WORLD_W / 2 - bbw / 2
        const bby = 18
        ctx.fillStyle = 'rgba(0,0,0,0.45)'
        ctx.fillRect(bbx - 3, bby - 3, bbw + 6, bbh + 6)
        ctx.fillStyle = '#2a1420'
        ctx.fillRect(bbx, bby, bbw, bbh)
        const bFrac = Math.max(0, boss.hp / boss.maxHp)
        ctx.fillStyle = '#c23b6a'
        ctx.fillRect(bbx, bby, bbw * bFrac, bbh)
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.strokeRect(bbx, bby, bbw, bbh)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 12px ui-monospace, monospace'
        ctx.textAlign = 'center'
        const diffName = getDifficultyParams(diffRef.current).name
        const bossLabel = (bossNameRef.current || 'JEFE').toUpperCase()
        ctx.fillText(`${bossLabel} · ${diffName}`, WORLD_W / 2, bby - 6)

        ctx.font = 'bold 11px ui-monospace, monospace'
        ctx.textBaseline = 'middle'
        const bHpText = `${Math.round(boss.hp)} / ${boss.maxHp}`
        ctx.lineWidth = 3
        ctx.strokeStyle = 'rgba(0,0,0,0.7)'
        ctx.strokeText(bHpText, bbx + bbw / 2, bby + bbh / 2 + 1)
        ctx.fillStyle = '#fff'
        ctx.fillText(bHpText, bbx + bbw / 2, bby + bbh / 2 + 1)
        ctx.textBaseline = 'alphabetic'
        ctx.textAlign = 'left'
      }
    }

    function drawDeathOverlay() {
      const a = getDeathOverlayAlpha()
      if (a <= 0.001) return
      ctx.save()
      ctx.fillStyle = `rgba(8,2,4,${a * 0.88})`
      ctx.fillRect(0, 0, WORLD_W, WORLD_H)
      ctx.restore()
    }

    function drawMessage() {
      if (!message) return
      const alpha = message.useDeathFade
        ? getDeathOverlayAlpha()
        : Math.min(1, message.timer / message.maxTimer * 2)
      if (alpha <= 0.001) return
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = message.color
      ctx.font = 'bold 48px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'
      ctx.lineWidth = 6
      ctx.strokeText(message.text, WORLD_W / 2, WORLD_H / 2 - 50)
      ctx.fillText(message.text, WORLD_W / 2, WORLD_H / 2 - 50)

      if (message.subtitle) {
        ctx.font = '600 17px ui-monospace, monospace'
        ctx.fillStyle = '#ffd9d9'
        ctx.lineWidth = 4
        ctx.strokeText(message.subtitle, WORLD_W / 2, WORLD_H / 2 + 2)
        ctx.fillText(message.subtitle, WORLD_W / 2, WORLD_H / 2 + 2)
      }

      if (message.tip) {
        ctx.font = '14px ui-monospace, monospace'
        ctx.fillStyle = '#ffe9b0'
        ctx.lineWidth = 4
        ctx.strokeText(message.tip, WORLD_W / 2, WORLD_H / 2 + 34)
        ctx.fillText(message.tip, WORLD_W / 2, WORLD_H / 2 + 34)
      }

      ctx.restore()
    }

    function drawCrosshair() {
      const styleId = CROSSHAIR_STYLES[crosshairStyleRef.current]?.id || 'cruz'
      const color = crosshairColorRef.current
      const mx = mouse.x
      const my = mouse.y

      ctx.save()
      ctx.lineCap = 'round'

      // dark outline pass first, so the crosshair stays visible on light backgrounds too
      for (const pass of ['outline', 'color']) {
        ctx.strokeStyle = pass === 'outline' ? 'rgba(0,0,0,0.55)' : color
        ctx.fillStyle = pass === 'outline' ? 'rgba(0,0,0,0.55)' : color
        ctx.lineWidth = pass === 'outline' ? 3.4 : 1.6

        if (styleId === 'cruz') {
          const gap = 5
          const arm = 8
          ctx.beginPath()
          ctx.moveTo(mx - gap - arm, my)
          ctx.lineTo(mx - gap, my)
          ctx.moveTo(mx + gap, my)
          ctx.lineTo(mx + gap + arm, my)
          ctx.moveTo(mx, my - gap - arm)
          ctx.lineTo(mx, my - gap)
          ctx.moveTo(mx, my + gap)
          ctx.lineTo(mx, my + gap + arm)
          ctx.stroke()
        } else if (styleId === 'circulo') {
          ctx.beginPath()
          ctx.arc(mx, my, 8, 0, Math.PI * 2)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(mx, my, 1.6, 0, Math.PI * 2)
          ctx.fill()
        } else if (styleId === 'diamante') {
          const r = 9
          ctx.beginPath()
          ctx.moveTo(mx, my - r)
          ctx.lineTo(mx + r, my)
          ctx.lineTo(mx, my + r)
          ctx.lineTo(mx - r, my)
          ctx.closePath()
          ctx.stroke()
        } else if (styleId === 'punto') {
          ctx.beginPath()
          ctx.arc(mx, my, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      ctx.restore()
    }

    function render() {
      const deathAlpha = getDeathOverlayAlpha()
      const useBlur = deathAlpha > 0.001
      // Draw the whole world at full speed (no filter) — to the offscreen buffer while the death
      // blur is active, or straight to the visible canvas otherwise.
      ctx = useBlur ? offCtx : mainCtx

      ctx.clearRect(0, 0, WORLD_W, WORLD_H)
      ctx.save()
      const shakeAmt = shakeTrauma * shakeTrauma
      if (shakeAmt > 0.001) {
        ctx.translate(
          (Math.random() * 2 - 1) * SHAKE_MAX_OFFSET * shakeAmt,
          (Math.random() * 2 - 1) * SHAKE_MAX_OFFSET * shakeAmt,
        )
      }
      drawArenaBackground()
      platforms.forEach((p, i) => drawPlatform(p, i === 0))
      drawSpikeWarning()
      drawLaserWarning()
      drawShockwaves()
      drawSpikes()
      drawParticles()
      drawBoss()
      drawBossNameplate()
      drawPlayer()
      drawGun()
      drawWeaponLaserSight()
      drawFlashes()
      drawBossBullets()
      drawLaserBeam()
      ctx.restore()
      // Bullets render outside the shake transform so their flight path stays perfectly straight
      drawBullets()

      if (useBlur) {
        // Single blurred composite pass instead of filtering every individual shape.
        mainCtx.clearRect(0, 0, WORLD_W, WORLD_H)
        mainCtx.filter = `blur(${(deathAlpha * 9).toFixed(1)}px)`
        mainCtx.drawImage(offCanvas, 0, 0, WORLD_W, WORLD_H)
        mainCtx.filter = 'none'
        ctx = mainCtx
      }

      drawHealthBars()
      drawSponsorTicker()
      drawDeathOverlay()
      drawMessage()
      drawCrosshair()
    }

    gameControlsRef.current = { resetFight }

    function loop(now) {
      let dt = (now - lastTime) / 1000
      lastTime = now
      dt = Math.min(dt, 1 / 30)
      update(dt)
      render()
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame((t) => {
      lastTime = t
      animId = requestAnimationFrame(loop)
    })

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('blur', onBlur)
      gameControlsRef.current = null
    }
  }, [])

  return (
    <div className="platformer-stage">
      {/* sileo's theme fills are inverted from their names (theme="light" -> dark "#1a1a1a" toast,
          theme="dark" -> light "#f2f2f2" toast) — "light" is what actually renders a dark toast. */}
      <Toaster position="top-right" theme="light" />
      <canvas ref={canvasRef} className="platformer-canvas" />
      <div className="platformer-controls">
        <div className="platformer-difficulty">
          <label htmlFor="difficulty-select">Dificultad</label>
          <select id="difficulty-select" value={difficultyIndex} onChange={onDifficultyChange}>
            {DIFFICULTIES.map((name, i) => (
              <option key={name} value={i}>
                {i + 1}. {name}
              </option>
            ))}
          </select>
        </div>
        <div className="platformer-customize">
          <label htmlFor="bg-style-select">Fondo</label>
          <select id="bg-style-select" value={bgStyleIndex} onChange={onBgStyleChange}>
            {BACKGROUNDS.map((bg, i) => (
              <option key={bg.id} value={i}>
                {bg.name}
              </option>
            ))}
          </select>
          <input
            type="color"
            className="platformer-color-input"
            title={BACKGROUNDS[bgStyleIndex].hintA}
            aria-label={`Color del fondo: ${BACKGROUNDS[bgStyleIndex].hintA}`}
            value={bgColorA}
            onChange={onBgColorAChange}
          />
          <input
            type="color"
            className="platformer-color-input"
            title={BACKGROUNDS[bgStyleIndex].hintB}
            aria-label={`Color del fondo: ${BACKGROUNDS[bgStyleIndex].hintB}`}
            value={bgColorB}
            onChange={onBgColorBChange}
          />
        </div>
        <div className="platformer-customize">
          <label htmlFor="skin-select">Skin</label>
          <select id="skin-select" value={skinIndex} onChange={onSkinChange}>
            {PLAYER_SKINS.map((skin, i) => (
              <option key={skin.id} value={i}>
                {skin.name}
              </option>
            ))}
          </select>
          <label htmlFor="face-select">Cara</label>
          <select id="face-select" value={faceIndex} onChange={onFaceChange}>
            {FACE_OPTIONS.map((face, i) => (
              <option key={face.id} value={i}>
                {face.name}
              </option>
            ))}
          </select>
          <span className="platformer-customize-label">Color</span>
          <div className="platformer-swatches" role="group" aria-label="Color del personaje">
            {PLAYER_COLORS.map((color, i) => (
              <button
                key={color.id}
                type="button"
                title={color.name}
                aria-label={color.name}
                aria-pressed={colorIndex === i}
                className={`platformer-swatch${colorIndex === i ? ' is-selected' : ''}`}
                style={{ background: color.hex }}
                onClick={() => onColorChange(i)}
              />
            ))}
          </div>
        </div>
        <div className="platformer-customize">
          <label htmlFor="gun-level-select">Arma</label>
          <select id="gun-level-select" value={gunLevelIndex} onChange={onGunLevelChange}>
            {GUN_LEVELS.map((lvl, i) => (
              <option key={lvl.id} value={i}>
                {lvl.name}
              </option>
            ))}
          </select>
          <span className="platformer-customize-label">
            Daño {GUN_LEVELS[gunLevelIndex].damage} · Cadencia {GUN_LEVELS[gunLevelIndex].fireRate.toFixed(2)}s
          </span>
        </div>
        <div className="platformer-customize">
          <label htmlFor="boss-name-input">Nombre del jefe</label>
          <input
            id="boss-name-input"
            type="text"
            maxLength={20}
            placeholder="JEFE"
            value={bossName}
            onChange={onBossNameChange}
            onBlur={onBossNameBlur}
          />
        </div>
        <div className="platformer-customize">
          <label htmlFor="boss-style-select">Estilo</label>
          <select id="boss-style-select" value={bossStyleIndex} onChange={onBossStyleChange}>
            {BOSS_STYLES.map((style, i) => (
              <option key={style.id} value={i}>
                {style.name}
              </option>
            ))}
          </select>
        </div>
        <div className="platformer-customize">
          <span className="platformer-customize-label">Colores</span>
          <input
            type="color"
            className="platformer-color-input"
            title="Color A (cuerpo)"
            aria-label="Color A del jefe (cuerpo)"
            value={bossColorA}
            onChange={onBossColorAChange}
          />
          <input
            type="color"
            className="platformer-color-input"
            title="Color B (acentos)"
            aria-label="Color B del jefe (acentos)"
            value={bossColorB}
            onChange={onBossColorBChange}
          />
        </div>
        <div className="platformer-customize">
          <label htmlFor="crosshair-style-select">Mira</label>
          <select id="crosshair-style-select" value={crosshairStyleIndex} onChange={onCrosshairStyleChange}>
            {CROSSHAIR_STYLES.map((style, i) => (
              <option key={style.id} value={i}>
                {style.name}
              </option>
            ))}
          </select>
          <input
            type="color"
            className="platformer-color-input"
            title="Color de la mira"
            aria-label="Color de la mira"
            value={crosshairColor}
            onChange={onCrosshairColorChange}
          />
        </div>
        <div className="platformer-customize">
          <label htmlFor="boss-message-input">Mensaje</label>
          <input
            id="boss-message-input"
            type="text"
            className="platformer-message-input"
            maxLength={220}
            placeholder="Mensaje del patrocinador"
            value={bossMessage}
            onChange={onBossMessageChange}
            onBlur={onBossMessageBlur}
          />
          <span className="platformer-customize-label">
            {bossMessage.length}/220
          </span>
        </div>
        <div className="platformer-customize">
          <label htmlFor="boss-image-input">Logo del jefe</label>
          <input id="boss-image-input" type="file" accept="image/*" onChange={onBossImageChange} />
          {bossImageName && <span className="platformer-customize-label">{bossImageName}</span>}
          <span className="platformer-customize-label platformer-image-hint">
            La imagen se estira para llenar la pantalla del jefe — usa una de proporción ~1.21:1
            (p. ej. 500×414 o 600×497 px) para que no se vea deformada.
          </span>
        </div>
      </div>
      <p className="platformer-hint">
        WASD / Flechas para moverte &nbsp;·&nbsp; Espacio para saltar &nbsp;·&nbsp; Click para disparar al jefe
      </p>
    </div>
  )
}
