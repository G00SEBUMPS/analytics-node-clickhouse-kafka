export interface ClientInfo {
  sdkVersion: string;
  deviceId: string;
  appBuild: string;
}

export interface EventBatch {
  batchId: string;
  sentAt: string;
  clientInfo: ClientInfo;
  events: Event[];
}

export interface Event {
  // Core Event Fields
  event_id: string;
  event_type: string;
  event_name: string;
  event_time: string;
  
  // User Context
  user_id: string;
  session_id: string;
  page_name: string;
  element_id?: string;
  referrer?: string;

  // Device Information
  device_type: 'mobile' | 'desktop' | 'tablet';
  platform: 'ios' | 'android' | 'web';
  app_version?: string;
  network_type?: 'wifi' | 'cellular' | 'unknown';

  // Content Information
  content?: {
    content_id: string;
    content_type: 'post' | 'comment' | 'story' | 'message' | 'ad';
    media_type: 'image' | 'video' | 'text' | 'audio';
    category?: string;
    is_sponsored?: boolean;
    age_hours?: number;
  };

  // Behavioral Data
  behavior?: {
    direction?: 'up' | 'down' | 'left' | 'right';
    position?: number;
    duration_ms?: number;
    scroll_depth?: number;
    zoom_level?: number;
    playback_position?: number;
    is_autoplay?: boolean;
  };

  // Performance Metrics
  performance?: {
    load_time_ms: number;
    connection_speed: 'slow' | 'medium' | 'fast';
  };

  // Location Data
  location?: {
    city?: string;
    country?: string;
    timezone?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    location_accuracy?: 'high' | 'medium' | 'low';
  };

  // Commerce Data
  commerce?: {
    product_id?: string;
    price?: number;
    currency?: string;
    transaction_id?: string;
    promotion_code?: string;
  };

  // Additional Contexts
  interaction?: Record<string, any>;
  experiments?: string[];
  extras?: Record<string, any>;
}
