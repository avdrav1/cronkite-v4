// Node.js polyfills for browser APIs used by dependencies
// This file is injected by ESBuild at the very start of the bundle

// Polyfill for File API - required by @supabase/supabase-js in Node.js serverless environments
if (typeof globalThis.File === 'undefined') {
  (globalThis as any).File = class File {
    name: string;
    size: number;
    type: string;
    lastModified: number;
    
    constructor(
      bits: any[],
      name: string,
      options?: { type?: string; lastModified?: number }
    ) {
      this.name = name;
      this.size = 0;
      this.type = options?.type || '';
      this.lastModified = options?.lastModified || Date.now();
    }
    
    arrayBuffer(): Promise<ArrayBuffer> {
      return Promise.resolve(new ArrayBuffer(0));
    }
    
    slice(): any {
      return {};
    }
    
    stream(): any {
      return {};
    }
    
    text(): Promise<string> {
      return Promise.resolve('');
    }
  };
}
