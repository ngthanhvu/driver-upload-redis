<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Upload } from 'lucide-vue-next'

const props = defineProps<{ apiBase: string }>()
const emit = defineEmits<{ (e: 'uploaded'): void }>()

const selectedFiles = ref<File[]>([])
const previewUrls = ref<string[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const error = ref('')
const success = ref('')
const isDragging = ref(false)
const dragCounter = ref(0)
const isDialogOpen = ref(false)

const joinUrl = (base: string, path: string) => base.replace(/\/$/, '') + path
const MAX_FILE_SIZE = 20 * 1024 * 1024

const fileLabel = computed(() => {
  if (selectedFiles.value.length === 0) return 'Chon file'
  if (selectedFiles.value.length === 1) {
    const firstFile = selectedFiles.value[0]
    return firstFile ? firstFile.name : 'Chon file'
  }
  return `Da chon ${selectedFiles.value.length} files`
})

const clearPreviews = () => {
  previewUrls.value.forEach((url) => {
    if (url) URL.revokeObjectURL(url)
  })
  previewUrls.value = []
}

const setFiles = (files: File[]) => {
  clearPreviews()
  selectedFiles.value = files
  previewUrls.value = files.map((file) =>
    file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
  )
  success.value = ''
  error.value = ''
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

const upload = async () => {
  if (selectedFiles.value.length === 0) {
    error.value = 'Vui long chon file'
    return
  }
  const oversizeFiles = selectedFiles.value.filter((file) => file.size > MAX_FILE_SIZE)
  if (oversizeFiles.length > 0) {
    error.value = 'File vuot qua 20MB, vui long chon file nho hon'
    return
  }
  uploading.value = true
  success.value = ''
  error.value = ''
  try {
    let successCount = 0
    for (const file of selectedFiles.value) {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(joinUrl(props.apiBase, '/api/documents'), {
        method: 'POST',
        body: formData
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Upload that bai')
      }
      successCount += 1
    }
    success.value =
      successCount === 1 ? 'Upload thanh cong' : `Upload thanh cong ${successCount} files`
    setFiles([])
    if (fileInput.value) {
      fileInput.value.value = ''
    }
    emit('uploaded')
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
        <div
          class="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed px-4 py-3"
          :class="isDragging ? 'border-teal-600 bg-teal-50' : 'border-teal-200 bg-white/80'"
          @dragenter="onDragEnter"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <label class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-teal-400 px-4 py-2 text-sm font-semibold text-teal-700">
            <input ref="fileInput" class="hidden" type="file" multiple @change="onFileChange" />
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
          <span v-else class="text-[#6f655b]">Dung luong toi da 20MB.</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>
