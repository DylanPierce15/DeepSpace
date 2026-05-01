/**
 * Visualizer — real-time audio canvas using the Tone.Analyser.
 *
 * mode='waveform'  → time-domain oscilloscope line
 * mode='bars'      → frequency spectrum bar chart
 *
 * Works by reading from analyserRef.current.getValue() each animation frame.
 */

import React, { useRef, useEffect } from 'react'
import { useStudio } from '../hooks/useStudio'

interface Props {
  width?:  number
  height?: number
  mode?:   'waveform' | 'bars'
  color?:  string
}

export function Visualizer({ width = 200, height = 32, mode = 'waveform', color }: Props) {
  const { analyserRef, state } = useStudio()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const w   = canvas.width
    const h   = canvas.height

    const accentColor = color ?? (getComputedStyle(document.documentElement)
      .getPropertyValue('--color-primary').trim() || '#8b5cf6')

    const draw = () => {
      const analyser = analyserRef.current
      ctx.clearRect(0, 0, w, h)

      if (!analyser) {
        // Draw flat line when no audio
        ctx.strokeStyle = `${accentColor}40`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, h / 2)
        ctx.lineTo(w, h / 2)
        ctx.stroke()
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const values = analyser.getValue() as Float32Array

      if (mode === 'waveform') {
        ctx.strokeStyle = accentColor
        ctx.lineWidth   = 1.5
        ctx.shadowBlur  = 4
        ctx.shadowColor = `${accentColor}80`
        ctx.beginPath()
        const step = w / values.length
        values.forEach((v, i) => {
          const x = i * step
          const y = ((v + 1) / 2) * h
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.stroke()
        ctx.shadowBlur = 0
      } else {
        // Frequency bars
        const barCount = 32
        const barW     = w / barCount
        const step     = Math.floor(values.length / barCount)

        for (let i = 0; i < barCount; i++) {
          // Map waveform to rough "energy" per band
          let sum = 0
          for (let j = i * step; j < (i + 1) * step && j < values.length; j++) {
            sum += Math.abs(values[j])
          }
          const energy = sum / step
          const barH   = Math.max(2, energy * h * 1.8)

          const hue = 270 + (i / barCount) * 60  // violet to cyan
          ctx.fillStyle = `hsla(${hue},80%,65%,0.85)`
          ctx.fillRect(i * barW + 1, h - barH, barW - 2, barH)
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyserRef, mode, color])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded"
      style={{ display: 'block', imageRendering: 'pixelated' }}
    />
  )
}
