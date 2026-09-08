import { useEffect, useRef } from 'react'
import './PlatformerGame.css'

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

const platforms = [
  { x: 0, y: 500, w: WORLD_W, h: 40 },
  { x: 110, y: 410, w: 150, h: 22 },
  { x: 330, y: 340, w: 150, h: 22 },
  { x: 560, y: 270, w: 130, h: 22 },
  { x: 40, y: 230, w: 110, h: 22 },
  { x: 760, y: 400, w: 160, h: 22 },
  { x: 700, y: 200, w: 150, h: 22 },
]

const approach = (current, target, rate, dt) =>
  current + (target - current) * (1 - Math.exp(-rate * dt))

function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export default function PlatformerGame() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = WORLD_W * dpr
    canvas.height = WORLD_H * dpr
    ctx.scale(dpr, dpr)

    const keys = new Set()
    const onKeyDown = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        e.preventDefault()
      }
      keys.add(e.code)
      if (e.code === 'Space') player.jumpBuffer = JUMP_BUFFER
    }
    const onKeyUp = (e) => keys.delete(e.code)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const player = {
      x: 40,
      y: 458,
      vx: 0,
      vy: 0,
      grounded: false,
      coyoteTimer: 0,
      jumpBuffer: 0,
      facing: 1,
      squashX: 1,
      squashY: 1,
      lean: 0,
      bob: 0,
      runCycle: 0,
      wasGrounded: false,
      dustTimer: 0,
    }

    const particles = []

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

    let animId
    let lastTime = performance.now()

    function update(dt) {
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
    }

    function drawBackground() {
      const grad = ctx.createLinearGradient(0, 0, 0, WORLD_H)
      grad.addColorStop(0, '#7ec8f2')
      grad.addColorStop(1, '#cdeefe')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, WORLD_W, WORLD_H)

      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      const clouds = [
        [120, 80, 40],
        [180, 95, 28],
        [520, 60, 34],
        [580, 78, 24],
        [800, 110, 30],
      ]
      for (const [cx, cy, r] of clouds) {
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.arc(cx + r * 0.8, cy + 6, r * 0.7, 0, Math.PI * 2)
        ctx.arc(cx - r * 0.8, cy + 8, r * 0.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function drawPlatform(p, isGround) {
      ctx.fillStyle = isGround ? '#6b4a2f' : '#8a5a3a'
      ctx.fillRect(p.x, p.y, p.w, p.h)
      ctx.fillStyle = '#5fbf4f'
      ctx.fillRect(p.x, p.y, p.w, 8)
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.fillRect(p.x, p.y + p.h - 3, p.w, 3)
    }

    function drawPlayer() {
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
      const grad = ctx.createLinearGradient(0, -h, 0, 0)
      grad.addColorStop(0, '#ff9a4d')
      grad.addColorStop(1, '#ff6b3d')
      ctx.fillStyle = grad
      const r = 10
      ctx.beginPath()
      ctx.moveTo(-w / 2 + r, -h)
      ctx.arcTo(w / 2, -h, w / 2, 0, r)
      ctx.arcTo(w / 2, 0, -w / 2, 0, r)
      ctx.arcTo(-w / 2, 0, -w / 2, -h, r)
      ctx.arcTo(-w / 2, -h, w / 2, -h, r)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fillRect(-w / 2 + 4, -h + 4, w - 8, 6)

      const eyeOffsetX = player.facing * 6
      ctx.fillStyle = '#241b17'
      ctx.beginPath()
      ctx.arc(eyeOffsetX - 6, -h / 2 - 2, 3.4, 0, Math.PI * 2)
      ctx.arc(eyeOffsetX + 6, -h / 2 - 2, 3.4, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()
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

    function render() {
      ctx.clearRect(0, 0, WORLD_W, WORLD_H)
      drawBackground()
      platforms.forEach((p, i) => drawPlatform(p, i === 0))
      drawParticles()
      drawPlayer()
    }

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
    }
  }, [])

  return (
    <div className="platformer-stage">
      <canvas ref={canvasRef} className="platformer-canvas" />
      <p className="platformer-hint">WASD / Flechas para moverte &nbsp;·&nbsp; Espacio para saltar</p>
    </div>
  )
}
