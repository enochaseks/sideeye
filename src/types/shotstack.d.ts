declare module '@shotstack/nodejs-sdk' {
  export class Shotstack {
    constructor(config: { apiKey: string; host: string });
    
    render(edit: any): Promise<{
      response: {
        id: string;
        url: string;
        status: string;
      };
    }>;

    getRender(id: string): Promise<{
      response: {
        id: string;
        url: string;
        status: string;
      };
    }>;
  }
} 