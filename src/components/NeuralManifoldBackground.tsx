/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

/**
 * Continuously Animated Neural Manifold Canvas Background
 * - Deep obsidian violet base (#06010e)
 * - Volumetric breathing radial neon gradients (magenta, electric violet, deep purple)
 * - Procedural cyber-organic wireframe grid undulating with trigonometric wave deformation
 * - Glowing white and neon pink synaptic node junctions with blooming glow
 */
export const NeuralManifoldBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let startTime = performance.now();

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Grid configuration
    const cols = 28;
    const rows = 18;

    const render = (now: number) => {
      const time = (now - startTime) * 0.001; // Continuously incrementing time variable

      // 1. Base Canvas Background: Deep Obsidian Violet (#06010e)
      ctx.fillStyle = '#06010e';
      ctx.fillRect(0, 0, width, height);

      // 2. Volumetric Radial Neon Gradients (breathing & drifting with sine/cosine)
      // Gradient 1: Electric Magenta / Pink
      const g1X = width * (0.35 + 0.22 * Math.sin(time * 0.35));
      const g1Y = height * (0.38 + 0.25 * Math.cos(time * 0.42));
      const g1Radius = Math.max(width, height) * 0.55;
      const grad1 = ctx.createRadialGradient(g1X, g1Y, 0, g1X, g1Y, g1Radius);
      grad1.addColorStop(0, 'rgba(217, 70, 239, 0.22)'); // Magenta
      grad1.addColorStop(0.45, 'rgba(168, 85, 247, 0.10)'); // Purple
      grad1.addColorStop(1, 'rgba(6, 1, 14, 0)');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, width, height);

      // Gradient 2: Electric Violet / Indigo
      const g2X = width * (0.72 + 0.2 * Math.cos(time * 0.28));
      const g2Y = height * (0.62 + 0.22 * Math.sin(time * 0.38));
      const g2Radius = Math.max(width, height) * 0.65;
      const grad2 = ctx.createRadialGradient(g2X, g2Y, 0, g2X, g2Y, g2Radius);
      grad2.addColorStop(0, 'rgba(139, 92, 246, 0.24)'); // Electric Violet
      grad2.addColorStop(0.5, 'rgba(99, 102, 241, 0.12)'); // Deep Purple
      grad2.addColorStop(1, 'rgba(6, 1, 14, 0)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, width, height);

      // Gradient 3: Deep Cyber Cyan Accent Glow
      const g3X = width * (0.5 + 0.28 * Math.sin(time * 0.2 + 2.5));
      const g3Y = height * (0.8 + 0.18 * Math.cos(time * 0.3 + 1.2));
      const g3Radius = Math.max(width, height) * 0.45;
      const grad3 = ctx.createRadialGradient(g3X, g3Y, 0, g3X, g3Y, g3Radius);
      grad3.addColorStop(0, 'rgba(6, 182, 212, 0.12)'); // Cyan glow
      grad3.addColorStop(0.6, 'rgba(15, 7, 26, 0.02)');
      grad3.addColorStop(1, 'rgba(6, 1, 14, 0)');
      ctx.fillStyle = grad3;
      ctx.fillRect(0, 0, width, height);

      // 3. Compute Procedural Cyber-Organic Wireframe Grid Vertices
      const cellW = width / (cols - 1);
      const cellH = height / (rows - 1);
      const vertices: { x: number; y: number; baseI: number; baseJ: number }[][] = [];

      for (let i = 0; i < cols; i++) {
        vertices[i] = [];
        for (let j = 0; j < rows; j++) {
          const baseX = i * cellW;
          const baseY = j * cellH;

          // Wave equation mixing spatial frequency and time
          const wave1 = Math.sin(time * 0.7 + i * 0.28 + j * 0.32);
          const wave2 = Math.cos(time * 0.55 - i * 0.35 + j * 0.22);
          const wave3 = Math.sin(time * 0.9 + (i + j) * 0.2);

          const offsetX = wave1 * 16 + wave2 * 10;
          const offsetY = wave2 * 18 + wave3 * 12;

          vertices[i][j] = {
            x: baseX + offsetX,
            y: baseY + offsetY,
            baseI: i,
            baseJ: j,
          };
        }
      }

      // 4. Render Wireframe Lines with Smooth Quadratic Curves
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.14)'; // Luminous electric violet

      // Draw Horizontal Curve Lines
      for (let j = 0; j < rows; j++) {
        if (!vertices[0]?.[j]) continue;
        ctx.beginPath();
        ctx.moveTo(vertices[0][j].x, vertices[0][j].y);
        for (let i = 0; i < cols - 1; i++) {
          const pCurrent = vertices[i]?.[j];
          const pNext = vertices[i + 1]?.[j];
          if (!pCurrent || !pNext) continue;
          const cpX = (pCurrent.x + pNext.x) / 2;
          const cpY = (pCurrent.y + pNext.y) / 2;
          ctx.quadraticCurveTo(pCurrent.x, pCurrent.y, cpX, cpY);
        }
        if (vertices[cols - 1]?.[j]) {
          ctx.lineTo(vertices[cols - 1][j].x, vertices[cols - 1][j].y);
        }
        ctx.stroke();
      }

      // Draw Vertical Curve Lines
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.12)';
      for (let i = 0; i < cols; i++) {
        if (!vertices[i]?.[0]) continue;
        ctx.beginPath();
        ctx.moveTo(vertices[i][0].x, vertices[i][0].y);
        for (let j = 0; j < rows - 1; j++) {
          const pCurrent = vertices[i]?.[j];
          const pNext = vertices[i]?.[j + 1];
          if (!pCurrent || !pNext) continue;
          const cpX = (pCurrent.x + pNext.x) / 2;
          const cpY = (pCurrent.y + pNext.y) / 2;
          ctx.quadraticCurveTo(pCurrent.x, pCurrent.y, cpX, cpY);
        }
        if (vertices[i]?.[rows - 1]) {
          ctx.lineTo(vertices[i][rows - 1].x, vertices[i][rows - 1].y);
        }
        ctx.stroke();
      }
      ctx.restore();

      // 5. Draw Glowing White & Neon Pink Synaptic Node Junctions with Bloom (shadowBlur = 12)
      ctx.save();
      ctx.shadowBlur = 12;

      for (let i = 1; i < cols - 1; i++) {
        for (let j = 1; j < rows - 1; j++) {
          // Select patterned synaptic nodes
          const isSynapse = (i * 3 + j * 7) % 5 === 0 || (i === 12 && j === 8);
          if (!isSynapse) continue;

          const vertex = vertices[i]?.[j];
          if (!vertex) continue;

          const nodePulse = Math.sin(time * 2.2 + i * 1.5 + j * 0.9);
          const isNeonPink = (i + j) % 2 === 0;

          // Bloom configuration
          if (isNeonPink) {
            ctx.shadowColor = '#f43f5e'; // Vibrant Neon Pink
            ctx.fillStyle = '#fda4af';
          } else {
            ctx.shadowColor = '#a855f7'; // Luminous Electric Purple
            ctx.fillStyle = '#ffffff'; // Pure White Core
          }

          const radius = Math.max(1.8, 2.5 + nodePulse * 1.2);

          ctx.beginPath();
          ctx.arc(vertex.x, vertex.y, radius, 0, Math.PI * 2);
          ctx.fill();

          // Outer synaptic resonance halo
          if (nodePulse > 0.4) {
            ctx.strokeStyle = isNeonPink
              ? `rgba(244, 63, 94, ${0.4 * (nodePulse - 0.4)})`
              : `rgba(168, 85, 247, ${0.45 * (nodePulse - 0.4)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(vertex.x, vertex.y, radius * (2.2 + nodePulse), 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // 6. Traveling Synaptic Impulses across selected manifold arcs
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#38bdf8';
      ctx.fillStyle = '#e0f2fe';

      const impulseCount = 5;
      for (let k = 0; k < impulseCount; k++) {
        const pathRow = (k * 4 + 2) % rows;
        const rawProgress = (time * 0.45 + k * 0.28) % 1;
        const progress = rawProgress < 0 ? rawProgress + 1 : rawProgress;
        const floatI = progress * (cols - 1);
        const indexI = Math.floor(floatI);
        const frac = floatI - indexI;

        if (indexI >= 0 && indexI < cols - 1) {
          const p1 = vertices[indexI]?.[pathRow];
          const p2 = vertices[indexI + 1]?.[pathRow];
          if (p1 && p2) {
            const curX = p1.x + (p2.x - p1.x) * frac;
            const curY = p1.y + (p2.y - p1.y) * frac;

            ctx.beginPath();
            ctx.arc(curX, curY, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      id="neural-manifold-canvas"
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        display: 'block',
      }}
      aria-hidden="true"
    />
  );
};
