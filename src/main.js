import * as THREE from 'three'
import './style.css'

const $ = (selector) => document.querySelector(selector)
const canvas = $('#ocean')
let renderer
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
} catch {
  $('#error').hidden = false
  throw new Error('WebGL is unavailable')
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0xa6c9c6, 0.005)
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.rotation.order = 'YXZ'

const skyUniforms = { top: { value: new THREE.Color('#85b7bd') }, bottom: { value: new THREE.Color('#e6d9ba') } }
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, uniforms: skyUniforms,
  vertexShader: `varying vec3 vDirection; void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vDirection; void main() { float h = normalize(vDirection).y; gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.08, 0.65, h)), 1.0); }`,
}))
scene.add(sky)

const sun = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe6bb, fog: false }))
sun.position.set(-120, 55, -360)
scene.add(sun)

// Low, hazy islands anchor the horizon without interrupting the open-water view.
const islandMaterial = new THREE.MeshStandardMaterial({ color: 0x718e88, roughness: 1 })
for (const [x, z, scale] of [[-210, -340, 1], [-155, -370, 0.7], [250, -420, 1.1]]) {
  const island = new THREE.Mesh(new THREE.ConeGeometry(65 * scale, 25 * scale, 7), islandMaterial)
  island.position.set(x, -6, z)
  island.rotation.y = 0.4
  scene.add(island)
}
scene.add(new THREE.HemisphereLight(0xe4f4eb, 0x497577, 2))
const sunlight = new THREE.DirectionalLight(0xffedce, 2)
sunlight.position.set(-120, 90, -250)
scene.add(sunlight)

const state = {
  wind: 0.35, height: 0.55, depth: 24, waveAngle: 0.4,
  currentX: 0, currentZ: 0, x: 0, z: 0, yaw: 0, pitch: 0,
}
const uniforms = {
  ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
  time: { value: 0 }, amplitude: { value: 0 }, waveDirection: { value: new THREE.Vector2() },
  waterColor: { value: new THREE.Color('#167e86') }, bottomColor: { value: new THREE.Color('#c7b18b') },
  depth: { value: state.depth }, lightDirection: { value: new THREE.Vector3(-0.35, 0.5, -0.8).normalize() },
  storm: { value: 0 },
}
const ocean = new THREE.Mesh(new THREE.PlaneGeometry(500, 500, 160, 160), new THREE.ShaderMaterial({
  uniforms, fog: true,
  vertexShader: `
    uniform float time;
    uniform float amplitude;
    uniform vec2 waveDirection;
    varying vec3 vNormal;
    varying vec3 vWorld;
    #include <fog_pars_vertex>
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vec2 p = world.xz;
      vec2 d = waveDirection;
      vec2 d2 = vec2(-d.y, d.x);
      float a = dot(p, d) * 0.075 + time * 0.8;
      float b = dot(p, d2) * 0.13 + dot(p, d) * 0.035 + time * 1.15;
      float c = dot(p, d) * 0.25 - dot(p, d2) * 0.12 + time * 1.6;
      world.y += amplitude * (sin(a) + 0.35 * sin(b) + 0.12 * sin(c));
      vec2 slope = amplitude * (cos(a) * d * 0.075 + 0.35 * cos(b) * (d2 * 0.13 + d * 0.035) + 0.12 * cos(c) * (d * 0.25 - d2 * 0.12));
      vNormal = normalize(vec3(-slope.x, 1.0, -slope.y));
      vWorld = world.xyz;
      vec4 mvPosition = viewMatrix * world;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `
    uniform vec3 waterColor;
    uniform vec3 bottomColor;
    uniform vec3 lightDirection;
    uniform float depth;
    uniform float storm;
    varying vec3 vNormal;
    varying vec3 vWorld;
    #include <fog_pars_fragment>
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(cameraPosition - vWorld);
      float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
      float diffuse = max(dot(normal, lightDirection), 0.0);
      float sparkle = pow(max(dot(reflect(-lightDirection, normal), viewDir), 0.0), 80.0);
      vec3 shallow = mix(bottomColor, waterColor, smoothstep(0.0, 30.0, depth));
      vec3 color = shallow * (0.55 + diffuse * 0.45);
      color = mix(color, vec3(0.70, 0.83, 0.79), fresnel * 0.7);
      color += vec3(1.0, 0.89, 0.68) * sparkle * (1.0 - storm * 0.7);
      color *= 1.0 - storm * 0.28;
      gl_FragColor = vec4(color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
}))
ocean.rotation.x = -Math.PI / 2
scene.add(ocean)

const sticks = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } }
document.querySelectorAll('.stick').forEach((element) => {
  const name = element.dataset.stick
  const knob = element.querySelector('.stick-knob')
  const update = (event) => {
    const rect = element.getBoundingClientRect()
    const radius = rect.width * 0.3
    let x = (event.clientX - rect.left - rect.width / 2) / radius
    let y = (event.clientY - rect.top - rect.height / 2) / radius
    const length = Math.hypot(x, y)
    if (length > 1) { x /= length; y /= length }
    knob.style.transform = `translate(${x * radius}px, ${y * radius}px)`
    if (name === 'waves' && length > 0.1) state.waveAngle = Math.atan2(x, -y)
    else if (name === 'current') { state.currentX = x; state.currentZ = y }
    else if (sticks[name]) { sticks[name].x = x; sticks[name].y = y }
  }
  element.addEventListener('pointerdown', (event) => { element.setPointerCapture(event.pointerId); update(event) })
  element.addEventListener('pointermove', (event) => { if (element.hasPointerCapture(event.pointerId)) update(event) })
  const release = () => {
    // Ocean controls retain their setting; movement and view sticks spring back.
    if (sticks[name]) { sticks[name].x = 0; sticks[name].y = 0; knob.style.transform = '' }
  }
  element.addEventListener('pointerup', release)
  element.addEventListener('pointercancel', release)
})

const keys = new Set()
window.addEventListener('keydown', (event) => {
  if (/^(INPUT|SELECT|BUTTON)$/.test(event.target.tagName)) return
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(event.key)) event.preventDefault()
  keys.add(event.key.toLowerCase())
})
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()))
window.addEventListener('blur', () => keys.clear())

const settings = $('#settings')
const toggleSettings = (open) => {
  settings.hidden = !open
  $('#settings-toggle').setAttribute('aria-expanded', String(open))
}
$('#settings-toggle').addEventListener('click', () => toggleSettings(settings.hidden))
$('#settings-close').addEventListener('click', () => toggleSettings(false))
$('#info-toggle').addEventListener('click', () => { $('#help').hidden = !$('#help').hidden })
$('#help-close').addEventListener('click', () => { $('#help').hidden = true })
document.querySelectorAll('[data-tab]').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach((item) => item.setAttribute('aria-selected', String(item === tab)))
  document.querySelectorAll('[data-panel]').forEach((panel) => { panel.hidden = panel.dataset.panel !== tab.dataset.tab })
}))
for (const id of ['wind', 'height', 'depth']) {
  $(`#${id}`).addEventListener('input', (event) => {
    const value = Number(event.target.value)
    state[id] = id === 'depth' ? value : value / 100
    $(`#${id}-value`).textContent = id === 'depth' ? `${value} m` : `${value}%`
  })
}
$('#water-color').addEventListener('input', (event) => uniforms.waterColor.value.set(event.target.value))
$('#bottom-color').addEventListener('input', (event) => uniforms.bottomColor.value.set(event.target.value))
$('#weather').addEventListener('change', (event) => {
  const weather = event.target.value
  const palettes = {
    clear: ['#85b7bd', '#e6d9ba', '#a6c9c6', 0],
    overcast: ['#8c9fa1', '#c2c7bd', '#aebfbc', 0.45],
    storm: ['#4c6871', '#9caaa8', '#7b9294', 1],
  }
  const [top, bottom, fog, storm] = palettes[weather]
  skyUniforms.top.value.set(top)
  skyUniforms.bottom.value.set(bottom)
  scene.fog.color.set(fog)
  uniforms.storm.value = storm
  sun.visible = weather === 'clear'
  $('#weather-label').textContent = event.target.selectedOptions[0].textContent.toUpperCase()
})

function waveHeight(x, z, time, amplitude, dx, dz) {
  const sideX = -dz
  const sideZ = dx
  const along = x * dx + z * dz
  const across = x * sideX + z * sideZ
  return amplitude * (Math.sin(along * 0.075 + time * 0.8) + 0.35 * Math.sin(across * 0.13 + along * 0.035 + time * 1.15) + 0.12 * Math.sin(along * 0.25 - across * 0.12 + time * 1.6))
}

let previousTime = performance.now()
let elapsed = 0
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - previousTime) / 1000, 0.05)
  previousTime = now
  elapsed += dt
  const lookX = sticks.look.x + Number(keys.has('arrowright')) - Number(keys.has('arrowleft'))
  const lookY = sticks.look.y + Number(keys.has('arrowdown')) - Number(keys.has('arrowup'))
  state.yaw -= lookX * dt * 1.3
  state.pitch = THREE.MathUtils.clamp(state.pitch - lookY * dt, -1.05, 1.05)
  const forward = -sticks.move.y + Number(keys.has('w')) - Number(keys.has('s'))
  const strafe = sticks.move.x + Number(keys.has('d')) - Number(keys.has('a'))
  state.x += (Math.cos(state.yaw) * strafe - Math.sin(state.yaw) * forward) * dt * 2 + state.currentX * dt * 0.65
  state.z += (-Math.sin(state.yaw) * strafe - Math.cos(state.yaw) * forward) * dt * 2 + state.currentZ * dt * 0.65
  const dx = Math.sin(state.waveAngle)
  const dz = -Math.cos(state.waveAngle)
  const amplitude = state.height * (0.45 + state.wind * 1.3)
  uniforms.time.value = elapsed
  uniforms.amplitude.value = amplitude
  uniforms.waveDirection.value.set(dx, dz)
  uniforms.depth.value = state.depth
  ocean.position.set(state.x, 0, state.z)
  sky.position.set(state.x, 0, state.z)
  const surface = waveHeight(state.x, state.z, elapsed, amplitude, dx, dz)
  const slopeX = waveHeight(state.x + 0.5, state.z, elapsed, amplitude, dx, dz) - surface
  const slopeZ = waveHeight(state.x, state.z + 0.5, elapsed, amplitude, dx, dz) - surface
  camera.position.set(state.x, surface + 0.5, state.z)
  camera.rotation.set(state.pitch + (slopeX * Math.sin(state.yaw) + slopeZ * Math.cos(state.yaw)) * 0.5, state.yaw, (slopeX * Math.cos(state.yaw) - slopeZ * Math.sin(state.yaw)) * 0.5)
  renderer.render(scene, camera)
})
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
