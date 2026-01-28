<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

type DocumentItem = {
  id: string
  originalName: string
  contentType: string
  size: number
  expiresAt: number
  expiresInSeconds?: number
  downloadUrl: string
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

const docs = ref<DocumentItem[]>([])
const loading = ref(false)
const uploading = ref(false)
const error = ref('')
const success = ref('')
const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const now = ref(Date.now())

let tickTimer: number | undefined
let refreshTimer: number | undefined

const joinUrl = (base: string, path: string) => base.replace(/\/$/, '') + path

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, index)
  return `${value.toFixed(value < 10 && index > 0 ? 1 : 0)} ${units[index]}`
}

const formatRemaining = (seconds: number) => {
  const clamped = Math.max(0, seconds)
  const hours = Math.floor(clamped / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const secs = clamped % 60
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const displayDocs = computed(() =>
  [...docs.value]
    .map((doc) => {
      const remainingSeconds = Math.max(
        0,
        Math.floor((doc.expiresAt - now.value) / 1000)
      )
      return {
        ...doc,
        remainingSeconds,
        isExpiringSoon: remainingSeconds <= 120
      }
    })
    .sort((a, b) => a.expiresAt - b.expiresAt)
)

const fileLabel = computed(() => selectedFile.value?.name || 'Chon file hinh anh')

const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  selectedFile.value = target.files?.[0] || null
  success.value = ''
  error.value = ''
}

const fetchDocs = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(joinUrl(API_BASE, '/api/documents'))
    if (!response.ok) {
      throw new Error('Khong the tai danh sach')
    }
    const data = (await response.json()) as { items: DocumentItem[] }
    docs.value = data.items || []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Da co loi xay ra'
  } finally {
    loading.value = false
  }
}

const upload = async () => {
  if (!selectedFile.value) {
    error.value = 'Vui long chon file hinh anh'
    return
  }
  uploading.value = true
  success.value = ''
  error.value = ''
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    const response = await fetch(joinUrl(API_BASE, '/api/documents'), {
      method: 'POST',
      body: formData
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.message || 'Upload that bai')
    }
    success.value = 'Upload thanh cong'
    selectedFile.value = null
    if (fileInput.value) {
      fileInput.value.value = ''
    }
    await fetchDocs()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Da co loi xay ra'
  } finally {
    uploading.value = false
  }
}

const refresh = async () => {
  await fetchDocs()
}

onMounted(async () => {
  await fetchDocs()
  tickTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
  refreshTimer = window.setInterval(fetchDocs, 30000)
})

onBeforeUnmount(() => {
  if (tickTimer) window.clearInterval(tickTimer)
  if (refreshTimer) window.clearInterval(refreshTimer)
})
</script>

<template>
  <div class="page">
    <header class="hero">
      <div>
        <p class="eyebrow">Redis document vault</p>
        <h1>Quan ly tai lieu tam thoi</h1>
        <p class="subtitle">
          Upload anh tai lieu, luu trong Redis 1 gio, tai xuong bat cu luc nao khi con han.
        </p>
      </div>
      <div class="pulse-card">
        <div class="pulse-ring"></div>
        <div class="pulse-text">
          <span>TTL</span>
          <strong>60 phut</strong>
        </div>
      </div>
    </header>

    <main class="grid">
      <section class="card upload-card">
        <div class="card-title">
          <h2>Upload tai lieu</h2>
          <p>Chi chap nhan file hinh anh (jpg, png, webp...).</p>
        </div>
        <div class="uploader">
          <label class="file-input">
            <input ref="fileInput" type="file" accept="image/*" @change="onFileChange" />
            <span>{{ fileLabel }}</span>
          </label>
          <button class="button primary" type="button" :disabled="uploading" @click="upload">
            {{ uploading ? 'Dang upload...' : 'Upload ngay' }}
          </button>
        </div>
        <div class="status">
          <span v-if="error" class="error">{{ error }}</span>
          <span v-else-if="success" class="success">{{ success }}</span>
          <span v-else class="muted">Dung luong toi da 10MB.</span>
        </div>
      </section>

      <section class="card list-card">
        <div class="list-header">
          <div>
            <h2>Danh sach file con han</h2>
            <p>Cap nhat moi 30s, ban co the refresh thu cong.</p>
          </div>
          <button class="button ghost" type="button" :disabled="loading" @click="refresh">
            {{ loading ? 'Dang tai...' : 'Refresh' }}
          </button>
        </div>

        <div v-if="loading" class="placeholder">Dang tai danh sach...</div>
        <div v-else-if="displayDocs.length === 0" class="placeholder empty">
          Chua co file nao con han.
        </div>
        <div v-else class="list">
          <div v-for="doc in displayDocs" :key="doc.id" class="list-item">
            <div class="file-info">
              <div class="file-name">{{ doc.originalName }}</div>
              <div class="file-meta">
                <span>{{ formatBytes(doc.size) }}</span>
                <span>•</span>
                <span>{{ doc.contentType }}</span>
              </div>
            </div>
            <div class="file-actions">
              <span
                class="chip"
                :class="{ warn: doc.isExpiringSoon }"
                :title="`Het han sau ${doc.remainingSeconds}s`"
              >
                {{ formatRemaining(doc.remainingSeconds) }}
              </span>
              <a
                class="button secondary"
                :href="joinUrl(API_BASE, doc.downloadUrl)"
                target="_blank"
                rel="noreferrer"
              >
                Tai xuong
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
