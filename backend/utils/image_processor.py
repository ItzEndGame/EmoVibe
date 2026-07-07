import cv2
import numpy as np
from PIL import Image
import base64
import io
import os
import logging
from datetime import datetime
from config import Config

# Setup logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ImageProcessor:
    """Handles all image preprocessing for emotion detection"""
    
    def __init__(self):
        self.image_size = Config.IMAGE_SIZE
        self.grayscale = Config.GRAYSCALE
        
        # Load OpenCV DNN face detector (res10 SSD, Caffe model)
        # Much more robust to lighting/angle than Haar Cascade, and only
        # runs once per capture, so the extra weight is a non-issue.
        prototxt_path = Config.DNN_FACE_PROTOTXT
        model_path = Config.DNN_FACE_MODEL
        
        if not os.path.exists(prototxt_path) or not os.path.exists(model_path):
            raise FileNotFoundError(
                f"DNN face detector files not found. Expected:\n"
                f"  {prototxt_path}\n  {model_path}\n"
                f"Download from opencv/opencv (deploy.prototxt) and "
                f"opencv/opencv_3rdparty (res10_300x300_ssd_iter_140000.caffemodel)."
            )
        
        self.face_net = cv2.dnn.readNetFromCaffe(prototxt_path, model_path)
        self.dnn_confidence_threshold = Config.DNN_FACE_CONFIDENCE
        logger.info(f"✅ OpenCV DNN face detector loaded (confidence threshold: {self.dnn_confidence_threshold})")
        
    def preprocess_for_model(self, image):
        """
        Preprocess image for model inference
        
        Args:
            image: numpy array (BGR or grayscale)
            
        Returns:
            Preprocessed image ready for model (shape: (1, height, width, 1))
        """
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
            
        # Resize to model input size
        resized = cv2.resize(gray, self.image_size)
        
        # Normalize pixel values to [0, 1]
        normalized = resized.astype('float32') / 255.0
        
        # Reshape for model: (1, height, width, 1)
        preprocessed = normalized.reshape(1, *self.image_size, 1)
        
        return preprocessed
    
    def detect_faces(self, image):
        """
        Detect faces in image using OpenCV's DNN face detector (res10 SSD).
        Much more robust to poor/uneven lighting than Haar Cascade.
        
        Args:
            image: numpy array (BGR color image; grayscale input is upsampled to 3ch)
            
        Returns:
            tuple: (faces, debug_info)
                faces: list of (x, y, w, h) tuples, sorted by DNN confidence not enforced here
                debug_info: dict of quality metrics + detection details
        """
        # DNN detector expects a 3-channel BGR image
        if len(image.shape) == 2:
            color_image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
            gray = image
        else:
            color_image = image
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        (h, w) = color_image.shape[:2]
        
        # Still track brightness/contrast for logging/debugging purposes,
        # even though the DNN detector doesn't need CLAHE to handle it.
        brightness = np.mean(gray)
        contrast = np.std(gray)
        
        debug_info = {
            'image_shape': gray.shape,
            'brightness': float(brightness),
            'contrast': float(contrast),
        }
        
        logger.debug(f"📸 Image Analysis - Brightness: {brightness:.1f}, Contrast: {contrast:.1f}")
        
        # Build blob and run detection
        blob = cv2.dnn.blobFromImage(
            cv2.resize(color_image, (300, 300)),
            1.0,
            (300, 300),
            (104.0, 177.0, 123.0)  # mean subtraction values the model was trained with
        )
        self.face_net.setInput(blob)
        detections = self.face_net.forward()
        
        faces = []
        confidences = []
        
        for i in range(detections.shape[2]):
            confidence = float(detections[0, 0, i, 2])
            
            if confidence < self.dnn_confidence_threshold:
                continue
            
            box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
            (x1, y1, x2, y2) = box.astype('int')
            
            # Clip to image bounds — DNN can occasionally propose
            # coordinates that spill slightly outside the frame
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            
            face_w, face_h = x2 - x1, y2 - y1
            if face_w <= 0 or face_h <= 0:
                continue
            
            faces.append((x1, y1, face_w, face_h))
            confidences.append(confidence)
            
            logger.debug(f"  Candidate face: box=({x1},{y1},{face_w},{face_h}), confidence={confidence:.3f}")
        
        debug_info['faces_detected'] = len(faces)
        debug_info['detection_confidences'] = [round(c, 3) for c in confidences]
        debug_info['dnn_confidence_threshold'] = self.dnn_confidence_threshold
        
        logger.info(f"✅ DNN face detection complete: {len(faces)} face(s) detected "
                    f"(threshold={self.dnn_confidence_threshold})")
        
        return faces, debug_info
    
    def extract_face_region(self, image, face_coords):
        """
        Extract face region from image
        
        Args:
            image: numpy array
            face_coords: tuple (x, y, w, h)
            
        Returns:
            Face region as numpy array
        """
        x, y, w, h = face_coords
        face_region = image[y:y+h, x:x+w]
        return face_region
    
    def process_uploaded_file(self, file_path):
        """
        Process uploaded image file
        
        Args:
            file_path: Path to uploaded image file
            
        Returns:
            tuple: (preprocessed_face, original_image, face_coords, debug_info) or (None, None, None, {}) if no face
        """
        try:
            logger.info(f"📁 Processing uploaded file: {file_path}")
            
            # Read image
            image = cv2.imread(file_path)
            
            if image is None:
                logger.error(f"❌ Failed to read image from {file_path}")
                return None, None, None, {'error': 'Could not read image file'}
            
            logger.debug(f"Image loaded: shape={image.shape}, dtype={image.dtype}")
            
            # Detect faces
            faces, debug_info = self.detect_faces(image)
            
            if len(faces) == 0:
                logger.warning(f"⚠️ No faces detected in uploaded file. Debug info: {debug_info}")
                return None, image, None, debug_info
            
            # Get largest face (assuming it's the primary subject)
            largest_face = max(faces, key=lambda face: face[2] * face[3])
            x, y, w, h = largest_face
            logger.info(f"✅ Processing largest face: position=({x},{y}), size=({w}x{h})")
            
            # Extract face region
            face_region = self.extract_face_region(image, largest_face)
            
            # Preprocess for model
            preprocessed = self.preprocess_for_model(face_region)
            debug_info['preprocessing_success'] = True
            
            return preprocessed, image, largest_face, debug_info
            
        except Exception as e:
            logger.exception(f"❌ Error processing uploaded file: {str(e)}")
            return None, None, None, {'error': str(e)}
    
    def process_base64_frame(self, base64_string):
        """
        Process base64 encoded image (from webcam)
        
        Args:
            base64_string: Base64 encoded image string
            
        Returns:
            tuple: (preprocessed_face, original_frame, face_coords, debug_info) or (None, None, None, {}) if no face
        """
        try:
            logger.debug("📹 Processing base64 frame from webcam")
            
            # Remove data URL prefix if present
            if ',' in base64_string:
                base64_string = base64_string.split(',')[1]
            
            # Decode base64
            image_data = base64.b64decode(base64_string)
            
            # Convert to numpy array
            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is None:
                logger.error("❌ Failed to decode base64 image")
                return None, None, None, {'error': 'Could not decode image'}
            
            logger.debug(f"Webcam frame decoded: shape={image.shape}, dtype={image.dtype}")
            
            # Detect faces
            faces, debug_info = self.detect_faces(image)
            
            if len(faces) == 0:
                logger.warning(f"⚠️ No faces detected in webcam frame. Debug info: {debug_info}")
                return None, image, None, debug_info
            
            # Get largest face
            largest_face = max(faces, key=lambda face: face[2] * face[3])
            x, y, w, h = largest_face
            logger.info(f"✅ Processing largest face from webcam: position=({x},{y}), size=({w}x{h})")
            
            # Extract face region
            face_region = self.extract_face_region(image, largest_face)
            
            # Preprocess for model
            preprocessed = self.preprocess_for_model(face_region)
            debug_info['preprocessing_success'] = True
            
            return preprocessed, image, largest_face, debug_info
            
        except Exception as e:
            logger.exception(f"❌ Error processing base64 frame: {str(e)}")
            return None, None, None, {'error': str(e)}
    
    def save_processed_image(self, image, output_path):
        """
        Save processed image to disk
        
        Args:
            image: numpy array
            output_path: Path to save image
        """
        try:
            cv2.imwrite(output_path, image)
            return True
        except Exception as e:
            print(f"Error saving image: {str(e)}")
            return False
    
    def draw_emotion_on_image(self, image, face_coords, emotion, confidence):
        """
        Draw emotion label and bounding box on image
        
        Args:
            image: numpy array
            face_coords: tuple (x, y, w, h)
            emotion: string
            confidence: float
            
        Returns:
            Image with annotations
        """
        x, y, w, h = face_coords
        
        # Create copy to avoid modifying original
        annotated = image.copy()
        
        # Draw rectangle around face
        cv2.rectangle(annotated, (x, y), (x+w, y+h), (0, 255, 0), 2)
        
        # Prepare text
        label = f"{emotion}: {confidence:.1%}"
        
        # Calculate text size and position
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.7
        thickness = 2
        (text_width, text_height), baseline = cv2.getTextSize(label, font, font_scale, thickness)
        
        # Draw background rectangle for text
        cv2.rectangle(
            annotated,
            (x, y - text_height - 10),
            (x + text_width, y),
            (0, 255, 0),
            -1
        )
        
        # Draw text
        cv2.putText(
            annotated,
            label,
            (x, y - 5),
            font,
            font_scale,
            (0, 0, 0),
            thickness
        )
        
        return annotated
    
    def validate_file_extension(self, filename):
        """
        Check if file has allowed extension
        
        Args:
            filename: Name of file to check
            
        Returns:
            Boolean indicating if extension is allowed
        """
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS
    
    def process_profile_picture(self, file_path, output_path):
        """
        Process and resize profile picture
        
        Args:
            file_path: Path to uploaded profile picture
            output_path: Path to save processed picture
            
        Returns:
            Boolean indicating success
        """
        try:
            # Open image with PIL
            img = Image.open(file_path)
            
            # Convert to RGB if necessary
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize to 300x300 (profile picture size)
            img = img.resize((300, 300), Image.Resampling.LANCZOS)
            
            # Save
            img.save(output_path, 'JPEG', quality=90)
            
            return True
            
        except Exception as e:
            print(f"Error processing profile picture: {str(e)}")
            return False