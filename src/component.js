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

function getClipDuration(clip) {
  if (typeof clip.duration === 'number') return clip.duration;
  return 0;
}

function selectModelAnimation(clips) {
  const preferredName = 'ArmatureAction';
  const preferredClips = clips.filter((clip) => clip.name === preferredName);
  const candidates = preferredClips.length ? preferredClips : clips;

  return candidates
    .slice()
    .sort((a, b) => {
      const trackDiff = (b.tracks?.length || 0) - (a.tracks?.length || 0);
      if (trackDiff) return trackDiff;
      return getClipDuration(b) - getClipDuration(a);
    })[0];
}

const modelSpawnComponent = {
  init() {
    const scene = this.el.sceneEl;
    let found = false;
    this.animationMixer = null;

    const showObject = ({ detail }) => {
      if (found) return;

      console.log('➡ Image Target detected → Spawning model directly');

      // ✅ Crear el modelo dinámicamente
      const model = document.createElement('a-entity');
      model.setAttribute('id', 'model');
      model.setAttribute('gltf-model', '#rock');
      model.setAttribute('shadow', { receive: false });
      model.setAttribute('scale', '9 9 9');
      model.setAttribute('xrextras-pinch-scale', '');
      model.setAttribute('xrextras-hold-drag', 'riseHeight: 0.25');
      model.setAttribute('position', '0 0 0');
      model.classList.add('cantap');
      model.setAttribute('visible', 'true');

      

      scene.appendChild(model);
      model.flushToDOM();

      console.log('✅ Modelo creado como entidad raíz');

      model.addEventListener('model-loaded', (event) => {
        console.log('✅ Model loaded');

        const clips = event.detail?.model?.animations || model.getObject3D('mesh')?.animations || [];
        console.log('🎞 Animation clips detected:', clips.map((clip) => `${clip.name} (${clip.tracks?.length || 0} tracks)`).join(', ') || 'none');

        const selectedClip = selectModelAnimation(clips);
        if (selectedClip) {
          this.animationMixer = new THREE.AnimationMixer(event.detail.model);
          const action = this.animationMixer.clipAction(selectedClip);
          action.reset();
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.enabled = true;
          action.play();
          console.log(`▶️ Playing animation "${selectedClip.name}" with ${selectedClip.tracks?.length || 0} tracks`);
        } else {
          console.warn('⚠️ No animation clips found in model.');
        }

        model.setAttribute('visible', 'true');
        model.object3D.position.set(0, 0, 0);

        // ✅ VINCULAR el mesh al entity para el raycaster
        const mesh = model.getObject3D('mesh');
        if (mesh) {
          mesh.traverse((node) => {
            if (node.isMesh) {
              node.userData.aframeEntity = model;
              node.raycast = THREE.Mesh.prototype.raycast;
              node.onBeforeRender = () => {
                node.visible = true;
              };
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

  tick(time, deltaTime) {
    if (!this.animationMixer || !deltaTime) return;
    this.animationMixer.update(deltaTime / 1000);
  },
};

export { modelSpawnComponent };
