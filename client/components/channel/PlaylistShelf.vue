<script setup lang="ts">
import VideoEntry from '@/components/list/VideoEntry.vue';
import type { ApiDto } from '@viewtube/shared';

type ShelfType = {
  shelfName: string;
  shelfUrl: string;
  type: string;
  items: ApiDto<'VTVideoDto'>[];
};

defineProps<{
  shelf: ShelfType;
}>();
</script>

<template>
  <div class="channel-shelf" @touchstart.stop>
    <div v-for="(item, index) in shelf.items" :key="index" class="channel-shelf-item">
      <!-- prettier-ignore -->
      <VideoEntry v-if="(item as any).type === 'video'" :video="(item as any)" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.channel-shelf {
  overflow: auto hidden;
  display: flex;
  gap: 20px;

  .channel-shelf-item {
    min-width: 300px;
  }
}
</style>
