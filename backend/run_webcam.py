import cv2
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.utils import img_to_array



import json

# Load model
model = tf.keras.models.load_model("backend/model/best_model.keras")

# Load class indices
with open("backend/model/class_indices.json", "r") as f:
    class_indices = json.load(f)
class_labels = {v:k for k,v in class_indices.items()}

# Load Haar Cascade for face detection
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

# Smoothing settings
history = []  # store last N predictions
N = 5         # number of frames to average

# Start webcam
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    display_frame = frame.copy()
    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Detect faces
    faces = face_cascade.detectMultiScale(gray_frame, scaleFactor=1.3, minNeighbors=5)

    for (x, y, w, h) in faces:
        # Draw rectangle around face
        cv2.rectangle(display_frame, (x, y), (x+w, y+h), (255, 0, 0), 2)

        # Extract face region and resize
        face_img = gray_frame[y:y+h, x:x+w]
        face_img = cv2.resize(face_img, (75,75))
        img_array = img_to_array(face_img)/255.0
        img_array = np.expand_dims(img_array, axis=0)

        # Predict
        preds = model.predict(img_array)[0]
        history.append(preds)
        if len(history) > N:
            history.pop(0)
        smoothed = np.mean(history, axis=0)

        # Get dominant emotion
        top_idx = np.argmax(smoothed)
        top_emotion = class_labels[top_idx]
        confidence = smoothed[top_idx]*100

        # Overlay dominant emotion
        text = f"{top_emotion}: {confidence:.2f}%"
        cv2.putText(display_frame, text, (x, y-10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,0), 2)

    # Show webcam window
    cv2.imshow("EmoTune Webcam", display_frame)

    # Quit on 'q'
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
