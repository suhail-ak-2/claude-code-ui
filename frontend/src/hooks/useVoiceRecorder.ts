'use client';

import { useState, useRef } from 'react';

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startRecording = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        new Blob(chunks, { type: 'audio/wav' });
        // Here you would typically send the audio to a speech-to-text service
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      return true;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      return false;
    }
  };

  const stopRecording = (): string => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      mediaRecorderRef.current = null;
      return "[Voice input recorded - speech-to-text integration needed]";
    }
    return "";
  };

  return {
    isRecording,
    startRecording,
    stopRecording
  };
}