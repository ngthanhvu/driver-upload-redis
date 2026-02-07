<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Upload } from 'lucide-vue-next'

const props = defineProps<{ apiBase: string }>()
const emit = defineEmits<{ (e: 'uploaded'): void }>()

type UploadStatus = 'pending' | 'uploading' | 'success' | 'error'
type UploadQueueItem = {
  id: string
  file: File
  progress: number
  status: UploadStatus
  error?: string
}

const selectedFiles = ref<File[]>([])
const previewUrls = ref<string[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const error = ref('')
const success = ref('')
const isDragging = ref(false)
const dragCounter = ref(0)
const isDialogOpen = ref(false)
const uploadMode = ref<'temp' | 'permanent'>('temp')
const uploadToken = ref('')
const queue = ref<UploadQueueItem[]>([])

const joinUrl = (base: string, path: string) => base.replace(/\/$/, '') + path
const MAX_FILE_SIZE = 250 * 1024 * 1024

const fileLabel = computed(() => {
  if (selectedFiles.value.length === 0) return 'Chon file'
  if (selectedFiles.value.length === 1) {
    const firstFile = selectedFiles.value[0]
    return firstFile ? firstFile.name : 'Chon file'
  }
  return `Da chon ${selectedFiles.value.length} files`
})

const totalProgress = computed(() => {
  if (queue.value.length === 0) return 0
  const sum = queue.value.reduce((total, item) => total + item.progress, 0)
  return Math.round(sum / queue.value.length)
})

const clearPreviews = () => {
  previewUrls.value.forEach((url) => {
    if (url) URL.revokeObjectURL(url)
  })
  previewUrls.value = []
}

const resetSelection = () => {
  clearPreviews()
  selectedFiles.value = []
  previewUrls.value = []
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const formatBytes = (size: number) => {
  if (size < 1024) return `${size} B`
  const kb = size / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}

const setFiles = (files: File[]) => {
  if (uploading.value) return
  clearPreviews()
  selectedFiles.value = files
  previewUrls.value = files.map((file) =>
    file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
  )
  success.value = ''
  error.value = ''
  queue.value = []
}

const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  setFiles(files)
}

const onDragEnter = (event: DragEvent) => {
  event.preventDefault()
  dragCounter.value += 1
  isDragging.value = true
}

const onDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const onDragLeave = (event: DragEvent) => {
  event.preventDefault()
  dragCounter.value = Math.max(0, dragCounter.value - 1)
  if (dragCounter.value === 0) {
    isDragging.value = false
  }
}

const onDrop = (event: DragEvent) => {
  event.preventDefault()
  dragCounter.value = 0
  isDragging.value = false
  const files = Array.from(event.dataTransfer?.files || [])
  setFiles(files)
}

const createQueueItems = (files: File[]): UploadQueueItem[] =>
  files.map((file, index) => ({
    id: `${Date.now()}-${index}-${file.name}`,
    file,
    progress: 0,
    status: 'pending' as UploadStatus,
    error: ''
  }))

const statusLabel = (status: UploadStatus) => {
  if (status === 'pending') return 'Cho'
  if (status === 'uploading') return 'Dang upload'
  if (status === 'success') return 'Thanh cong'
  return 'Loi'
}

const statusTextClass = (status: UploadStatus) => {
  if (status === 'error') return 'text-red-600'
  if (status === 'success') return 'text-emerald-600'
  if (status === 'uploading') return 'text-teal-700'
  return 'text-[#6f655b]'
}

const progressClass = (status: UploadStatus) => {
  if (status === 'error') return 'bg-red-500'
  if (status === 'success') return 'bg-emerald-500'
  return 'bg-teal-600'
}

const uploadFileWithProgress = (item: UploadQueueItem, path: string, token?: string) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', joinUrl(props.apiBase, path))
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      item.progress = Math.round((event.loaded / event.total) * 100)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        item.progress = 100
        resolve()
        return
      }
      let message = 'Upload that bai'
      try {
        const data = JSON.parse(xhr.responseText || '{}') as { message?: string }
        if (data?.message) message = data.message
      } catch {
        // ignore parse errors
      }
      reject(new Error(message))
    }

    xhr.onerror = () => {
      reject(new Error('Khong the ket noi may chu'))
    }

    const formData = new FormData()
    formData.append('file', item.file)
    xhr.send(formData)
  })

const upload = async () => {
  if (selectedFiles.value.length === 0) {
    error.value = 'Vui long chon file'
    return
  }

  if (uploadMode.value === 'permanent' && !uploadToken.value.trim()) {
    error.value = 'Can nhap token de upload vinh vien'
    return
  }

  const oversizeFiles = selectedFiles.value.filter((file) => file.size > MAX_FILE_SIZE)
  if (oversizeFiles.length > 0) {
    error.value = 'File vuot qua 250MB, vui long chon file nho hon'
    return
  }

  uploading.value = true
  success.value = ''
  error.value = ''
  try {
    let successCount = 0
    let errorCount = 0
    let firstErrorMessage = ''
    const path = uploadMode.value === 'permanent' ? '/api/documents/permanent' : '/api/documents'

    const items = createQueueItems(selectedFiles.value)
    queue.value = items

    for (const item of items) {
      item.status = 'uploading'
      item.progress = 0
      try {
        await uploadFileWithProgress(
          item,
          path,
          uploadMode.value === 'permanent' ? uploadToken.value.trim() : undefined
        )
        item.status = 'success'
        item.progress = 100
        successCount += 1
        queue.value = queue.value.filter((entry) => entry.id !== item.id)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Da co loi xay ra'
        item.status = 'error'
        item.error = message
        errorCount += 1
        if (!firstErrorMessage) firstErrorMessage = message
      }
    }

    if (errorCount > 0) {
      error.value =
        errorCount === 1
          ? firstErrorMessage || 'Co 1 file upload loi'
          : `Co ${errorCount} file upload loi`
    } else {
      if (uploadMode.value === 'permanent') {
        success.value =
          successCount === 1
            ? 'Upload vinh vien thanh cong'
            : `Upload vinh vien thanh cong ${successCount} files`
      } else {
        success.value =
          successCount === 1
            ? 'Upload tam thoi thanh cong'
            : `Upload tam thoi thanh cong ${successCount} files`
      }
    }

    if (successCount > 0) {
      emit('uploaded')
    }
    resetSelection()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Da co loi xay ra'
  } finally {
    uploading.value = false
  }
}

onBeforeUnmount(() => {
  clearPreviews()
})
</script>

<template>
  <div>
    <button
      class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-teal-700 to-orange-400 text-white shadow-lg transition hover:-translate-y-0.5"
      type="button"
      @click="isDialogOpen = true"
      aria-label="Upload"
      title="Upload"
    >
      <Upload :size="18" />
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="isDialogOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="isDialogOpen = false"
    >
      <div class="w-full max-w-2xl max-h-[85vh] overflow-auto rounded-2xl border border-[#e2d8ca] bg-white p-5 shadow-[0_18px_45px_rgba(35,30,25,0.12)]">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="font-semibold text-[#1f1b16]">Upload tai lieu</div>
          <button
            class="rounded-full border border-[#b3a79a] px-3 py-1 text-sm text-[#6f655b]"
            type="button"
            @click="isDialogOpen = false"
          >
            Dong
          </button>
        </div>

        <div class="mb-3 flex flex-wrap items-center gap-4 text-sm text-[#6f655b]">
          <label class="inline-flex items-center gap-2">
            <input v-model="uploadMode" type="radio" value="temp" />
            <span>Tam thoi (1 gio)</span>
          </label>
          <label class="inline-flex items-center gap-2">
            <input v-model="uploadMode" type="radio" value="permanent" />
            <span>Vinh vien (can token)</span>
          </label>
        </div>

        <input
          v-if="uploadMode === 'permanent'"
          v-model="uploadToken"
          class="mb-3 w-full rounded-xl border border-[#cfe3dd] bg-white px-3 py-2 text-sm text-[#1f1b16]"
          type="password"
          placeholder="Nhap upload token"
        />

        <div
          class="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed px-4 py-3"
          :class="isDragging ? 'border-teal-600 bg-teal-50' : 'border-teal-200 bg-white/80'"
          @dragenter="onDragEnter"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <label class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-teal-400 px-4 py-2 text-sm font-semibold text-teal-700">
            <input ref="fileInput" class="hidden" type="file" multiple :disabled="uploading" @change="onFileChange" />
            <span>{{ fileLabel }}</span>
          </label>
          <span class="text-sm text-[#6f655b]">Keo tha file vao day hoac bam de chon.</span>
        </div>
        <div v-if="previewUrls.length > 0" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <div
            v-for="(url, index) in previewUrls"
            :key="`${selectedFiles[index]?.name || 'file'}-${index}`"
            class="rounded-xl border border-teal-100 bg-white p-2"
          >
            <img v-if="url" class="h-24 w-full rounded-lg object-cover" :src="url" :alt="selectedFiles[index]?.name || 'preview'" />
            <div v-else class="grid h-24 place-items-center rounded-lg bg-teal-50 text-sm font-bold tracking-widest text-teal-800">
              {{
                (selectedFiles[index]?.name || 'FILE')
                  .split('.')
                  .pop()
                  ?.slice(0, 4)
                  .toUpperCase()
              }}
            </div>
            <div class="mt-2 text-xs text-[#6f655b] break-all">{{ selectedFiles[index]?.name }}</div>
          </div>
        </div>
        <div v-if="queue.length > 0" class="mt-4">
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6f655b]">
            <span>Hang cho: {{ queue.length }} file</span>
            <span v-if="uploading">Tong tien do: {{ totalProgress }}%</span>
          </div>
          <div class="mt-2 h-2 w-full rounded-full bg-teal-100">
            <div class="h-2 rounded-full bg-teal-600 transition-all" :style="{ width: `${totalProgress}%` }"></div>
          </div>
          <div class="mt-3 space-y-2">
            <div
              v-for="item in queue"
              :key="item.id"
              class="rounded-xl border border-teal-100 bg-white px-3 py-2"
            >
              <div class="flex items-center justify-between gap-2 text-sm">
                <div class="flex-1 truncate font-medium text-[#1f1b16]">{{ item.file.name }}</div>
                <div class="text-xs text-[#6f655b]">{{ formatBytes(item.file.size) }}</div>
              </div>
              <div class="mt-2 flex items-center gap-2">
                <div class="h-2 flex-1 rounded-full bg-teal-50">
                  <div
                    class="h-2 rounded-full transition-all"
                    :class="progressClass(item.status)"
                    :style="{ width: `${item.progress}%` }"
                  ></div>
                </div>
                <div class="text-xs" :class="statusTextClass(item.status)">
                  {{ statusLabel(item.status) }} {{ item.progress }}%
                </div>
              </div>
              <div v-if="item.error" class="mt-1 text-xs text-red-600">{{ item.error }}</div>
            </div>
          </div>
        </div>
        <button
          class="mt-4 w-full rounded-full bg-gradient-to-r from-teal-700 to-orange-400 px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
          type="button"
          :disabled="uploading"
          @click="upload"
        >
          {{ uploading ? 'Dang upload...' : 'Upload ngay' }}
        </button>
        <div class="mt-3 text-sm">
          <span v-if="error" class="font-semibold text-red-600">{{ error }}</span>
          <span v-else-if="success" class="font-semibold text-emerald-600">{{ success }}</span>
          <span v-else class="text-[#6f655b]">Dung luong toi da 250MB.</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>
