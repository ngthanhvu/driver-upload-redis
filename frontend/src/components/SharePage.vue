<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const props = defineProps<{
  apiBase: string
  id: string
}>()

const joinUrl = (base: string, path: string) => base.replace(/\/$/, '') + path
const downloadUrl = computed(() => joinUrl(props.apiBase, `/api/documents/${props.id}`))

const loading = ref(true)
const error = ref('')
const fileName = ref('')
const contentType = ref('')
const size = ref(0)
const status = ref('')
const shareStatus = ref('')

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, index)
  return `${value.toFixed(value < 10 && index > 0 ? 1 : 0)} ${units[index]}`
}

const parseFilename = (disposition: string | null) => {
  if (!disposition) return ''
  const match = /filename="([^"]+)"/i.exec(disposition)
  return match?.[1] || ''
}

const fetchHead = async () => {
  const response = await fetch(downloadUrl.value, { method: 'HEAD' })
  if (!response.ok) {
    throw new Error('Khong tim thay file hoac da het han')
  }
  contentType.value = response.headers.get('content-type') || ''
  size.value = Number(response.headers.get('content-length') || 0)
  fileName.value = parseFilename(response.headers.get('content-disposition'))
}

const downloadFile = async () => {
  status.value = 'Dang tai...'
  try {
    const response = await fetch(downloadUrl.value)
    if (!response.ok) {
      throw new Error('Khong the tai file')
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName.value || `document-${props.id}`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    status.value = 'Da tai xuong'
  } catch (err) {
    status.value = err instanceof Error ? err.message : 'Da co loi xay ra'
  }
}

const isImage = computed(() => contentType.value.startsWith('image/'))
const shareLink = computed(() => `${window.location.origin}/share/${props.id}`)

const shareFile = async () => {
  shareStatus.value = ''
  try {
    if (navigator.share) {
      await navigator.share({
        title: fileName.value || 'Chia se tai lieu',
        text: 'Link chia se tai lieu',
        url: shareLink.value
      })
      shareStatus.value = 'Da chia se'
      return
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareLink.value)
      shareStatus.value = 'Da copy link'
      return
    }
    shareStatus.value = 'Trinh duyet khong ho tro chia se'
  } catch {
    shareStatus.value = 'Khong the chia se'
  }
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    await fetchHead()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Da co loi xay ra'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="card share-page">
    <div class="card-title">
      <h2>Chia se tai lieu</h2>
      <p>Link rut gon khong lo endpoint, file se het han sau 1 gio.</p>
    </div>

    <div v-if="loading" class="placeholder">Dang tai thong tin...</div>
    <div v-else-if="error" class="placeholder empty">{{ error }}</div>
    <div v-else class="share-body">
      <div class="share-preview">
        <img v-if="isImage" class="preview-image" :src="downloadUrl" :alt="fileName" />
        <div v-else class="preview-icon large">
          {{ (fileName || 'FILE').split('.').pop()?.slice(0, 4).toUpperCase() }}
        </div>
      </div>
      <div class="share-info">
        <div class="file-name">{{ fileName || `document-${id}` }}</div>
        <div class="file-meta">
          <span>{{ formatBytes(size) }}</span>
          <span>•</span>
          <span>{{ contentType || 'unknown' }}</span>
        </div>
        <div class="share-actions">
          <button class="button primary" style="width: 100%;" type="button" @click="downloadFile">Tai xuong</button>
        </div>
        <div class="share-status">{{ status }}</div>
        <div class="share-actions">
          <button class="button ghost" style="width: 100%;" type="button" @click="shareFile">Chia se</button>
        </div>
        <div class="share-status">{{ shareStatus }}</div>
      </div>
    </div>
  </section>
</template>
