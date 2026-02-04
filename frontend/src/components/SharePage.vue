<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CloudDownload, Share2 } from 'lucide-vue-next'

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
const permanent = ref(false)
const expiresAt = ref<number | null>(null)

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
  permanent.value = (response.headers.get('x-document-permanent') || '').toLowerCase() === 'true'
  const rawExpiresAt = Number(response.headers.get('x-document-expires-at') || 0)
  expiresAt.value = Number.isFinite(rawExpiresAt) && rawExpiresAt > 0 ? rawExpiresAt : null
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
  <section
    class="w-full max-w-5xl rounded-2xl border border-[#e2d8ca] bg-white/90 p-5 shadow-[0_18px_45px_rgba(35,30,25,0.12)] backdrop-blur sm:p-7">
    <div class="mb-4">
      <h2 class="mb-1 font-['Space\\ Grotesk'] text-xl">Chia se tai lieu</h2>
      <p class="text-sm text-[#6f655b]">
        {{ permanent ? 'File duoc luu vinh vien.' : 'Link rut gon, file se tu dong het han.' }}
      </p>
    </div>

    <div v-if="loading"
      class="rounded-xl border border-dashed border-[#b3a79a] bg-white/70 px-6 py-8 text-center text-sm text-[#6f655b]">
      Dang tai thong tin...
    </div>
    <div v-else-if="error"
      class="rounded-xl border border-dashed border-[#b3a79a] bg-white/70 px-6 py-8 text-center text-sm font-semibold text-[#6f655b]">
      {{ error }}
    </div>
    <div v-else class="grid gap-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <div>
        <img v-if="isImage" class="max-h-[50vh] w-full rounded-xl bg-teal-50 object-contain" :src="downloadUrl"
          :alt="fileName" />
        <div v-else
          class="grid h-56 place-items-center rounded-xl bg-teal-50 text-xl font-bold tracking-[0.2em] text-teal-800">
          {{ (fileName || 'FILE').split('.').pop()?.slice(0, 4).toUpperCase() }}
        </div>
      </div>
      <div class="grid content-start gap-3">
        <div class="text-base font-semibold truncate" :title="fileName || `document-${id}`">
          {{ fileName || `document-${id}` }}
        </div>
        <div class="flex items-center gap-2 text-sm text-[#6f655b]">
          <span>{{ formatBytes(size) }}</span>
          <span>•</span>
          <span class="break-all">{{ contentType || 'unknown' }}</span>
        </div>
        <div class="text-sm text-[#6f655b]">
          {{
            permanent
              ? 'Trang thai: Vinh vien'
              : expiresAt
                ? `Het han luc ${new Date(expiresAt).toLocaleString()}`
                : 'Trang thai: Tam thoi'
          }}
        </div>
        <button class="flex w-full items-center justify-center gap-2 rounded-full
          bg-linear-to-r from-teal-700 to-orange-400
          px-4 py-3 text-xs font-semibold text-white shadow" type="button" @click="downloadFile">
          <CloudDownload class="h-4 w-4" />
          <span>Tai xuong</span>
        </button>
        <div class="text-sm text-[#6f655b]">{{ status }}</div>
        <button
          class="flex w-full items-center justify-center gap-2 rounded-full border border-[#b3a79a] px-3 py-3 text-xs text-[#6f655b]"
          type="button" @click="shareFile">
          <Share2 class="h-4 w-4" /> Chia se
        </button>
        <div class="text-sm text-[#6f655b]">{{ shareStatus }}</div>
      </div>
    </div>
  </section>
</template>
