<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DocumentItem } from '../types/documents'
import { Clock, Eye, FileDown, RefreshCcw, Share2 } from 'lucide-vue-next'

const props = defineProps<{
  apiBase: string
  docs: DocumentItem[]
  loading: boolean
  refreshing: boolean
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
const extendMinutes = ref('30')
const extendStatus = ref('')
const extendTarget = ref<DocumentItem | null>(null)

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

const openExtend = (doc: DocumentItem) => {
  extendTarget.value = doc
  extendMinutes.value = '30'
  extendStatus.value = ''
}

const closeExtend = () => {
  extendTarget.value = null
  extendMinutes.value = '30'
  extendStatus.value = ''
}

const extendDocument = async () => {
  if (!extendTarget.value) return
  const raw = extendMinutes.value || '30'
  const minutes = Number(raw)
  if (!Number.isFinite(minutes) || minutes <= 0) {
    extendStatus.value = 'Nhap so phut hop le'
    return
  }
  if (minutes > 720) {
    extendStatus.value = 'Toi da 720 phut'
    return
  }

  extendStatus.value = 'Dang gia han...'
  try {
    const response = await fetch(
      joinUrl(props.apiBase, `/api/documents/${extendTarget.value.id}/extend`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
      }
    )
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.message || 'Gia han that bai')
    }
    extendStatus.value = 'Da gia han'
    emit('refresh')
  } catch (err) {
    extendStatus.value = err instanceof Error ? err.message : 'Da co loi xay ra'
  }
}

watch(
  () => displayDocs.value.length,
  () => {
    page.value = Math.min(page.value, totalPages.value)
  }
)
</script>

<template>
  <section
    class="w-full rounded-2xl border border-[#e2d8ca] bg-white/90 p-5 shadow-[0_18px_45px_rgba(35,30,25,0.12)] backdrop-blur sm:p-7">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="mb-1 font-['Space\\ Grotesk'] text-xl">Danh sach file con han</h2>
        <p class="text-sm text-[#6f655b]">Cap nhat moi 30s, ban co the refresh thu cong.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <slot name="actions"></slot>
        <button
          class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#b3a79a] text-[#6f655b] transition hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60"
          type="button"
          :disabled="refreshing"
          @click="emit('refresh')"
          aria-label="Refresh"
          title="Refresh"
        >
          <RefreshCcw :size="18" :class="refreshing ? 'animate-spin' : ''" />
        </button>
      </div>
    </div>

    <div v-if="loading && displayDocs.length === 0" class="mt-4 space-y-3">
      <div v-for="n in perPage" :key="n"
        class="flex items-center justify-between gap-4 rounded-xl border border-dashed border-[#d6cbbb] bg-white/80 p-4 animate-pulse">
        <div class="space-y-2">
          <div class="h-4 w-40 rounded-full bg-teal-100/70"></div>
          <div class="flex gap-2">
            <div class="h-4 w-16 rounded-full bg-teal-100/70"></div>
            <div class="h-4 w-16 rounded-full bg-teal-100/70"></div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="h-4 w-16 rounded-full bg-teal-100/70"></div>
          <div class="h-8 w-16 rounded-full bg-teal-100/70"></div>
        </div>
      </div>
    </div>

    <div v-else-if="displayDocs.length === 0"
      class="mt-4 rounded-xl border border-dashed border-[#b3a79a] bg-white/70 px-6 py-8 text-center font-semibold text-[#6f655b]">
      Chua co file nao con han.
    </div>

    <div v-else class="mt-4">
      <div class="hidden sm:block">
        <div class="overflow-x-auto rounded-xl border border-[#e2d8ca] bg-white">
          <table class="w-full table-fixed text-left text-sm">
            <thead class="bg-[#eaf6f3] text-teal-800">
              <tr>
                <th class="w-[32%] px-4 py-3 font-semibold">Ten file</th>
                <th class="w-[22%] px-4 py-3 font-semibold">Loai</th>
                <th class="w-[12%] px-4 py-3 font-semibold">Dung luong</th>
                <th class="w-[12%] px-4 py-3 font-semibold">Het han</th>
                <th class="w-[22%] px-4 py-3 font-semibold">Hanh dong</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="doc in pagedDocs" :key="doc.id" class="border-b last:border-b-0">
                <td class="px-4 py-3 align-middle">
                  <div class="max-w-[260px] truncate font-semibold" :title="doc.originalName">
                    {{ doc.originalName }}
                  </div>
                </td>
                <td class="px-4 py-3 align-middle text-[#6f655b] break-all">
                  {{ doc.contentType }}
                </td>
                <td class="px-4 py-3 align-middle text-[#6f655b]">{{ formatBytes(doc.size) }}</td>
                <td class="px-4 py-3 align-middle">
                  <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold" :class="doc.isExpiringSoon
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-[#e0f1ee] text-teal-800'
                    " :title="`Het han sau ${doc.remainingSeconds}s`">
                    {{ formatRemaining(doc.remainingSeconds) }}
                  </span>
                </td>
                <td class="px-4 py-3 align-middle">
                  <div class="flex items-center gap-2">
                    <button v-if="isImageDoc(doc.contentType)"
                      class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#b3a79a] text-[#6f655b] transition hover:-translate-y-0.5 hover:shadow-sm"
                      type="button" @click="openPreview(joinUrl(apiBase, doc.downloadUrl), doc.originalName)"
                      aria-label="Xem" title="Xem">
                      <Eye :size="18" />
                    </button>
                    <button
                      class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#b3a79a] text-[#6f655b] transition hover:-translate-y-0.5 hover:shadow-sm"
                      type="button" @click="openExtend(doc)" aria-label="Gia han" title="Gia han">
                      <Clock :size="18" />
                    </button>
                    <button
                      class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#b3a79a] text-[#6f655b] transition hover:-translate-y-0.5 hover:shadow-sm"
                      type="button" @click="openShare(doc.id, doc.originalName)" aria-label="Chia se" title="Chia se">
                      <Share2 :size="18" />
                    </button>
                    <a class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-teal-500 text-teal-700 transition hover:-translate-y-0.5 hover:shadow-sm"
                      :href="joinUrl(apiBase, doc.downloadUrl)" target="_blank" rel="noreferrer" aria-label="Tai xuong"
                      title="Tai xuong">
                      <FileDown :size="18" />
                    </a>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="space-y-3 sm:hidden">
        <div v-for="doc in pagedDocs" :key="doc.id"
          class="rounded-xl border border-[#e2d8ca] bg-white/95 p-4 shadow-sm">
          <div class="text-sm font-semibold truncate" :title="doc.originalName">
            {{ doc.originalName }}
          </div>
          <div class="mt-1 text-xs text-[#6f655b] break-all">{{ doc.contentType }}</div>
          <div class="mt-3 flex items-center justify-between text-xs text-[#6f655b]">
            <span>{{ formatBytes(doc.size) }}</span>
            <span class="inline-flex items-center rounded-full px-3 py-1 text-[0.7rem] font-semibold" :class="doc.isExpiringSoon
              ? 'bg-orange-100 text-orange-700'
              : 'bg-[#e0f1ee] text-teal-800'
              " :title="`Het han sau ${doc.remainingSeconds}s`">
              {{ formatRemaining(doc.remainingSeconds) }}
            </span>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <button v-if="isImageDoc(doc.contentType)"
              class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#b3a79a] text-[#6f655b] transition hover:-translate-y-0.5 hover:shadow-sm"
              type="button" @click="openPreview(joinUrl(apiBase, doc.downloadUrl), doc.originalName)" aria-label="Xem"
              title="Xem">
              <Eye :size="18" />
            </button>
            <button
              class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#b3a79a] text-[#6f655b] transition hover:-translate-y-0.5 hover:shadow-sm"
              type="button" @click="openExtend(doc)" aria-label="Gia han" title="Gia han">
              <Clock :size="18" />
            </button>
            <button
              class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#b3a79a] text-[#6f655b] transition hover:-translate-y-0.5 hover:shadow-sm"
              type="button" @click="openShare(doc.id, doc.originalName)" aria-label="Chia se" title="Chia se">
              <Share2 :size="18" />
            </button>
            <a class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-teal-500 text-teal-700 transition hover:-translate-y-0.5 hover:shadow-sm"
              :href="joinUrl(apiBase, doc.downloadUrl)" target="_blank" rel="noreferrer" aria-label="Tai xuong"
              title="Tai xuong">
              <FileDown :size="18" />
            </a>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading && displayDocs.length > perPage" class="mt-4 flex items-center justify-center gap-4">
      <button
        class="rounded-full border border-[#b3a79a] px-4 py-2 text-sm text-[#6f655b] transition hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60"
        type="button" :disabled="!canPrev" @click="toPrev">
        Trang truoc
      </button>
      <span class="text-sm font-semibold text-[#6f655b]">Trang {{ page }} / {{ totalPages }}</span>
      <button
        class="rounded-full border border-[#b3a79a] px-4 py-2 text-sm text-[#6f655b] transition hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60"
        type="button" :disabled="!canNext" @click="toNext">
        Trang sau
      </button>
    </div>

    <Teleport to="body">
      <div v-if="previewUrl" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="closePreview">
        <div
          class="w-full max-w-2xl max-h-[85vh] overflow-auto rounded-2xl border border-[#e2d8ca] bg-white p-5 shadow-[0_18px_45px_rgba(35,30,25,0.12)]">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div class="font-semibold text-[#1f1b16] truncate" :title="previewName">{{ previewName }}</div>
            <button class="rounded-full border border-[#b3a79a] px-3 py-1 text-sm text-[#6f655b]" type="button"
              @click="closePreview">
              Dong
            </button>
          </div>
          <img class="max-h-[60vh] w-full rounded-xl bg-teal-50 object-contain" :src="previewUrl" :alt="previewName" />
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="shareUrl" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="closeShare">
        <div
          class="w-full max-w-lg max-h-[85vh] overflow-auto rounded-2xl border border-[#e2d8ca] bg-white p-5 shadow-[0_18px_45px_rgba(35,30,25,0.12)]">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div class="font-semibold text-[#1f1b16] truncate" :title="`Link chia se: ${shareName}`">
              Link chia se: {{ shareName }}
            </div>
            <button class="rounded-full border border-[#b3a79a] px-3 py-1 text-sm text-[#6f655b]" type="button"
              @click="closeShare">
              Dong
            </button>
          </div>
          <div class="grid gap-2">
            <input class="w-full rounded-xl border border-[#cfe3dd] bg-white px-3 py-2 text-sm text-[#1f1b16]"
              type="text" :value="shareUrl" readonly @focus="($event.target as HTMLInputElement).select()" />
            <div class="text-sm text-[#6f655b]">{{ shareStatus || 'Link nay mo trang chia se.' }}</div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <button class="rounded-full border border-[#b3a79a] px-4 py-2 text-sm text-[#6f655b]" type="button"
              @click="copyShare">
              Copy link
            </button>
            <a class="rounded-full border border-[#cfe3dd] px-4 py-2 text-sm text-teal-700" :href="shareUrl"
              target="_blank" rel="noreferrer">
              Mo trang chia se
            </a>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="extendTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="closeExtend">
        <div
          class="w-full max-w-md max-h-[85vh] overflow-auto rounded-2xl border border-[#e2d8ca] bg-white p-5 shadow-[0_18px_45px_rgba(35,30,25,0.12)]">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div class="font-semibold text-[#1f1b16] truncate" :title="`Gia han: ${extendTarget.originalName}`">
              Gia han: {{ extendTarget.originalName }}
            </div>
            <button class="rounded-full border border-[#b3a79a] px-3 py-1 text-sm text-[#6f655b]" type="button"
              @click="closeExtend">
              Dong
            </button>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <input class="w-24 rounded-full border border-[#cfe3dd] bg-white px-3 py-2 text-sm text-[#1f1b16]"
              type="number" min="1" max="720" step="10" v-model="extendMinutes" />
            <span class="text-sm text-[#6f655b]">phut (toi da 720)</span>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button
              class="rounded-full bg-gradient-to-r from-teal-700 to-orange-400 px-4 py-2 text-sm font-semibold text-white shadow-lg"
              type="button" @click="extendDocument">
              Gia han
            </button>
          </div>
          <div class="mt-2 text-sm text-[#6f655b]">{{ extendStatus }}</div>
        </div>
      </div>
    </Teleport>
  </section>
</template>
