import React, { useEffect, useRef } from 'react'
import { Renderer, Camera, Transform, Mesh, Box, Torus, Cylinder, Sphere, Program } from 'ogl'

export interface Shapes3DProps {
  shape?: 'cube' | 'torus' | 'cylinder' | 'sphere' | 'multi'
  wireframe?: boolean
  color?: string
  accentColor?: string
  speed?: number
  interactive?: boolean
  className?: string
  style?: React.CSSProperties
}

const hexToRgb = (hex: string): [number, number, number] => {
  const c = hex.replace('#', '').padEnd(6, '0')
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255
  ]
}

const vertexShader = `
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vPosition = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`

const fragmentShader = `
precision highp float;

uniform vec3 uColor;
uniform vec3 uAccentColor;
uniform float uTime;
uniform float uWireframe;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(vec3(1.0, 1.5, 2.0));
  vec3 viewDir = normalize(-vPosition);

  // Diffuse lighting
  float diff = max(dot(normal, lightDir), 0.0);

  // Fresnel / Rim lighting effect for futuristic 3D aesthetic
  float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.5);

  // Specular highlight
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);

  vec3 baseColor = mix(uColor, uAccentColor, fresnel * 0.7 + sin(uTime + vPosition.x) * 0.15);
  vec3 finalColor = baseColor * (0.35 + diff * 0.65) + vec3(1.0) * spec * 0.6 + uAccentColor * fresnel * 0.8;

  float alpha = mix(0.9, 0.4 + fresnel * 0.5, uWireframe);
  gl_FragColor = vec4(finalColor, alpha);
}
`

export const Shapes3D: React.FC<Shapes3DProps> = ({
  shape = 'multi',
  wireframe = false,
  color = '#00F5A0',
  accentColor = '#7B2CBF',
  speed = 1,
  interactive = true,
  className = '',
  style
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mouseRef = useRef<[number, number]>([0, 0])
  const targetMouseRef = useRef<[number, number]>([0, 0])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new Renderer({ alpha: true, antialias: true, dpr: window.devicePixelRatio || 1 })
    const gl = renderer.gl
    const canvas = gl.canvas as HTMLCanvasElement

    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    container.appendChild(canvas)

    const camera = new Camera(gl, { fov: 45 })
    camera.position.set(0, 0, 6)

    const scene = new Transform()

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uColor: { value: hexToRgb(color) },
        uAccentColor: { value: hexToRgb(accentColor) },
        uTime: { value: 0 },
        uWireframe: { value: wireframe ? 1.0 : 0.0 }
      },
      cullFace: null,
      transparent: true
    })

    const meshes: Mesh[] = []

    if (shape === 'multi') {
      // Create a set of floating 3D shapes
      const cubeGeom = new Box(gl, { width: 1.2, height: 1.2, depth: 1.2 })
      const torusGeom = new Torus(gl, { radius: 0.9, tube: 0.35, radialSegments: 32, tubularSegments: 32 })
      const sphereGeom = new Sphere(gl, { radius: 0.7, widthSegments: 24, heightSegments: 24 })
      const cylGeom = new Cylinder(gl, { radiusBottom: 0.6, radiusTop: 0.6, height: 1.2, radialSegments: 24 })

      const m1 = new Mesh(gl, { geometry: torusGeom, program })
      m1.position.set(-1.8, 0.4, 0)
      m1.setParent(scene)
      meshes.push(m1)

      const m2 = new Mesh(gl, { geometry: cubeGeom, program })
      m2.position.set(0, -0.2, 0.5)
      m2.setParent(scene)
      meshes.push(m2)

      const m3 = new Mesh(gl, { geometry: sphereGeom, program })
      m3.position.set(1.8, 0.5, -0.3)
      m3.setParent(scene)
      meshes.push(m3)

      const m4 = new Mesh(gl, { geometry: cylGeom, program })
      m4.position.set(0, 1.6, -1.0)
      m4.scale.set(0.7, 0.7, 0.7)
      m4.setParent(scene)
      meshes.push(m4)
    } else {
      let geometry
      if (shape === 'torus') {
        geometry = new Torus(gl, { radius: 1.2, tube: 0.45, radialSegments: 32, tubularSegments: 32 })
      } else if (shape === 'cylinder') {
        geometry = new Cylinder(gl, { radiusBottom: 1.0, radiusTop: 1.0, height: 2.0, radialSegments: 32 })
      } else if (shape === 'sphere') {
        geometry = new Sphere(gl, { radius: 1.3, widthSegments: 32, heightSegments: 32 })
      } else {
        geometry = new Box(gl, { width: 1.8, height: 1.8, depth: 1.8 })
      }

      const mesh = new Mesh(gl, { geometry, program })
      mesh.setParent(scene)
      meshes.push(mesh)
    }

    const resize = () => {
      const rect = container.getBoundingClientRect()
      renderer.setSize(rect.width, rect.height)
      camera.perspective({ aspect: rect.width / rect.height })
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      targetMouseRef.current = [x, y]
    }

    if (interactive) {
      window.addEventListener('pointermove', onPointerMove)
    }

    let animationFrameId: number

    const loop = (t: number) => {
      animationFrameId = requestAnimationFrame(loop)
      const time = t * 0.001 * speed
      program.uniforms.uTime.value = time

      // Mouse damping
      mouseRef.current[0] += (targetMouseRef.current[0] - mouseRef.current[0]) * 0.05
      mouseRef.current[1] += (targetMouseRef.current[1] - mouseRef.current[1]) * 0.05

      // Rotate scene / meshes based on time and mouse
      scene.rotation.y = time * 0.3 + mouseRef.current[0] * 0.5
      scene.rotation.x = Math.sin(time * 0.2) * 0.2 + mouseRef.current[1] * 0.3

      meshes.forEach((m, idx) => {
        m.rotation.x += 0.01 * (idx + 1) * speed
        m.rotation.y += 0.015 * (idx + 1) * speed
        m.position.y += Math.sin(time * 1.5 + idx) * 0.003
      })

      renderer.render({ scene, camera })
    }

    animationFrameId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animationFrameId)
      if (interactive) {
        window.removeEventListener('pointermove', onPointerMove)
      }
      ro.disconnect()
      if (canvas.parentElement === container) {
        container.removeChild(canvas)
      }
    }
  }, [shape, wireframe, color, accentColor, speed, interactive])

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={style}
    />
  )
}

export default Shapes3D
