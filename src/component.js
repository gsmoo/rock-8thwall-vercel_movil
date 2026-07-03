function safeActivateComponent(entity, componentName) {
  let tries = 0;
  const maxTries = 10;
  const interval = setInterval(() => {
    const comp = entity.components[componentName];
    if (comp) {
      comp.update?.();
      entity.emit('start');
      clearInterval(interval);
      console.log(`✅ ${componentName} activado en ${entity.getAttribute('id')}`);
    } else {
      tries++;
      if (tries > maxTries) {
        clearInterval(interval);
        console.warn(`⚠️ No se pudo activar ${componentName} en ${entity.getAttribute('id')}`);
      }
    }
  }, 50);
}

function createRockDebug() {
  const enabled = new URLSearchParams(window.location.search).has('debug');
  const state = window.__rockDebug = window.__rockDebug || {lines: []};

  const write = (message) => {
    const line = `[${new Date().toLocaleTimeString()}] ${message}`;
    state.lines.push(line);
    state.lines = state.lines.slice(-10);
    console.log(`[rock-debug] ${message}`);

    if (!enabled) return;

    let panel = document.getElementById('rock-debug-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'rock-debug-panel';
      panel.style.cssText = [
        'position:fixed',
        'left:8px',
        'right:8px',
        'bottom:8px',
        'z-index:999999',
        'padding:8px',
        'background:rgba(0,0,0,.78)',
        'color:#00ff99',
        'font:11px/1.35 monospace',
        'white-space:pre-wrap',
        'pointer-events:none',
        'max-height:42vh',
        'overflow:hidden',
      ].join(';');
      document.body.appendChild(panel);
    }
    panel.textContent = state.lines.join('\n');
  };

  return {enabled, write};
}

const rockDebug = createRockDebug();

AFRAME.registerComponent('play-model-animation', {
  schema: {
    clip: {default: 'Take 001'},
    timeScale: {default: 0.75},
  },

  init() {
    this.mixer = null;
    this.actions = [];
    this.lastDebugTime = 0;
    this.sampleJoint = null;
    this.onModelLoaded = this.onModelLoaded.bind(this);
    this.el.addEventListener('model-loaded', this.onModelLoaded);
    rockDebug.write('play-model-animation init');
  },

  onModelLoaded(event) {
    const root = event.detail?.model || this.el.getObject3D('mesh');
    if (!root) {
      console.warn('⚠️ Model root not found for animation.');
      rockDebug.write('ERROR: model root not found');
      return;
    }

    this.prepareAnimatedMeshes(root);
    this.sampleJoint = root.getObjectByName('fence02_L_00_jnt') || root.getObjectByName('column_L_00_jnt') || root.getObjectByName('god_M_root_jnt');

    const clips = this.getAnimationClips(root);
    const selectedClips = this.selectClips(clips);

    console.log('🎞 Animation clips detected:', clips.map((clip) => `${clip.name} (${clip.tracks?.length || 0} tracks)`).join(', ') || 'none');
    rockDebug.write(`model-loaded clips=${clips.length}: ${clips.map((clip) => `${clip.name}/${clip.tracks?.length || 0}`).join(', ') || 'none'}`);
    rockDebug.write(`selected "${this.data.clip}"=${selectedClips.length}; sampleJoint=${this.sampleJoint?.name || 'none'}`);

    if (!selectedClips.length) {
      console.warn(`⚠️ Animation "${this.data.clip}" not found. No model animation started.`);
      rockDebug.write(`ERROR: animation "${this.data.clip}" not found`);
      return;
    }

    this.mixer = new THREE.AnimationMixer(root);
    this.actions = selectedClips.map((clip) => {
      const action = this.mixer.clipAction(clip, root);
      action.reset();
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.setEffectiveTimeScale(this.data.timeScale);
      action.enabled = true;
      action.play();
      console.log(`▶️ Playing animation "${clip.name}" with ${clip.tracks?.length || 0} tracks at ${Math.round(this.data.timeScale * 100)}% speed`);
      rockDebug.write(`playing ${clip.name}/${clip.tracks?.length || 0} tracks at ${Math.round(this.data.timeScale * 100)}%`);
      return action;
    });
  },

  getAnimationClips(root) {
    const sources = [
      root?.animations,
      root?.geometry?.animations,
      this.el.components?.['gltf-model']?.model?.animations,
      this.el.getObject3D('mesh')?.animations,
    ];

    const clips = [];
    const seen = new Set();
    sources.flat().filter(Boolean).forEach((clip) => {
      if (seen.has(clip)) return;
      seen.add(clip);
      clips.push(clip);
    });

    return clips;
  },

  selectClips(clips) {
    const exact = clips.filter((clip) => clip.name === this.data.clip);
    if (exact.length) return exact;

    const normalizedTarget = this.data.clip.toLowerCase();
    return clips.filter((clip) => clip.name?.toLowerCase() === normalizedTarget);
  },

  prepareAnimatedMeshes(root) {
    const skinnedBaseNames = new Set();

    root.traverse((node) => {
      if (!node.isMesh) return;
      node.frustumCulled = false;
      if (node.isSkinnedMesh) {
        skinnedBaseNames.add(node.name.replace(/\.001$/, ''));
        node.visible = true;
      }
    });

    root.traverse((node) => {
      if (!node.isMesh || node.isSkinnedMesh) return;
      if (skinnedBaseNames.has(node.name)) {
        node.visible = false;
        console.log(`🙈 Hiding static duplicate mesh "${node.name}" so the skinned animation is visible`);
      }
    });
  },

  tick(time, deltaTime) {
    if (!this.mixer || !deltaTime) return;
    this.mixer.update(deltaTime / 1000);

    if (time - this.lastDebugTime > 2000 && this.actions.length) {
      this.lastDebugTime = time;
      const sampleScale = this.sampleJoint ? `${this.sampleJoint.scale.x.toFixed(3)},${this.sampleJoint.scale.y.toFixed(3)},${this.sampleJoint.scale.z.toFixed(3)}` : 'none';
      const actionTimes = this.actions.map((action) => action.time.toFixed(2)).join(',');
      console.log(`⏱ Animation mixer running: ${this.actions.length} action(s), times ${actionTimes}, sample scale ${sampleScale}`);
      rockDebug.write(`tick actions=${this.actions.length}; times=${actionTimes}; jointScale=${sampleScale}`);
    }
  },

  remove() {
    this.el.removeEventListener('model-loaded', this.onModelLoaded);
    if (this.mixer) {
      this.actions.forEach((action) => action.stop());
      this.mixer.stopAllAction();
    }
    this.mixer = null;
    this.actions = [];
  },
});

const modelSpawnComponent = {
  init() {
    const scene = this.el.sceneEl;
    let found = false;

    const showObject = ({ detail }) => {
      if (found) return;

      console.log('➡ Image Target detected → Spawning model directly');
      rockDebug.write('image target detected; spawning model');

      // ✅ Crear el modelo dinámicamente
      const model = document.createElement('a-entity');
      model.setAttribute('id', 'model');
      model.setAttribute('gltf-model', '#rock');
      model.setAttribute('shadow', { receive: false });
      model.setAttribute('scale', '9 9 9');
      model.setAttribute('xrextras-pinch-scale', '');
      model.setAttribute('xrextras-hold-drag', 'riseHeight: 0.25');
      model.setAttribute('play-model-animation', 'clip: Take 001; timeScale: 0.75');
      model.setAttribute('position', '0 0 0');
      model.classList.add('cantap');
      model.setAttribute('visible', 'true');

      

      scene.appendChild(model);
      model.flushToDOM();

      console.log('✅ Modelo creado como entidad raíz');
      rockDebug.write('model entity created');

      model.addEventListener('model-loaded', (event) => {
        console.log('✅ Model loaded');
        rockDebug.write('model-loaded event received');

        const clips = event.detail?.model?.animations || model.getObject3D('mesh')?.animations || [];
        console.log('🎞 Animation clips detected:', clips.map((clip) => `${clip.name} (${clip.tracks?.length || 0} tracks)`).join(', ') || 'none');

        model.setAttribute('visible', 'true');
        model.object3D.position.set(0, 0, 0);

        // ✅ VINCULAR el mesh al entity para el raycaster
        const mesh = model.getObject3D('mesh');
        if (mesh) {
          const skinnedBaseNames = new Set();

          mesh.traverse((node) => {
            if (node.isSkinnedMesh) {
              skinnedBaseNames.add(node.name.replace(/\.001$/, ''));
              node.visible = true;
            }
          });

          mesh.traverse((node) => {
            if (node.isMesh) {
              if (!node.isSkinnedMesh && skinnedBaseNames.has(node.name)) {
                node.visible = false;
                return;
              }

              node.userData.aframeEntity = model;
              node.raycast = THREE.Mesh.prototype.raycast;
              console.log(`✅ Mesh "${node.name}" vinculado y raycast habilitado`);
            }
          });
        }

        // ✅ VIDEO
        const video = document.getElementById('vid-mat');
        if (!video) {
          console.error('❌ No se encontró el video con id="vid-mat"');
          return;
        }

        video.addEventListener('canplay', () => {
          console.log('🎬 Video canplay');

          const videoTexture = new THREE.VideoTexture(video);
          videoTexture.encoding = THREE.sRGBEncoding;
          videoTexture.flipY = false;

          const mesh = model.getObject3D('mesh');
          if (!mesh) {
            console.error('❌ No se encontró el mesh del modelo');
            return;
          }

          mesh.traverse((node) => {
            if (node.isMesh && node.material?.name === 'screen') {
              node.material.map = videoTexture;
              node.material.emissiveMap = videoTexture;
              node.material.roughness = 0.1;
              node.material.emissive = new THREE.Color(0xffffff);
              node.material.needsUpdate = true;
              console.log(`✅ Video aplicado al material "${node.material.name}"`);
            }
          });
        });

        video.play().catch((error) => {
          console.warn('⚠️ Autoplay bloqueado hasta interacción:', error);
        });

        // ✅ Crear ground, anclado al modelo
        const ground = document.createElement('a-plane');
        ground.setAttribute('id', 'ground');
        ground.setAttribute('rotation', '-90 0 0');
        ground.setAttribute('width', '100');
        ground.setAttribute('height', '100');
        ground.setAttribute('material', 'shader: shadow');
        ground.setAttribute('shadow', 'receive: true');
        ground.setAttribute('position', '0 0 0');
        ground.setAttribute('xrextras-attach', 'target: model; offset: 0 0 0');

        scene.appendChild(ground);
        ground.flushToDOM();

        console.log('✅ Ground creado');

        // ✅ Delay antes de crear partículas
        setTimeout(() => {
          console.log('⏱ Creando partículas tras delay...');

          // ---------- CONFETTI 1 ----------
          const confetti1 = document.createElement('a-entity');
          confetti1.setAttribute('id', 'confetti-emitter-1');
          confetti1.setAttribute('rotation', '0 90 0');
          confetti1.setAttribute('scale', '8 8 8');
          confetti1.setAttribute('xrextras-attach', 'target: model; offset: 15.5 3.8 5');

          if (AFRAME.components['confetti-loop']) {
            confetti1.setAttribute('confetti-loop', '');
          } else {
            console.warn('⚠️ Componente confetti-loop no está registrado.');
          }

          scene.appendChild(confetti1);
          confetti1.flushToDOM();
          safeActivateComponent(confetti1, 'confetti-loop');

          // ---------- CONFETTI 2 ----------
          const confetti2 = document.createElement('a-entity');
          confetti2.setAttribute('id', 'confetti-emitter-2');
          confetti2.setAttribute('rotation', '0 270 0');
          confetti2.setAttribute('scale', '8 8 8');
          confetti2.setAttribute('xrextras-attach', 'target: model; offset: -16.3 3.8 4.6');

          if (AFRAME.components['confetti-loop']) {
            confetti2.setAttribute('confetti-loop', '');
          } else {
            console.warn('⚠️ Componente confetti-loop no está registrado.');
          }

          scene.appendChild(confetti2);
          confetti2.flushToDOM();
          safeActivateComponent(confetti2, 'confetti-loop');

          // ---------- TEXTURE EMITTERS ----------
          for (let i = 1; i <= 4; i++) {
            const emitter = document.createElement('a-entity');
            emitter.setAttribute('id', `texture-emitter-${i}`);
            emitter.setAttribute('scale', '1.3 1.3 1.3');

            let offset;
            if (i <= 2) {
              offset = `-18.5 ${i === 1 ? 18 : 24} 5`;
            } else {
              offset = `19 ${i === 3 ? 18 : 24} 5`;
            }
            emitter.setAttribute('xrextras-attach', `target: model; offset: ${offset}`);

            if (AFRAME.components['texture-pulse']) {
              emitter.setAttribute('texture-pulse', '');
            } else {
              console.warn(`⚠️ Componente texture-pulse no está registrado.`);
            }

            scene.appendChild(emitter);
            emitter.flushToDOM();
            safeActivateComponent(emitter, 'texture-pulse');
          }
        }, 500);

        // ✅ LUCES
        const directional = document.createElement('a-entity');
        directional.setAttribute('light', `
          type: directional;
          intensity: 0.8;
          castShadow: true;
          shadowMapHeight: 2048;
          shadowMapWidth: 2048;
          shadowCameraTop: 100;
          shadowCameraBottom: -100;
          shadowCameraLeft: -100;
          shadowCameraRight: 100;
          shadowCameraNear: 0.1;
          shadowCameraFar: 100;
          shadowBias: -0.0001;
        `);
        directional.setAttribute('position', '15 25 10');
        directional.setAttribute('xrextras-attach', 'target: model; offset: 15 25 10');
        scene.appendChild(directional);
        directional.flushToDOM();

        const ambient = document.createElement('a-light');
        ambient.setAttribute('type', 'ambient');
        ambient.setAttribute('intensity', '0.4');
        ambient.setAttribute('xrextras-attach', 'target: model; offset: 0 0 0');
        scene.appendChild(ambient);
        ambient.flushToDOM();

        console.log('✅ Luces creadas');
      });

      found = true;
    };

    scene.addEventListener('xrimagefound', showObject);
  },
};

export { modelSpawnComponent };
