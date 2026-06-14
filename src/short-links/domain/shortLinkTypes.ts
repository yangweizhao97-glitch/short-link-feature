export type ShortLinkStatus = "active" | "disabled";

export interface ShortLinkRecord {
  id: string;
  originalUrl: string;
  normalizedUrl: string;
  shortCode: string;
  shortUrl: string;
  status: ShortLinkStatus;
  clickCount: number;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface ApiResponse<TBody> {
  status: number;
  body: TBody;
}

export interface RedirectResponse {
  status: 302;
  headers: {
    Location: string;
  };
}
