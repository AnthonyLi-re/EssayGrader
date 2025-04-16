declare module 'pica' {
  export default class Pica {
    resize(from: HTMLImageElement, to: HTMLCanvasElement, options?: any): Promise<HTMLCanvasElement>;
    toBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob>;
  }
} 