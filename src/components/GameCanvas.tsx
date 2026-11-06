import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ControlState, AnimationState } from '../types/game';
import { buildLandscape } from '../game/terrain';
import { createMinecraftSultan, CharacterController } from '../game/minecraftSultan';
import { createRoyalGuards, RoyalGuardsController } from '../game/royalGuards';

interface GameCanvasProps {
  controls: ControlState;
  onStateUpdate: (state: { animState: AnimationState; isGrounded: boolean }) => void;
  resetCameraTrigger: number;
  cameraDrag: { deltaX: number; deltaY: number; timestamp: number };
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  controls,
  onStateUpdate,
  resetCameraTrigger,
  cameraDrag,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // References for render loop access
  const controlsRef = useRef<ControlState>(controls);
  controlsRef.current = controls;

  // Camera angles
  const cameraYawRef = useRef<number>(0); // horizontal orbit angle (radians)
  const cameraPitchRef = useRef<number>(0.32); // vertical tilt angle (radians)
  const cameraDistanceRef = useRef<number>(4.8); // distance behind Sultan

  // Apply camera drag from props
  const lastProcessedDragRef = useRef<number>(0);
  useEffect(() => {
    if (cameraDrag.timestamp !== lastProcessedDragRef.current) {
      lastProcessedDragRef.current = cameraDrag.timestamp;
      cameraYawRef.current -= cameraDrag.deltaX * 1.5;
      cameraPitchRef.current = Math.max(
        0.08,
        Math.min(1.2, cameraPitchRef.current + cameraDrag.deltaY * 1.2)
      );
    }
  }, [cameraDrag]);

  // Handle camera reset
  useEffect(() => {
    if (resetCameraTrigger > 0) {
      cameraYawRef.current = 0;
      cameraPitchRef.current = 0.32;
      cameraDistanceRef.current = 4.8;
    }
  }, [resetCameraTrigger]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software WebGL
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // Setup Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa6d8f5); // Royal clear sky
    scene.fog = new THREE.FogExp2(0xa6d8f5, 0.012);

    // Setup Camera
    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.2, // Near plane 0.2 prevents clipping
      350
    );
    camera.position.set(0, 3, 5);

    // Setup Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    // Cap at 1.75 on mobile to avoid GPU memory saturation while keeping retina sharpness
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // Studio Environment map for realistic fabric and metallic reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xdaf2ff, 0x4a7032, 1.1);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    dirLight.position.set(25, 45, 20);
    if (!isSoftwareGl) {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 120;
      const d = 25;
      dirLight.shadow.camera.left = -d;
      dirLight.shadow.camera.right = d;
      dirLight.shadow.camera.top = d;
      dirLight.shadow.camera.bottom = -d;
      dirLight.shadow.bias = -0.0004;
      dirLight.shadow.normalBias = 0.02;
    }
    scene.add(dirLight);

    // Build Landscape
    const { getHeight } = buildLandscape(scene);

    // Load Minecraft Sultan Achour 10 Character & Royal Flanking Guards
    let characterController: CharacterController | null = null;
    let royalGuards: RoyalGuardsController | null = null;
    try {
      characterController = createMinecraftSultan(scene);
      royalGuards = createRoyalGuards(scene);
      setLoading(false);
    } catch (err) {
      console.error('Failed to initialize characters:', err);
      setLoadError('تعذر تحميل شخصية السلطان والحراس');
      setLoading(false);
    }

    // Desktop Mouse Drag to rotate camera
    let isMouseDown = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDown = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      cameraYawRef.current -= dx * 0.006;
      cameraPitchRef.current = Math.max(
        0.08,
        Math.min(1.2, cameraPitchRef.current + dy * 0.005)
      );
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    const handleWheel = (e: WheelEvent) => {
      cameraDistanceRef.current = Math.max(
        2.5,
        Math.min(9.0, cameraDistanceRef.current + e.deltaY * 0.003)
      );
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domEl.addEventListener('wheel', handleWheel, { passive: true });

    // Handle Window Resize
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Main Game Animation Loop
    const clock = new THREE.Clock();
    let frameId = 0;
    const currentCamPos = new THREE.Vector3(0, 3, 5);
    const currentLookTarget = new THREE.Vector3(0, 1.2, 0);

    const updateLoop = () => {
      const delta = clock.getDelta();

      if (characterController) {
        // Update character kinematics & animation controller
        characterController.update(
          delta,
          controlsRef.current,
          cameraYawRef.current,
          getHeight
        );

        const sultanPos = characterController.getPosition();
        const sultanAngle = characterController.getFacingAngle();
        const sultanSpeed = characterController.getSpeedRatio() * 7.0;
        const sultanState = characterController.getCurrentState();
        const grounded = characterController.isGrounded();

        // Update Escort Royal Flanking Guards (Following behind Sultan on left & right)
        if (royalGuards) {
          royalGuards.update(
            delta,
            sultanPos,
            sultanAngle,
            sultanSpeed,
            getHeight,
            controlsRef.current.isAttacking,
            controlsRef.current.isSwordDrawn
          );
        }

        // Sync directional light shadow center to player
        dirLight.position.set(sultanPos.x + 25, sultanPos.y + 45, sultanPos.z + 20);
        dirLight.target.position.set(sultanPos.x, sultanPos.y, sultanPos.z);
        dirLight.target.updateMatrixWorld();

        // Calculate third person camera target and position
        const targetLookAt = new THREE.Vector3(
          sultanPos.x,
          sultanPos.y + 1.25, // look at chest/head level
          sultanPos.z
        );

        // Desired camera orbit position
        const dist = cameraDistanceRef.current;
        const pitch = cameraPitchRef.current;
        const yaw = cameraYawRef.current;

        const offsetX = Math.sin(yaw) * Math.cos(pitch) * dist;
        const offsetY = Math.sin(pitch) * dist;
        const offsetZ = Math.cos(yaw) * Math.cos(pitch) * dist;

        const desiredCamX = sultanPos.x - offsetX;
        let desiredCamY = sultanPos.y + 1.3 + offsetY;
        const desiredCamZ = sultanPos.z - offsetZ;

        // Ground avoidance for camera
        const terrainAtCam = getHeight(desiredCamX, desiredCamZ);
        if (desiredCamY < terrainAtCam + 0.6) {
          desiredCamY = terrainAtCam + 0.6;
        }

        // Smooth camera follow with damping
        currentCamPos.x = THREE.MathUtils.damp(currentCamPos.x, desiredCamX, 10, delta);
        currentCamPos.y = THREE.MathUtils.damp(currentCamPos.y, desiredCamY, 10, delta);
        currentCamPos.z = THREE.MathUtils.damp(currentCamPos.z, desiredCamZ, 10, delta);

        currentLookTarget.x = THREE.MathUtils.damp(currentLookTarget.x, targetLookAt.x, 14, delta);
        currentLookTarget.y = THREE.MathUtils.damp(currentLookTarget.y, targetLookAt.y, 14, delta);
        currentLookTarget.z = THREE.MathUtils.damp(currentLookTarget.z, targetLookAt.z, 14, delta);

        camera.position.copy(currentCamPos);
        camera.lookAt(currentLookTarget);

        onStateUpdate({
          animState: sultanState,
          isGrounded: grounded,
        });
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(updateLoop);
    };

    frameId = requestAnimationFrame(updateLoop);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      domEl.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domEl.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (royalGuards) {
        royalGuards.dispose();
      }
      if (domEl.parentNode) {
        domEl.parentNode.removeChild(domEl);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* 3D Canvas Mount Point */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-stone-950/90 text-white backdrop-blur-md">
          <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-400 animate-spin mb-4" />
          <h2 className="text-xl font-bold text-amber-300">جاري إعداد المملكة العاشورية...</h2>
          <p className="text-xs text-stone-400 mt-2">تحميل تضاريس الطبيعة وشخصية السلطان عاشور العاشر 3D</p>
        </div>
      )}

      {/* Error state */}
      {loadError && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 bg-red-950/90 border border-red-500/60 p-6 rounded-2xl text-center">
          <p className="text-red-200 font-bold mb-2">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white font-semibold text-xs"
          >
            إعادة المحاولة
          </button>
        </div>
      )}
    </div>
  );
};
