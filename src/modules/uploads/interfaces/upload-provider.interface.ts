export interface IUploadProvider<
  T = any,
  R = { url: string; publicId?: string },
> {
  uploadFile(file: T): Promise<R>;
}
