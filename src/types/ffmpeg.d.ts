declare module '@ffmpeg/ffmpeg/dist/esm' {
  export class FFmpeg {
    constructor();
    load(): Promise<void>;
    writeFile(filename: string, data: Uint8Array): Promise<void>;
    exec(args: string[]): Promise<void>;
    readFile(filename: string): Promise<Uint8Array>;
  }
} 