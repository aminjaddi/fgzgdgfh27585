import { useState, useCallback, useRef } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { TouchControls } from './components/TouchControls';
import { StoryIntro } from './components/StoryIntro';
import { GameHUD } from './components/GameHUD';
import { ControlState, AnimationState } from './types/game';
import { soundManager } from './utils/audio';

export default function App() {
  const [showStory, setShowStory] = useState(true);
  const [isWalking, setIsWalking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [resetCameraCount, setResetCameraCount] = useState(0);
  const [cameraDrag, setCameraDrag] = useState<{ deltaX: number; deltaY: number; timestamp: number }>({
    deltaX: 0,
    deltaY: 0,
    timestamp: 0,
  });

  const [gameState, setGameState] = useState<{
    animState: AnimationState;
    isGrounded: boolean;
  }>({
    animState: 'idle',
    isGrounded: true,
  });

  const [isSwordDrawn, setIsSwordDrawn] = useState(false);

  const controlsRef = useRef<ControlState>({
    moveX: 0,
    moveY: 0,
    isWalking: false,
    isRunning: false,
    isJumping: false,
    cameraRotateX: 0,
    cameraRotateY: 0,
    isSwordDrawn: false,
    isAttacking: false,
  });

  const [controls, setControls] = useState<ControlState>(controlsRef.current);

  const handleControlChange = useCallback((updated: Partial<ControlState>) => {
    controlsRef.current = {
      ...controlsRef.current,
      ...updated,
    };
    if (updated.isSwordDrawn !== undefined) {
      setIsSwordDrawn(updated.isSwordDrawn);
    }
    setControls({ ...controlsRef.current });
  }, []);

  const handleToggleSword = useCallback(() => {
    setIsSwordDrawn((prev) => {
      const next = !prev;
      controlsRef.current.isSwordDrawn = next;
      setControls({ ...controlsRef.current });
      return next;
    });
  }, []);

  const handleAttack = useCallback(() => {
    controlsRef.current.isSwordDrawn = true;
    controlsRef.current.isAttacking = true;
    setIsSwordDrawn(true);
    setControls({ ...controlsRef.current });

    // Reset attacking pulse
    setTimeout(() => {
      controlsRef.current.isAttacking = false;
      setControls({ ...controlsRef.current });
    }, 120);
  }, []);

  const handleToggleWalk = useCallback(() => {
    soundManager.playClick();
    setIsWalking((prev) => {
      const next = !prev;
      controlsRef.current.isWalking = next;
      setControls({ ...controlsRef.current });
      return next;
    });
  }, []);

  const handleCameraDrag = useCallback((deltaX: number, deltaY: number) => {
    setCameraDrag({
      deltaX,
      deltaY,
      timestamp: Date.now(),
    });
  }, []);

  const handleResetCamera = useCallback(() => {
    setResetCameraCount((c) => c + 1);
  }, []);

  const handleStoryComplete = useCallback(() => {
    setShowStory(false);
    soundManager.startRoyalAmbience();
  }, []);

  const handleOpenStory = useCallback(() => {
    setShowStory(true);
  }, []);

  const handleToggleSound = useCallback(() => {
    const next = !isMuted;
    soundManager.setMuted(next);
    setIsMuted(next);
  }, [isMuted]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none touch-none">
      {/* 3D Game Canvas */}
      <GameCanvas
        controls={controls}
        onStateUpdate={setGameState}
        resetCameraTrigger={resetCameraCount}
        cameraDrag={cameraDrag}
      />

      {/* Touch & Joystick Controls Overlay (Visible when not in story intro) */}
      {!showStory && (
        <>
          <TouchControls
            onControlChange={handleControlChange}
            onCameraDrag={handleCameraDrag}
            isWalking={isWalking}
            onToggleWalk={handleToggleWalk}
            isSwordDrawn={isSwordDrawn}
            onToggleSword={handleToggleSword}
            onAttack={handleAttack}
          />

          <GameHUD
            animState={gameState.animState}
            isGrounded={gameState.isGrounded}
            onResetCamera={handleResetCamera}
            onOpenStory={handleOpenStory}
            onToggleSound={handleToggleSound}
            isMuted={isMuted}
            isWalking={isWalking}
            isSwordDrawn={isSwordDrawn}
          />
        </>
      )}

      {/* Cinematic Story Sequence */}
      {showStory && <StoryIntro onComplete={handleStoryComplete} />}
    </div>
  );
}
