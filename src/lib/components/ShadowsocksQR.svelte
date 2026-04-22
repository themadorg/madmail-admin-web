<script lang="ts">
  let { url }: { url: string } = $props();
  let canvas: HTMLCanvasElement | null = $state(null);

  $effect(() => {
    if (!canvas || !url) return;

    let cancelled = false;

    import("qrcode").then(({ toCanvas }) => {
      if (cancelled || !canvas) return;
      return toCanvas(canvas, url, {
        width: 200,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
    }).catch(console.error);

    return () => {
      cancelled = true;
    };
  });
</script>

<div
  class="flex flex-col items-center gap-3 p-4 bg-white rounded-xl shadow-lg border border-border"
>
  <canvas bind:this={canvas} class="max-w-full h-auto rounded-lg"></canvas>
</div>
