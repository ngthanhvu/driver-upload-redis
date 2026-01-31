<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DocumentItem } from '../types/documents'

const props = defineProps<{
  apiBase: string
  docs: DocumentItem[]
  loading: boolean
  now: number
}>()

const emit = defineEmits<{ (e: 'refresh'): void }>()

const page = ref(1)
const perPage = 6
const previewUrl = ref('')
const previewName = ref('')
const shareUrl = ref('')
const shareName = ref('')
const shareStatus = ref('')

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
  [...props.docs]
    .map((doc) => {
      const remainingSeconds = Math.max(0, Math.floor((doc.expiresAt - props.now) / 1000))
      return {
        ...doc,
        remainingSeconds,
        isExpiringSoon: remainingSeconds <= 120
      }
    })
    .sort((a, b) => a.expiresAt - b.expiresAt)
)

const totalPages = computed(() => Math.max(1, Math.ceil(displayDocs.value.length / perPage)))

const pagedDocs = computed(() => {
  const start = (page.value - 1) * perPage
  return displayDocs.value.slice(start, start + perPage)
})

const canPrev = computed(() => page.value > 1)
const canNext = computed(() => page.value < totalPages.value)

const toPrev = () => {
  if (canPrev.value) page.value -= 1
}

const toNext = () => {
  if (canNext.value) page.value += 1
}

const openPreview = (url: string, name: string) => {
  previewUrl.value = url
  previewName.value = name
}

const closePreview = () => {
  previewUrl.value = ''
  previewName.value = ''
}

const openShare = (id: string, name: string) => {
  shareUrl.value = `${window.location.origin}/share/${id}`
  shareName.value = name
  shareStatus.value = ''
}

const closeShare = () => {
  shareUrl.value = ''
  shareName.value = ''
  shareStatus.value = ''
}

const copyShare = async () => {
  if (!shareUrl.value) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl.value)
      shareStatus.value = 'Da copy link'
    } else {
      shareStatus.value = 'Trinh duyet khong ho tro copy'
    }
  } catch {
    shareStatus.value = 'Khong the copy link'
  }
}

const isImageDoc = (contentType: string) => contentType?.startsWith('image/')

watch(
  () => displayDocs.value.length,
  () => {
    page.value = Math.min(page.value, totalPages.value)
  }
)
</script>

<template>
  <section class="card list-card">
    <div class="list-header">
      <div>
        <h2>Danh sach file con han</h2>
        <p>Cap nhat moi 30s, ban co the refresh thu cong.</p>
      </div>
      <button class="button ghost" type="button" :disabled="loading" @click="emit('refresh')">
        {{ loading ? 'Dang tai...' : 'Refresh' }}
      </button>
    </div>

    <div v-if="loading" class="list">
      <div v-for="n in perPage" :key="n" class="list-item skeleton-item">
        <div class="file-info">
          <div class="skeleton skeleton-title"></div>
          <div class="file-meta">
            <span class="skeleton skeleton-chip"></span>
            <span class="skeleton skeleton-chip"></span>
          </div>
        </div>
        <div class="file-actions">
          <span class="skeleton skeleton-chip"></span>
          <span class="skeleton skeleton-button"></span>
        </div>
      </div>
    </div>
    <div v-else-if="displayDocs.length === 0" class="placeholder empty">
      Chua co file nao con han.
    </div>
    <div v-else class="list">
      <div v-for="doc in pagedDocs" :key="doc.id" class="list-item">
        <div class="file-info">
          <div class="file-name">{{ doc.originalName }}</div>
          <div class="file-meta">
            <span>{{ formatBytes(doc.size) }}</span>
            <span>•</span>
            <span>{{ doc.contentType }}</span>
          </div>
        </div>
        <div class="file-actions">
          <span class="chip" :class="{ warn: doc.isExpiringSoon }" :title="`Het han sau ${doc.remainingSeconds}s`">
            {{ formatRemaining(doc.remainingSeconds) }}
          </span>
          <button
            v-if="isImageDoc(doc.contentType)"
            class="button ghost"
            type="button"
            @click="openPreview(joinUrl(apiBase, doc.downloadUrl), doc.originalName)"
          >
            Xem
          </button>
          <button
            class="button ghost"
            type="button"
            @click="openShare(doc.id, doc.originalName)"
          >
            Chia se
          </button>
          <a
            class="button secondary"
            :href="joinUrl(apiBase, doc.downloadUrl)"
            target="_blank"
            rel="noreferrer"
          >
            Tai xuong
          </a>
        </div>
      </div>
    </div>

    <div v-if="!loading && displayDocs.length > perPage" class="pagination">
      <button class="button ghost" type="button" :disabled="!canPrev" @click="toPrev">
        Trang truoc
      </button>
      <span class="page-status">Trang {{ page }} / {{ totalPages }}</span>
      <button class="button ghost" type="button" :disabled="!canNext" @click="toNext">
        Trang sau
      </button>
    </div>

    <div v-if="previewUrl" class="preview-overlay" @click.self="closePreview">
      <div class="preview-modal">
        <div class="preview-header">
          <div class="preview-title">{{ previewName }}</div>
          <button class="button ghost" type="button" @click="closePreview">Dong</button>
        </div>
        <img class="preview-image" :src="previewUrl" :alt="previewName" />
      </div>
    </div>

    <div v-if="shareUrl" class="preview-overlay" @click.self="closeShare">
      <div class="share-modal">
        <div class="preview-header">
          <div class="preview-title">Link chia se: {{ shareName }}</div>
          <button class="button ghost" type="button" @click="closeShare">Dong</button>
        </div>
        <div class="share-field">
          <input
            class="share-link"
            type="text"
            :value="shareUrl"
            readonly
            @focus="($event.target as HTMLInputElement).select()"
          />
          <div class="share-status">{{ shareStatus || 'Link nay mo trang chia se.' }}</div>
        </div>
        <div class="share-actions">
          <button class="button ghost" type="button" @click="copyShare">Copy link</button>
          <a class="button secondary" :href="shareUrl" target="_blank" rel="noreferrer">
            Mo trang chia se
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
