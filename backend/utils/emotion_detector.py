import tensorflow as tf
import numpy as np
import json
import os
from config import Config

class EmotionDetector:
    """Handles emotion detection using trained TensorFlow model"""
    
    def __init__(self):
        self.model = None
        self.class_indices = None
        self.emotion_labels = None
        self.load_model()
        self.load_class_indices()
        
    def load_model(self):
        """Load the trained Keras model"""
        try:
            model_path = Config.MODEL_PATH
            
            if not os.path.exists(model_path):
                raise FileNotFoundError(f"Model file not found at {model_path}")
            
            # Load model
            self.model = tf.keras.models.load_model(model_path)
            print(f"✅ Model loaded successfully from {model_path}")
            
            # Print model summary for verification
            print("\nModel Summary:")
            self.model.summary()
            
        except Exception as e:
            print(f"❌ Error loading model: {str(e)}")
            raise
    
    def load_class_indices(self):
        """Load class indices mapping from JSON file"""
        try:
            indices_path = Config.CLASS_INDICES_PATH
            
            if not os.path.exists(indices_path):
                raise FileNotFoundError(f"Class indices file not found at {indices_path}")
            
            with open(indices_path, 'r') as f:
                self.class_indices = json.load(f)
            
            # Create reverse mapping (index -> emotion label)
            self.emotion_labels = {v: k for k, v in self.class_indices.items()}
            
            print(f"✅ Class indices loaded: {self.class_indices}")
            
        except Exception as e:
            print(f"❌ Error loading class indices: {str(e)}")
            raise
    
    def predict_emotion(self, preprocessed_image):
        """
        Predict emotion from preprocessed image
        
        Args:
            preprocessed_image: Preprocessed image array (1, height, width, 1)
            
        Returns:
            dict: {
                'emotion': str,
                'confidence': float,
                'all_predictions': dict
            }
        """
        try:
            if self.model is None:
                raise ValueError("Model not loaded")
            
            # Get predictions
            predictions = self.model.predict(preprocessed_image, verbose=0)
            
            # Get predicted class index
            predicted_index = np.argmax(predictions[0])
            
            # Get confidence score
            confidence = float(predictions[0][predicted_index])
            
            # Get emotion label
            emotion = self.emotion_labels.get(predicted_index, 'unknown')
            
            # Get all predictions as dictionary
            all_predictions = {
                self.emotion_labels[i]: float(predictions[0][i])
                for i in range(len(predictions[0]))
            }
            
            result = {
                'emotion': emotion,
                'confidence': confidence,
                'all_predictions': all_predictions
            }
            
            return result
            
        except Exception as e:
            print(f"Error during emotion prediction: {str(e)}")
            return None
    
    def predict_with_threshold(self, preprocessed_image, threshold=0.5):
        """
        Predict emotion with confidence threshold
        
        Args:
            preprocessed_image: Preprocessed image array
            threshold: Minimum confidence threshold (default: 0.5)
            
        Returns:
            dict or None: Prediction result if confidence > threshold, else None
        """
        result = self.predict_emotion(preprocessed_image)
        
        if result and result['confidence'] >= threshold:
            return result
        else:
            return None
    
    def get_top_n_emotions(self, preprocessed_image, n=3):
        """
        Get top N emotions with their confidence scores
        
        Args:
            preprocessed_image: Preprocessed image array
            n: Number of top emotions to return
            
        Returns:
            list: List of tuples (emotion, confidence) sorted by confidence
        """
        try:
            predictions = self.model.predict(preprocessed_image, verbose=0)
            
            # Get top N indices
            top_indices = np.argsort(predictions[0])[-n:][::-1]
            
            # Create list of (emotion, confidence) tuples
            top_emotions = [
                (self.emotion_labels[idx], float(predictions[0][idx]))
                for idx in top_indices
            ]
            
            return top_emotions
            
        except Exception as e:
            print(f"Error getting top emotions: {str(e)}")
            return []
    
    def get_emotion_emoji(self, emotion):
        """
        Get emoji representation for emotion
        
        Args:
            emotion: Emotion label string
            
        Returns:
            str: Emoji character
        """
        return Config.EMOTION_EMOJIS.get(emotion.lower(), '😐')
    
    def batch_predict(self, preprocessed_images):
        """
        Predict emotions for multiple images at once
        
        Args:
            preprocessed_images: Array of preprocessed images
            
        Returns:
            list: List of prediction results
        """
        try:
            if self.model is None:
                raise ValueError("Model not loaded")
            
            # Get predictions for all images
            predictions = self.model.predict(preprocessed_images, verbose=0)
            
            results = []
            for pred in predictions:
                predicted_index = np.argmax(pred)
                confidence = float(pred[predicted_index])
                emotion = self.emotion_labels.get(predicted_index, 'unknown')
                
                all_predictions = {
                    self.emotion_labels[i]: float(pred[i])
                    for i in range(len(pred))
                }
                
                results.append({
                    'emotion': emotion,
                    'confidence': confidence,
                    'all_predictions': all_predictions
                })
            
            return results
            
        except Exception as e:
            print(f"Error during batch prediction: {str(e)}")
            return []
    
    def validate_model_input(self, image):
        """
        Validate that image has correct shape for model
        
        Args:
            image: Image array to validate
            
        Returns:
            bool: True if valid, False otherwise
        """
        expected_shape = (1, *Config.IMAGE_SIZE, 1)
        
        if image.shape != expected_shape:
            print(f"Invalid image shape: {image.shape}, expected: {expected_shape}")
            return False
        
        return True
    
    def get_model_info(self):
        """
        Get information about the loaded model
        
        Returns:
            dict: Model information
        """
        if self.model is None:
            return None
        
        return {
            'input_shape': self.model.input_shape,
            'output_shape': self.model.output_shape,
            'num_classes': len(self.emotion_labels),
            'emotions': list(self.emotion_labels.values()),
            'model_path': Config.MODEL_PATH
        }