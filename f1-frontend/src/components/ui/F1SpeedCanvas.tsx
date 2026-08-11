import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function F1SpeedCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0d0d0f, 0.015);

    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 2, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Speed Particles (Red & Silver Lights)
    const particleCount = 1500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount);

    const colorRed = new THREE.Color(0xe10600);
    const colorChrome = new THREE.Color(0xc9cdd3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

      const isRed = Math.random() > 0.6;
      const c = isRed ? colorRed : colorChrome;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      speeds[i] = 0.8 + Math.random() * 1.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, particleMaterial);
    scene.add(particles);

    // 3D Ground Grid (Monaco Apex Grid)
    const gridHelper = new THREE.GridHelper(200, 80, 0xe10600, 0x3a3a42);
    gridHelper.position.y = -2;
    scene.add(gridHelper);

    // Light Streaks (Hyperdrive Speed Lines)
    const lineCount = 40;
    const lineGroup = new THREE.Group();
    for (let i = 0; i < lineCount; i++) {
      const lineGeo = new THREE.BufferGeometry();
      const p1 = new THREE.Vector3(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 10,
        -100
      );
      const p2 = new THREE.Vector3(p1.x, p1.y, -100 + 15);
      lineGeo.setFromPoints([p1, p2]);

      const lineMat = new THREE.LineBasicMaterial({
        color: i % 2 === 0 ? 0xe10600 : 0xffffff,
        transparent: true,
        opacity: 0.6,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      lineGroup.add(line);
    }
    scene.add(lineGroup);

    // Mouse Tracking for Parallax Effect
    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Move speed particles towards camera
      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      const array = posAttr.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        array[i * 3 + 2] += speeds[i];
        if (array[i * 3 + 2] > 10) {
          array[i * 3 + 2] = -90;
        }
      }
      posAttr.needsUpdate = true;

      // Animate ground grid sliding underneath
      gridHelper.position.z += 0.4;
      if (gridHelper.position.z > 2.5) {
        gridHelper.position.z = 0;
      }

      // Animate hyperdrive lines
      lineGroup.children.forEach((l) => {
        l.position.z += 1.8;
        if (l.position.z > 110) {
          l.position.z = 0;
        }
      });

      // Smooth camera interpolation towards mouse
      camera.position.x += (mouseX * 2.5 - camera.position.x) * 0.05;
      camera.position.y += (-mouseY * 1.5 + 2 - camera.position.y) * 0.05;
      camera.lookAt(0, 0, -30);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
}
