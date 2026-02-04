export type DocumentItem = {
  id: string
  originalName: string
  contentType: string
  size: number
  permanent: boolean
  createdAt: number
  expiresAt: number | null
  expiresInSeconds?: number | null
  downloadUrl: string
}
