export interface WebViewMessage {
  command: string;
  payload?: unknown;
}

export interface Channel {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface SubChannel {
  id: string;
  name: string;
  created_at: string;
}

export interface ParentChannel {
  id: string;
  name: string;
  created_at: string;
  sub_channels: SubChannel[];
}

export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T | null;
}

export interface Message {
  id: string;
  username: string;
  content: string;
  created_at: string;
}

export interface ChannelsResponse extends ApiResponse<ParentChannel[]> {}
