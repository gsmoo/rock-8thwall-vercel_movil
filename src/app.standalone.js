import {splashImageComponent} from './splash-image.js'
import {backButtonComponent, nextButtonComponent} from './button.js'
import {modelSpawnComponent} from './component.js?v=debug-animation-20260703a'
import './confetti.js'
import './texture-pulse.js'

const configureImageTargets = () => {
  XR8.XrController.configure({
    imageTargetData: [
      {
        imagePath: './image-targets/qr-code.png',
        metadata: {},
        name: 'qr-code',
        type: 'PLANAR',
        properties: {
          left: 0,
          top: 0,
          width: 1254,
          height: 1254,
          originalWidth: 1254,
          originalHeight: 1254,
          isRotated: false,
        },
      },
    ],
  })
}

if (window.XR8) {
  configureImageTargets()
} else {
  window.addEventListener('xrloaded', configureImageTargets, {once: true})
}

AFRAME.registerComponent('splash-image', splashImageComponent)

AFRAME.registerComponent('custom-capture-btn', {
  init() {
    const btn = document.getElementById('recorder-button')
    if (btn) {
      btn.innerHTML = '<img id="icon" src="./src/assets/camera.svg">'
    }
  },
})

AFRAME.registerComponent('back-button', backButtonComponent())
AFRAME.registerComponent('next-button', nextButtonComponent())
AFRAME.registerComponent('model-spawn', modelSpawnComponent)

AFRAME.registerComponent('aplicar-video-a-screen', {
  init() {
    const el = this.el
    const video = document.getElementById('vid-mat')
    if (!video) {
      console.error('No se encontro el video con id="vid-mat"')
      return
    }

    video.play().catch(() => {
      console.warn('El navegador bloqueo autoplay. Esperando interaccion del usuario.')
    })
    video.playbackRate = 0.5

    const videoTexture = new THREE.VideoTexture(video)
    videoTexture.encoding = THREE.sRGBEncoding
    videoTexture.flipY = false

    el.addEventListener('model-loaded', () => {
      const mesh = el.getObject3D('mesh')
      if (!mesh) return

      mesh.traverse((node) => {
        if (node.isMesh && node.material.name === 'screen') {
          node.material.map = videoTexture
          node.material.emissiveMap = videoTexture
          node.material.roughness = 0.1
          node.material.emissive = new THREE.Color(0xffffff)
          node.material.needsUpdate = true
        }
      })
    })
  },
})

AFRAME.registerComponent('set-exposure', {
  init() {
    this.el.renderer.toneMappingExposure = 0.5
  },
})

window.addEventListener('xrloaded', () => {
  console.log('XR listo')
})
