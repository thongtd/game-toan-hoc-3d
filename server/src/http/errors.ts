import type { ApiErrorCode } from '../../../shared/contracts/api.ts';

/**
 * Errors that are safe to show a client.
 *
 * Anything not thrown as an `HttpError` is treated as a bug and reported as a
 * generic 500 - stack traces and file paths never reach the browser.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly field: string | undefined;

  constructor(status: number, code: ApiErrorCode, message: string, field?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export const badRequest = (code: ApiErrorCode, message: string, field?: string): HttpError =>
  new HttpError(400, code, message, field);

export const unauthorized = (message = 'Bạn cần tạo hồ sơ trước nhé!'): HttpError =>
  new HttpError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Không thể thực hiện thao tác này.'): HttpError =>
  new HttpError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Không tìm thấy dữ liệu.'): HttpError =>
  new HttpError(404, 'NOT_FOUND', message);

export const tooManyRequests = (message = 'Bạn thao tác hơi nhanh, chờ một chút nhé!'): HttpError =>
  new HttpError(429, 'TOO_MANY_REQUESTS', message);

export const payloadTooLarge = (): HttpError =>
  new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Dữ liệu gửi lên quá lớn.');

export const unsupportedMediaType = (): HttpError =>
  new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Cần gửi dữ liệu dạng JSON.');

export const storageUnavailable = (): HttpError =>
  new HttpError(503, 'STORAGE_UNAVAILABLE', 'Máy chủ đang bận, bạn thử lại sau nhé!');
