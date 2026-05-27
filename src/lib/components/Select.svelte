<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    value?: string | number;
    disabled?: boolean;
    id?: string;
    class?: string;
    onchange?: (e: Event) => void;
    children?: Snippet;
  }

  let {
    value = $bindable(),
    disabled = false,
    id,
    class: className = "",
    onchange,
    children,
  }: Props = $props();
</script>

<select
  {id}
  {disabled}
  bind:value
  {onchange}
  class="ui-select {className}"
>
  {@render children?.()}
</select>

<style>
  .ui-select {
    min-width: 0;
    /* @tailwindcss/forms draws the chevron; hide the native one. */
    appearance: none;
    -webkit-appearance: none;
    padding-block: 0.5rem;
    font-size: 0.75rem;
    line-height: 1.25rem;
    color: var(--th-text);
    background-color: var(--th-surface);
    border: 1px solid var(--th-border);
    border-radius: 0.5rem;
    outline: none;
    cursor: pointer;
  }

  .ui-select:focus {
    border-color: var(--th-accent);
  }

  .ui-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /*
   * Forms plugin chevron stays on the physical right. In RTL, keep text off it
   * without re-enabling the native arrow (use physical padding, not logical).
   */
  :global([dir="rtl"]) .ui-select {
    padding-right: 2.5rem;
    padding-left: 0.5rem;
    background-position: right 0.5rem center;
  }
</style>
