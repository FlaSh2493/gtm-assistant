export interface EventParameter {
  key: string;
  value?: string;
  description?: string; // Description for verification or planning
  type?: 'literal' | 'dataLayer' | 'dom' | 'storage' | 'cookie' | 'js';
}

export interface EventSpec {
  id: string; // uuid

  // Page Info
  pageUrl: string; // e.g., /product/*
  pageDescription: string;
  category: string;

  // Event Info
  eventType?: 'element' | 'page' | 'custom'; // Type of event
  eventId: string; // e.g., EVT-001
  eventName: string; // e.g., view_item
  triggerDescription: string;

  // Element Info
  selector: string;
  elementSnapshot?: string; // outerHTML snippet

  // Parameters
  parameters: EventParameter[];

  // Metadata
  note?: string;
  createdAt: string;
  visible: boolean;
}

export interface CSVColumn {
  id: string;
  label: string;
  field: keyof EventSpec | 'parameters' | 'custom';
  enabled: boolean;
  order: number;
}

export interface AppConfig {
  enabled: boolean;
  mode: 'spec' | 'verify' | 'view';
  showHover: boolean;
  selector: {
    dataAttributes: string[];
  };
  gtmAuth?: {
    accountId: string;
    containerId: string;
    workspaceId: string;
    accessToken: string;
  };
}
