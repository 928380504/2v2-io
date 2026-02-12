declare module 'gif.js' {
  interface GifOptions {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    background?: string;
    repeat?: number;
    workerScript?: string;
  }

  interface GifFrame {
    data: ImageData | HTMLCanvasElement | HTMLImageElement;
    delay?: number;
  }

  class GIF {
    constructor(options: GifOptions);
    addFrame(frame: HTMLCanvasElement, options?: { delay: number }): void;
    on(event: 'finished', callback: (blob: Blob) => void): void;
    on(event: 'error', callback: (error: Error) => void): void;
    render(): void;
  }

  export default GIF;
} 