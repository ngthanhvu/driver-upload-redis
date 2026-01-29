<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

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

const joinUrl = (base: string, path: string) => base.replace(/\/$/, '') + path

const fileLabel = computed(() => {
  if (selectedFiles.value.length === 0) return 'Chon file hinh anh'
  if (selectedFiles.value.length === 1) return selectedFiles.value[0].name
  return `Da chon ${selectedFiles.value.length} files`
})

const clearPreviews = () => {
  previewUrls.value.forEach((url) => URL.revokeObjectURL(url))
  previewUrls.value = []
}

const setFiles = (files: File[]) => {
  clearPreviews()
  selectedFiles.value = files
  previewUrls.value = files.map((file) => URL.createObjectURL(file))
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
    error.value = 'Vui long chon file hinh anh'
    return
  }
  const invalidFiles = selectedFiles.value.filter((file) => !file.type.startsWith('image/'))
  if (invalidFiles.length > 0) {
    error.value = 'Chi chap nhan file hinh anh'
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
  <section class="card upload-card">
    <div class="card-title">
      <h2>Upload tai lieu</h2>
      <p>Chi chap nhan file hinh anh (jpg, png, webp...).</p>
    </div>
    <div
      class="uploader"
      :class="{ dragging: isDragging }"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <label class="file-input">
        <input ref="fileInput" type="file" accept="image/*" multiple @change="onFileChange" />
        <span>{{ fileLabel }}</span>
      </label>
      <span class="drop-hint">Keo tha file vao day hoac bam de chon.</span>
    </div>
    <div v-if="previewUrls.length > 0" class="preview-grid">
      <div v-for="(url, index) in previewUrls" :key="url" class="preview-card">
        <img :src="url" :alt="selectedFiles[index]?.name || 'preview'" />
        <div class="preview-name">{{ selectedFiles[index]?.name }}</div>
      </div>
    </div>
    <button class="button primary" type="button" :disabled="uploading" @click="upload">
      {{ uploading ? 'Dang upload...' : 'Upload ngay' }}
    </button>
    <div class="status">
      <span v-if="error" class="error">{{ error }}</span>
      <span v-else-if="success" class="success">{{ success }}</span>
      <span v-else class="muted">Dung luong toi da 10MB.</span>
    </div>
  </section>
</template>
