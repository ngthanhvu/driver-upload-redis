<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import UploadCard from './components/UploadCard.vue'
import DocumentList from './components/DocumentList.vue'
import SharePage from './components/SharePage.vue'
import type { DocumentItem } from './types/documents'

const API_BASE = (import.meta.env.VITE_API_BASE || '').trim()

const docs = ref<DocumentItem[]>([])
const loading = ref(false)
const now = ref(Date.now())
const shareId = ref('')

const resolveShareId = () => {
  const match = window.location.pathname.match(/^\/share\/([^/]+)\/?$/)
  shareId.value = match?.[1] || ''
}

let tickTimer: number | undefined
let refreshTimer: number | undefined

const joinUrl = (base: string, path: string) => base.replace(/\/$/, '') + path

const fetchDocs = async () => {
  loading.value = true
  try {
    const response = await fetch(joinUrl(API_BASE, '/api/documents'))
    if (!response.ok) {
      throw new Error('Khong the tai danh sach')
    }
    const data = (await response.json()) as { items: DocumentItem[] }
    docs.value = data.items || []
  } finally {
    loading.value = false
  }
}

const refresh = async () => {
  await fetchDocs()
}

onMounted(async () => {
  resolveShareId()
  if (shareId.value) return
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
    <SharePage v-if="shareId" :api-base="API_BASE" :id="shareId" />
    <header class="hero" v-if="!shareId">
      <div>
        <p class="eyebrow">Redis document vault</p>
        <h1>Quan ly tai lieu tam thoi</h1>
        <p class="subtitle">
          Upload moi loai file duoi 20MB, luu trong Redis 1 gio, tai xuong bat cu luc nao khi con han.
        </p>
      </div>
    </header>

    <main class="grid" v-if="!shareId">
      <UploadCard :api-base="API_BASE" @uploaded="refresh" />

      <DocumentList
        :api-base="API_BASE"
        :docs="docs"
        :loading="loading"
        :now="now"
        @refresh="refresh"
      />
    </main>
  </div>
</template>
