<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import UploadCard from './components/UploadCard.vue'
import DocumentList from './components/DocumentList.vue'
import SharePage from './components/SharePage.vue'
import type { DocumentItem } from './types/documents'

const API_BASE = (import.meta.env.VITE_API_BASE || '').trim()

const docs = ref<DocumentItem[]>([])
const loading = ref(true)
const refreshing = ref(false)
const now = ref(Date.now())
const shareId = ref('')

const resolveShareId = () => {
  const match = window.location.pathname.match(/^\/share\/([^/]+)\/?$/)
  shareId.value = match?.[1] || ''
}

let tickTimer: number | undefined
let refreshTimer: number | undefined

const joinUrl = (base: string, path: string) => base.replace(/\/$/, '') + path

const fetchDocs = async (silent = false) => {
  if (!silent) {
    loading.value = true
  } else {
    refreshing.value = true
  }
  try {
    const response = await fetch(joinUrl(API_BASE, '/api/documents'))
    if (!response.ok) {
      throw new Error('Khong the tai danh sach')
    }
    const data = (await response.json()) as { items: DocumentItem[] }
    docs.value = data.items || []
  } finally {
    if (!silent) {
      loading.value = false
    }
    refreshing.value = false
  }
}

const refresh = async () => {
  await fetchDocs(true)
}

onMounted(async () => {
  resolveShareId()
  if (shareId.value) return
  await fetchDocs()
  tickTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
  refreshTimer = window.setInterval(() => fetchDocs(true), 30000)
})

onBeforeUnmount(() => {
  if (tickTimer) window.clearInterval(tickTimer)
  if (refreshTimer) window.clearInterval(refreshTimer)
})
</script>

<template>
  <div
    class="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,#fff8ed_0%,transparent_55%),radial-gradient(circle_at_15%_65%,#def4ef_0%,transparent_50%),linear-gradient(120deg,#f6efe5_0%,#e7f5f2_100%)] text-[#1f1b16] font-['IBM\\ Plex\\ Sans']">
    <div class="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-8 sm:py-10"
      :class="shareId ? 'justify-center' : ''">
      <SharePage v-if="shareId" :api-base="API_BASE" :id="shareId" />
      <header v-if="!shareId" class="mb-6 sm:mb-8">
        <div>
          <p class="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-teal-700">
            MinIO document vault
          </p>
          <h1 class="mb-3 font-['Space\\ Grotesk'] text-3xl sm:text-5xl">
            Quan ly tai lieu tren S3
          </h1>
          <p class="max-w-xl text-[#6f655b]">
            Upload moi loai file duoi 20MB len MinIO S3. Ban co the luu tam thoi hoac dung token de luu vinh vien.
          </p>
        </div>
      </header>

      <main v-if="!shareId" class="flex w-full justify-center">
        <DocumentList
          :api-base="API_BASE"
          :docs="docs"
          :loading="loading"
          :refreshing="refreshing"
          :now="now"
          @refresh="refresh"
        >
          <template #actions>
            <UploadCard :api-base="API_BASE" @uploaded="refresh" />
          </template>
        </DocumentList>
      </main>
    </div>
  </div>
</template>
