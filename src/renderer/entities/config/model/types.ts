export interface AppConfig {
  enabled: boolean;
  mode: 'spec';
  showHover: boolean;
  selector: {
    dataAttributes: string[];
  };
  measurementId?: string;
  gtmAuth?: {
    accountId: string;
    containerId: string;
    workspaceId: string;
    accessToken: string;
  };
}
