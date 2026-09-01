import { ApiRequest } from './request.model';
import { ApiResponse } from './response.model';

export interface RequestTab {
  id: string;
  requestId?: string;
  draft: ApiRequest;
  response: ApiResponse | null;
  error: string | null;
  scriptError: string | null;
  isDirty: boolean;
  isLoading: boolean;
}
