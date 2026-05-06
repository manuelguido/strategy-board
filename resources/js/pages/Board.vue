<script setup lang="ts">
/**
 * StrategyBoard editor page.
 *
 * Set as a full-bleed Inertia page (no app layout) — the editor owns the
 * entire viewport.
 */
import { Head } from '@inertiajs/vue3';
import Board from '@/components/board/Board.vue';
</script>

<template>
    <Head title="StrategyBoard">
        <link rel="preconnect" href="https://fonts.bunny.net" />
        <link
            rel="stylesheet"
            href="https://fonts.bunny.net/css?family=geist:400,500,600,700"
        />
    </Head>
    <Board />
</template>
