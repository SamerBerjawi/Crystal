import { useEffect, useRef } from "react"
import createGlobe, { type COBEOptions } from "cobe"
import { useMotionValue, useSpring } from "motion/react"

import { cn } from "@/lib/utils"

const MOVEMENT_DAMPING = 200

const GLOBE_CONFIG: COBEOptions = {
  width: 800,
  height: 800,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: 0,
  theta: 0,
  dark: 0,
  diffuse: 0.4,
  mapSamples: 16000,
  mapBrightness: 1.2,
  baseColor: [1, 1, 1],
  markerColor: [251 / 255, 100 / 255, 21 / 255],
  glowColor: [1, 1, 1],
  markers: [
    { location: [14.5995, 120.9842], size: 0.03 },
    { location: [19.076, 72.8777], size: 0.1 },
    { location: [23.8103, 90.4125], size: 0.05 },
    { location: [30.0444, 31.2357], size: 0.07 },
    { location: [39.9042, 116.4074], size: 0.08 },
    { location: [-23.5505, -46.6333], size: 0.1 },
    { location: [19.4326, -99.1332], size: 0.1 },
    { location: [40.7128, -74.006], size: 0.1 },
    { location: [34.6937, 135.5022], size: 0.05 },
    { location: [41.0082, 28.9784], size: 0.06 },
  ],
}

export function Globe({
  className,
  config = GLOBE_CONFIG,
}: {
  className?: string
  config?: COBEOptions
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const phiRef = useRef(config.phi !== undefined ? config.phi : 0)
  const thetaRef = useRef(config.theta !== undefined ? config.theta : 0)
  const widthRef = useRef(0)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)

  const rPhi = useMotionValue(0)
  const rsPhi = useSpring(rPhi, {
    mass: 0.4,
    damping: 20,
    stiffness: 180,
  })

  const rTheta = useMotionValue(0)
  const rsTheta = useSpring(rTheta, {
    mass: 0.4,
    damping: 20,
    stiffness: 180,
  })

  const updatePointerInteraction = (coords: { x: number; y: number } | null) => {
    pointerInteracting.current = coords
    if (canvasRef.current) {
      canvasRef.current.style.cursor = coords !== null ? "grabbing" : "grab"
    }
  }

  const updateMovement = (clientX: number, clientY: number) => {
    if (pointerInteracting.current !== null) {
      const deltaX = clientX - pointerInteracting.current.x
      const deltaY = clientY - pointerInteracting.current.y
      pointerInteracting.current = { x: clientX, y: clientY }

      rPhi.set(rPhi.get() + deltaX / MOVEMENT_DAMPING)
      rTheta.set(rTheta.get() + deltaY / MOVEMENT_DAMPING)
    }
  }

  useEffect(() => {
    const onResize = () => {
      if (canvasRef.current) {
        widthRef.current = canvasRef.current.offsetWidth
      }
    }

    window.addEventListener("resize", onResize)
    onResize()

    if (config.phi !== undefined) phiRef.current = config.phi
    if (config.theta !== undefined) thetaRef.current = config.theta

    const globe = createGlobe(canvasRef.current!, {
      ...config,
      width: widthRef.current * 2,
      height: widthRef.current * 2,
      phi: phiRef.current,
      theta: thetaRef.current,
      onRender: (state) => {
        state.phi = phiRef.current + rsPhi.get()
        state.theta = Math.max(-1.4, Math.min(1.4, thetaRef.current + rsTheta.get()))
        state.width = widthRef.current * 2
        state.height = widthRef.current * 2
      },
    })

    setTimeout(() => {
      if (canvasRef.current) {
        canvasRef.current.style.opacity = "1"
      }
    }, 0)

    return () => {
      globe.destroy()
      window.removeEventListener("resize", onResize)
    }
  }, [rsPhi, rsTheta, config])


  return (
    <div
      className={cn(
        "relative mx-auto aspect-square w-full max-w-150 flex items-center justify-center overflow-hidden",
        className
      )}
    >
      <canvas
        className={cn(
          "size-full opacity-0 transition-opacity duration-500 contain-[layout_paint_size] cursor-grab active:cursor-grabbing"
        )}
        ref={canvasRef}
        onPointerDown={(e) => {
          updatePointerInteraction({ x: e.clientX, y: e.clientY })
        }}
        onPointerUp={() => updatePointerInteraction(null)}
        onPointerOut={() => updatePointerInteraction(null)}
        onMouseMove={(e) => updateMovement(e.clientX, e.clientY)}
        onTouchMove={(e) =>
          e.touches[0] && updateMovement(e.touches[0].clientX, e.touches[0].clientY)
        }
      />
    </div>
  )
}





