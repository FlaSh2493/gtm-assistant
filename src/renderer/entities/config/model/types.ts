export interface AppConfig {
  enabled: boolean;
  mode: 'spec';
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
