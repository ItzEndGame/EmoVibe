import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';

/**
 * Face detection here is purely a client-side UX gate ("is a face visible
 * right now, and is there just one?") — it runs entirely in the browser via
 * face-api.js's TinyFaceDetector, polling the live video feed a few times a
 * second. It never sends frames anywhere.
 *
 * The actual emotion classification (your trained .keras model) still runs
 * server-side, once, on the single photo the user captures — nothing about
 * that pipeline changes. Keeping these separate is intentional: the .keras
 * model expects a clean cropped face and isn't meant to run per-frame over
 * the network just to enable a button.
 *
 * Model files required: download the "tiny_face_detector" weights from the
 * face-api.js repo (weights/tiny_face_detector_model-weights_manifest.json
 * + shard file) and place them in your app's `public/models/` folder. If
 * they're missing or fail to load, this fails CLOSED — capture is disabled
 * with a visible warning, rather than silently letting ungated photos through.
 *
 * Multiple-face policy: capture stays enabled (never blocked) when more than
 * one face is visible — just an informational note is shown. This matches
 * the backend's actual behavior (image_processor.py picks the largest face
 * via `max(faces, key=lambda f: f[2]*f[3])` and ignores the rest), so the
 * client doesn't refuse something the server would have handled fine.
 * Capture is only disabled when zero faces are detected.
 *
 * Two things reduce (but can't fully eliminate) disagreement with the
 * backend's OpenCV Haar Cascade check, which is a different algorithm and
 * won't always agree with this client-side detector on borderline frames:
 *   1. STABILITY: a face must be detected for a few consecutive polls before
 *      the UI turns green — filters out one-frame flickers/false positives.
 *   2. JUST-IN-TIME RE-CHECK: clicking Capture re-runs detection on the
 *      exact current frame before actually grabbing it, closing the gap
 *      between "last poll" (up to DETECT_INTERVAL_MS old) and the real
 *      capture instant.
 */

const MODEL_URL = '/models';
const DETECT_INTERVAL_MS = 400;
const REQUIRED_STABLE_FRAMES = 2; // ~800ms of continuous "face present" before going green
const DETECTOR_OPTIONS = new (faceapi.TinyFaceDetectorOptions)({ inputSize: 320, scoreThreshold: 0.6 });

const WebcamCapture = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectionTimerRef = useRef(null);
  const stableFramesRef = useRef(0);

  const [error, setError] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadFailed, setModelLoadFailed] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [captureBlockedMsg, setCaptureBlockedMsg] = useState('');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (detectionTimerRef.current) {
      clearInterval(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }
  }, []);

  // Camera setup — unchanged in behavior from before, just cleaned up to
  // use a ref for the stream so cleanup doesn't depend on stale state.
  useEffect(() => {
    const initCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
        });
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        setError('Unable to access camera. Please check permissions.');
        console.error('Camera error:', err);
      }
    };

    initCamera();
    return stopCamera;
  }, [stopCamera]);

  // Load the face detector once. Fails open — if this doesn't load (e.g.
  // model files haven't been added to /public/models yet), we simply skip
  // gating rather than leaving the whole camera feature unusable.
  useEffect(() => {
    let cancelled = false;
    faceapi.nets.tinyFaceDetector
      .loadFromUri(MODEL_URL)
      .then(() => {
        if (!cancelled) setModelsLoaded(true);
      })
      .catch((err) => {
        console.warn('Face detection models failed to load — capture gating disabled:', err);
        if (!cancelled) setModelLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll the live video for faces a few times a second while the detector
  // is ready and the camera has a stream. Slightly higher inputSize +
  // scoreThreshold than the defaults to cut down on false positives that
  // would disagree with the backend's stricter Haar Cascade check.
  useEffect(() => {
    if (!modelsLoaded || error) return;

    detectionTimerRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      try {
        const detections = await faceapi.detectAllFaces(video, DETECTOR_OPTIONS);

        if (detections.length === 0) {
          // No debounce needed on the way down — drop to "no face"
          // immediately so the UI never lies about the current frame.
          stableFramesRef.current = 0;
          setFaceCount(0);
        } else {
          stableFramesRef.current += 1;
          // Only "confirm" (and let the UI go green / enable capture)
          // once the face has held steady for a few consecutive polls.
          if (stableFramesRef.current >= REQUIRED_STABLE_FRAMES) {
            setFaceCount(detections.length);
          }
        }
      } catch (err) {
        console.error('Face detection error:', err);
      }
    }, DETECT_INTERVAL_MS);

    return () => {
      if (detectionTimerRef.current) clearInterval(detectionTimerRef.current);
    };
  }, [modelsLoaded, error]);

  // Gating logic: capture requires at least one face AND the detector to
  // have actually loaded. If the models failed to load, capture is
  // blocked (not silently allowed) — "no pic without a detected face" is
  // a hard rule now, not a best-effort nicety.
  const gatingActive = modelsLoaded && !modelLoadFailed;
  const canCapture = !error && gatingActive && faceCount >= 1;

  const captureImage = async () => {
    // Defensive check — the button is already disabled in this case, but
    // this guards against any way it could still be invoked.
    if (!canCapture) return;

    const video = videoRef.current;

    // Just-in-time re-check: the last poll could be up to
    // DETECT_INTERVAL_MS old, and a lot can change in 400ms. Re-run
    // detection on the exact frame we're about to grab, right now.
    try {
      const liveCheck = await faceapi.detectAllFaces(video, DETECTOR_OPTIONS);
      if (liveCheck.length === 0) {
        stableFramesRef.current = 0;
        setFaceCount(0);
        setCaptureBlockedMsg("Face wasn't detected at the exact moment of capture — hold still and try again.");
        setTimeout(() => setCaptureBlockedMsg(''), 3000);
        return;
      }
    } catch (err) {
      console.error('Pre-capture face check failed:', err);
      // If the check itself errors, fall through and let the backend be
      // the final word rather than blocking capture on a client-side glitch.
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      const file = new File([blob], 'webcam-capture.jpg', { type: 'image/jpeg' });
      const imageUrl = URL.createObjectURL(blob);
      onCapture(file, imageUrl);
      stopCamera();
      onClose();
    }, 'image/jpeg', 0.95);
  };

  let statusText = '';
  let statusColor = 'rgba(255, 255, 255, 0.6)';
  let frameColor = '#ef4444'; // red by default — no confirmed face yet

  if (modelLoadFailed) {
    statusText = '⚠️ Face detection unavailable — capture disabled. Check that the model files are in public/models.';
    statusColor = '#ef4444';
    frameColor = '#ef4444';
  } else if (gatingActive) {
    if (faceCount === 0) {
      statusText = '🔴 No face detected — center your face in the frame';
      statusColor = '#ef4444';
      frameColor = '#ef4444';
    } else if (faceCount === 1) {
      statusText = '🟢 Face detected — ready to capture';
      statusColor = '#22c55e';
      frameColor = '#22c55e';
    } else {
      statusText = "👥 Multiple faces detected — we'll focus on the largest one";
      statusColor = '#22c55e';
      frameColor = '#22c55e';
    }
  } else if (!modelsLoaded && !modelLoadFailed) {
    statusText = 'Loading face detection…';
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(2, 6, 12, 0.92)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(25px)',
        borderRadius: '24px',
        padding: '28px',
        maxWidth: '560px',
        width: '100%',
        border: '1px solid var(--glass-border)',
      }}>
        <h2 style={{
          textAlign: 'center',
          marginBottom: '20px',
          fontSize: '1.4rem',
          color: 'white',
        }}>
          📷 Capture Your Photo
        </h2>

        {error ? (
          <div className="error-message">{error}</div>
        ) : (
          <div style={{ position: 'relative' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                borderRadius: '16px',
                display: 'block',
                transform: 'scaleX(-1)', // Mirror the video
                background: '#04070d',
              }}
            />

            {/* Face-guide frame — color reflects live detection status */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '58%',
              height: '78%',
              border: `3px solid ${frameColor}`,
              borderRadius: '20px',
              pointerEvents: 'none',
              transition: 'border-color 0.25s ease',
            }} />

            {/* Status pill, top-left of the video */}
            {statusText && (
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                padding: '6px 14px',
                borderRadius: '999px',
                background: 'rgba(4, 11, 22, 0.75)',
                backdropFilter: 'blur(6px)',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: statusColor,
                border: `1px solid ${statusColor}55`,
              }}>
                {statusText}
              </div>
            )}
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '14px',
          marginTop: '22px',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <button
            onClick={captureImage}
            disabled={!canCapture}
            title={!canCapture && gatingActive ? statusText : undefined}
            style={{
              width: 'auto',
              padding: '14px 36px',
              borderRadius: '999px',
              border: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: canCapture ? 'pointer' : 'not-allowed',
              background: canCapture ? 'var(--primary-gradient)' : 'rgba(255, 255, 255, 0.08)',
              color: canCapture ? '#04130a' : 'rgba(255, 255, 255, 0.4)',
              boxShadow: canCapture ? '0 10px 25px rgba(143, 227, 77, 0.3)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            📸 Capture
          </button>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            style={{
              width: 'auto',
              padding: '14px 28px',
              borderRadius: '999px',
              border: '1px solid var(--glass-border)',
              background: 'transparent',
              color: 'rgba(255, 255, 255, 0.75)',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Cancel
          </button>
        </div>

        {!error && (
          <p style={{
            textAlign: 'center',
            marginTop: '14px',
            fontSize: '0.85rem',
            color: captureBlockedMsg ? '#ef4444' : 'rgba(255, 255, 255, 0.5)',
            fontWeight: captureBlockedMsg ? 600 : 400,
          }}>
            {captureBlockedMsg || 'Position your face inside the frame'}
          </p>
        )}
      </div>
    </div>
  );
};

export default WebcamCapture;