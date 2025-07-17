export interface CCTVVideo {
  filename: string;
  timestamp: number;
  path: string;
  url?: string;
}

export interface CCTVResponse {
  videos: { [key: string]: string };
  closestIndex: number;
  offsetSeconds: number;
  cameraId: number;
  timestamps: { [key: string]: number };
  cameraStatus?: {
    cameraAvailable: boolean;
    cameraError: string | null;
    videoCount: number;
  };
}

export class CCTVService {
  private abortControllers = new Map<string, AbortController>();

  async getVideos(
    targetTimestamp: number, 
    cameraId: number, 
    options?: { timeout?: number; slow?: boolean }
  ): Promise<CCTVResponse> {
    const requestId = `${targetTimestamp}-${cameraId}`;
    
    // Cancel any existing request for this timestamp/camera
    this.cancelRequest(requestId);
    
    const controller = new AbortController();
    this.abortControllers.set(requestId, controller);
    
    const timeout = options?.timeout || 10000; // 10 second default timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const endpoint = options?.slow 
        ? `/api/cctv/videos-slow?target=${targetTimestamp}&camera=${cameraId}&delay=${timeout - 1000}`
        : `/api/cctv/videos?target=${targetTimestamp}&camera=${cameraId}`;
        
      console.log(`🎬 CCTV Request: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Convert array response to CCTVResponse format
      return {
        videos: data[0],
        closestIndex: data[1],
        offsetSeconds: data[2],
        cameraId: data[3],
        timestamps: data[4],
        cameraStatus: data[5] || { cameraAvailable: true, cameraError: null, videoCount: Object.keys(data[0]).length }
      };
    } catch (error) {
      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout/1000} seconds`);
      }
      
      console.error('Failed to fetch videos:', error);
      throw error;
    }
  }

  cancelRequest(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  cancelAllRequests(): void {
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
  }

  async checkHealth(): Promise<{ status: string; timestamp: number }> {
    try {
      const response = await fetch('/api/health');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  async eraseCache(): Promise<{ success: boolean; message: string; filesDeleted: number; sizeFreed: number }> {
    try {
      const response = await fetch('/api/cache', {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Cache erase failed:', error);
      throw error;
    }
  }

  // Test methods for edge cases
  async testSlowResponse(delayMs: number = 6000): Promise<CCTVResponse> {
    const requestId = `slow-test-${Date.now()}`;
    
    this.cancelRequest(requestId);
    const controller = new AbortController();
    this.abortControllers.set(requestId, controller);
    
    const timeout = delayMs + 2000; // Give extra time for slow endpoint
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      console.log(`🐌 Testing slow response with ${delayMs}ms delay`);
      
      const response = await fetch(`/api/cctv/videos-slow?delay=${delayMs}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        videos: data[0],
        closestIndex: data[1],
        offsetSeconds: data[2],
        cameraId: data[3],
        timestamps: data[4]
      };
    } catch (error) {
      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Slow response test timeout after ${timeout/1000} seconds`);
      }
      
      console.error('Slow response test failed:', error);
      throw error;
    }
  }

  async test404Response(): Promise<CCTVResponse> {
    try {
      console.log(`🚫 Testing 404 video response`);
      
      const response = await fetch('/api/cctv/videos-404');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        videos: data[0],
        closestIndex: data[1],
        offsetSeconds: data[2],
        cameraId: data[3],
        timestamps: data[4]
      };
    } catch (error) {
      console.error('404 response test failed:', error);
      throw error;
    }
  }
}