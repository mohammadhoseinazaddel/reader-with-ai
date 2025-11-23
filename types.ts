export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export enum AppState {
  IDLE = 'IDLE',
  SELECTING_SOURCE = 'SELECTING_SOURCE', // Waiting for file or screen
  CROPPING = 'CROPPING', // Image loaded, user selecting area
  PROCESSING = 'PROCESSING', // Sending to Gemini
  PLAYING = 'PLAYING', // Audio playback
  FINISHED = 'FINISHED', // Playback done, ready to share or replay
  ERROR = 'ERROR'
}

export interface AudioContextState {
  context: AudioContext;
  source: AudioBufferSourceNode | null;
}