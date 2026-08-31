/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * 3D Cyber-Organic Neural Manifold Background
 * Built with Three.js WebGL:
 * - Deep obsidian/black base (#05010b) with volumetric atmospheric depth fog
 * - Multiple undulating 3D tubular neural filaments & organic Voronoi-like web lattice
 * - Semi-transparent fine wireframe structures
 * - Glowing synaptic nodes (bright white/pink particles with bloom) attached to vertices
 * - Continuous vertex deformation driven by complex harmonic 3D trigonometric waves
 * - Drifting volumetric light sources in Magenta (#ff0088), Electric Purple (#4400ff), and Cyber Cyan (#00f0ff)
 */
export const NeuralBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. SCENE & CAMERA SETUP
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05010b);
    scene.fog = new THREE.FogExp2(0x05010b, 0.028);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 32);

    // 2. RENDERER SETUP
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 3. VOLUMETRIC LIGHTING SETUP
    const ambientLight = new THREE.AmbientLight(0x1a052e, 1.4);
    scene.add(ambientLight);

    // Light 1: Intense Magenta (#ff0088)
    const lightMagenta = new THREE.PointLight(0xff0088, 5.5, 75);
    scene.add(lightMagenta);

    // Light 2: Electric Purple (#4400ff)
    const lightPurple = new THREE.PointLight(0x4400ff, 6.0, 80);
    scene.add(lightPurple);

    // Light 3: Subtle Cyber Cyan (#00f0ff)
    const lightCyan = new THREE.PointLight(0x00f0ff, 2.8, 60);
    scene.add(lightCyan);

    // Helper: Create Glowing Volumetric Light Sprites for Bloom Depth
    const createGlowSprite = (colorHex: number, size: number, opacity: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      const color = new THREE.Color(colorHex);
      gradient.addColorStop(0, `rgba(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)}, ${opacity})`);
      gradient.addColorStop(0.35, `rgba(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)}, ${opacity * 0.4})`);
      gradient.addColorStop(1, 'rgba(5, 1, 11, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(size, size, 1);
      return sprite;
    };

    const glowMagenta = createGlowSprite(0xff0088, 38, 0.45);
    const glowPurple = createGlowSprite(0x4400ff, 42, 0.48);
    const glowCyan = createGlowSprite(0x00f0ff, 28, 0.35);
    scene.add(glowMagenta);
    scene.add(glowPurple);
    scene.add(glowCyan);

    // 4. PARTICLE TEXTURE FOR SYNAPTIC NODES
    const createSynapseTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); // Bright white core
      gradient.addColorStop(0.2, 'rgba(255, 120, 200, 0.95)'); // Radiant pink bloom
      gradient.addColorStop(0.55, 'rgba(217, 70, 239, 0.4)'); // Magenta halo
      gradient.addColorStop(1, 'rgba(5, 1, 11, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(canvas);
    };
    const synapseTexture = createSynapseTexture();

    // 5. 3D ORGANIC CYBER-ORGANIC STRUCTURES
    interface DeformableMesh {
      mesh: THREE.Mesh | THREE.LineSegments | THREE.Points;
      geometry: THREE.BufferGeometry;
      originalPositions: Float32Array;
      freq: number;
      amp: number;
      speed: number;
      phaseOffset: number;
    }

    const deformableObjects: DeformableMesh[] = [];

    // Shared Wireframe Material
    const wireframeMaterial = new THREE.MeshStandardMaterial({
      color: 0xba68c8,
      wireframe: true,
      transparent: true,
      opacity: 0.32,
      roughness: 0.2,
      metalness: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const wireframeMaterialCyan = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
      roughness: 0.3,
      metalness: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Structure A: Organic Intertwined Neural Torus Knot Manifolds
    const knotGeom1 = new THREE.TorusKnotGeometry(12, 3.8, 140, 28, 2, 3);
    const knotMesh1 = new THREE.Mesh(knotGeom1, wireframeMaterial);
    knotMesh1.position.set(0, 0, -2);
    scene.add(knotMesh1);

    const origPos1 = knotGeom1.attributes.position.array.slice() as Float32Array;
    deformableObjects.push({
      mesh: knotMesh1,
      geometry: knotGeom1,
      originalPositions: origPos1,
      freq: 0.35,
      amp: 1.8,
      speed: 0.7,
      phaseOffset: 0,
    });

    // Structure B: Secondary Inner Organic Neural Manifold
    const knotGeom2 = new THREE.TorusKnotGeometry(9, 2.4, 110, 22, 3, 5);
    const knotMesh2 = new THREE.Mesh(knotGeom2, wireframeMaterialCyan);
    knotMesh2.position.set(0, 0, -1);
    scene.add(knotMesh2);

    const origPos2 = knotGeom2.attributes.position.array.slice() as Float32Array;
    deformableObjects.push({
      mesh: knotMesh2,
      geometry: knotGeom2,
      originalPositions: origPos2,
      freq: 0.45,
      amp: 1.4,
      speed: 0.85,
      phaseOffset: 1.8,
    });

    // Structure C: Undulating 3D Tubular Neural Filaments (Spline Curves)
    const filamentsGroup = new THREE.Group();
    scene.add(filamentsGroup);

    const filamentCount = 6;
    for (let f = 0; f < filamentCount; f++) {
      const angle = (f / filamentCount) * Math.PI * 2;
      const points: THREE.Vector3[] = [];
      const numPoints = 14;

      for (let p = 0; p < numPoints; p++) {
        const u = p / (numPoints - 1);
        const radius = 10 + 6 * Math.sin(u * Math.PI * 2 + angle);
        const px = Math.cos(angle + u * 2.5) * radius;
        const py = Math.sin(angle + u * 2.5) * radius + (u - 0.5) * 20;
        const pz = Math.sin(u * Math.PI * 3 + f) * 12 - 4;
        points.push(new THREE.Vector3(px, py, pz));
      }

      const curve = new THREE.CatmullRomCurve3(points, true);
      const tubeGeom = new THREE.TubeGeometry(curve, 72, 1.1, 10, true);
      const tubeMesh = new THREE.Mesh(
        tubeGeom,
        f % 2 === 0 ? wireframeMaterial : wireframeMaterialCyan
      );
      filamentsGroup.add(tubeMesh);

      const tubeOrigPos = tubeGeom.attributes.position.array.slice() as Float32Array;
      deformableObjects.push({
        mesh: tubeMesh,
        geometry: tubeGeom,
        originalPositions: tubeOrigPos,
        freq: 0.5,
        amp: 1.2,
        speed: 0.9 + f * 0.1,
        phaseOffset: f * 1.1,
      });
    }

    // Structure D: Synaptic Nodes (Glowing Particles along structure vertices)
    const pointsMaterial = new THREE.PointsMaterial({
      map: synapseTexture,
      size: 1.5,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    });

    // Create Synaptic Node Particle Cloud based on main manifold vertices
    const particleCount = 650;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleIndices: number[] = [];

    // Sample vertices from knotGeom1 and knotGeom2
    const totalVertices = origPos1.length / 3;
    const step = Math.max(1, Math.floor(totalVertices / particleCount));

    for (let i = 0; i < particleCount; i++) {
      const vIdx = (i * step) % totalVertices;
      particleIndices.push(vIdx);

      particlePositions[i * 3] = origPos1[vIdx * 3];
      particlePositions[i * 3 + 1] = origPos1[vIdx * 3 + 1];
      particlePositions[i * 3 + 2] = origPos1[vIdx * 3 + 2];

      // Alternate between Neon Pink and Luminous White
      if (i % 3 === 0) {
        // Bright Neon Pink / Magenta
        particleColors[i * 3] = 1.0;
        particleColors[i * 3 + 1] = 0.15;
        particleColors[i * 3 + 2] = 0.65;
      } else if (i % 3 === 1) {
        // Pure White Core
        particleColors[i * 3] = 1.0;
        particleColors[i * 3 + 1] = 1.0;
        particleColors[i * 3 + 2] = 1.0;
      } else {
        // Electric Cyan / Blue
        particleColors[i * 3] = 0.25;
        particleColors[i * 3 + 1] = 0.85;
        particleColors[i * 3 + 2] = 1.0;
      }
    }

    const particlesGeom = new THREE.BufferGeometry();
    particlesGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particlesGeom.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particlesMesh = new THREE.Points(particlesGeom, pointsMaterial);
    scene.add(particlesMesh);

    // 6. ANIMATION & HARMONIC DEFORMATION LOOP
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // 6.1 Animate Drifting Volumetric Lights & Fog Glow
      const l1X = Math.cos(elapsedTime * 0.42) * 18;
      const l1Y = Math.sin(elapsedTime * 0.5) * 14;
      const l1Z = Math.sin(elapsedTime * 0.35) * 10 - 8;
      lightMagenta.position.set(l1X, l1Y, l1Z);
      glowMagenta.position.set(l1X, l1Y, l1Z);

      const l2X = Math.sin(elapsedTime * 0.38) * 19;
      const l2Y = Math.cos(elapsedTime * 0.46) * 15;
      const l2Z = Math.cos(elapsedTime * 0.3) * 12 - 6;
      lightPurple.position.set(l2X, l2Y, l2Z);
      glowPurple.position.set(l2X, l2Y, l2Z);

      const l3X = Math.sin(elapsedTime * 0.25 + 2.0) * 15;
      const l3Y = Math.cos(elapsedTime * 0.3 + 1.5) * 12;
      const l3Z = Math.sin(elapsedTime * 0.4) * 8 - 4;
      lightCyan.position.set(l3X, l3Y, l3Z);
      glowCyan.position.set(l3X, l3Y, l3Z);

      // Light Intensity Breathing
      lightMagenta.intensity = 5.0 + Math.sin(elapsedTime * 1.8) * 1.5;
      lightPurple.intensity = 5.5 + Math.cos(elapsedTime * 1.5) * 1.6;
      lightCyan.intensity = 2.8 + Math.sin(elapsedTime * 1.2) * 0.8;

      // 6.2 Animate 3D Geometry Vertices (Complex Harmonic Waves)
      deformableObjects.forEach((item) => {
        const posAttr = item.geometry.attributes.position;
        const arr = posAttr.array as Float32Array;
        const orig = item.originalPositions;
        const count = orig.length / 3;

        const t = elapsedTime * item.speed + item.phaseOffset;
        const f = item.freq;
        const amp = item.amp;

        for (let i = 0; i < count; i++) {
          const idx = i * 3;
          const ox = orig[idx];
          const oy = orig[idx + 1];
          const oz = orig[idx + 2];

          // 3D Harmonic Wave Deformation (Perlin-like multi-frequency sinusoids)
          const wave1 = Math.sin(t + ox * f * 0.2 + oy * f * 0.3);
          const wave2 = Math.cos(t * 0.8 - oz * f * 0.25 + ox * f * 0.15);
          const wave3 = Math.sin(t * 1.2 + (ox + oy + oz) * f * 0.1);

          const normalFactor = 1 + (wave1 * 0.15 + wave2 * 0.1 + wave3 * 0.08) * amp;

          arr[idx] = ox * normalFactor + wave2 * amp * 0.35;
          arr[idx + 1] = oy * normalFactor + wave1 * amp * 0.35;
          arr[idx + 2] = oz * normalFactor + wave3 * amp * 0.35;
        }

        posAttr.needsUpdate = true;
      });

      // 6.3 Update Synaptic Nodes Positions attached to knotMesh1 vertices
      const mainArr = knotGeom1.attributes.position.array as Float32Array;
      const pArr = particlesGeom.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const vIdx = particleIndices[i];
        if (vIdx !== undefined && mainArr[vIdx * 3] !== undefined) {
          pArr[i * 3] = mainArr[vIdx * 3];
          pArr[i * 3 + 1] = mainArr[vIdx * 3 + 1];
          pArr[i * 3 + 2] = mainArr[vIdx * 3 + 2];
        }
      }
      particlesGeom.attributes.position.needsUpdate = true;

      // 6.4 Slow Global Rotation & Perspective Shifts
      knotMesh1.rotation.x = elapsedTime * 0.04;
      knotMesh1.rotation.y = elapsedTime * 0.06;

      knotMesh2.rotation.x = -elapsedTime * 0.05;
      knotMesh2.rotation.z = elapsedTime * 0.04;

      filamentsGroup.rotation.y = elapsedTime * 0.035;
      filamentsGroup.rotation.x = Math.sin(elapsedTime * 0.1) * 0.15;

      particlesMesh.rotation.x = knotMesh1.rotation.x;
      particlesMesh.rotation.y = knotMesh1.rotation.y;

      // Camera gentle float for dynamic shifting perspective
      camera.position.x = Math.sin(elapsedTime * 0.15) * 3.5;
      camera.position.y = Math.cos(elapsedTime * 0.18) * 2.5;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    // 7. WINDOW RESIZE HANDLER
    const handleResize = () => {
      if (!container) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize, { passive: true });

    // CLEANUP
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.clear();
    };
  }, []);

  return (
    <div
      id="neural-3d-background-container"
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: '#05010b',
      }}
      aria-hidden="true"
    />
  );
};
