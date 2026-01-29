export type DocumentItem = {
  id: string
  originalName: string
  contentType: string
  size: number
  expiresAt: number
  expiresInSeconds?: number
  downloadUrl: string
}
