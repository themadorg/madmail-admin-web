<script lang="ts">
  interface Props {
    /** Whether the switch is on */
    checked?: boolean;
    disabled?: boolean;
    /** Accessible name (use when no visible label is wired with `for`) */
    label?: string;
    class?: string;
    onclick?: () => void;
  }

  let {
    checked = false,
    disabled = false,
    label,
    class: className = '',
    onclick,
  }: Props = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  {onclick}
  class="inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border px-0.5 transition-[background-color,border-color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45 {checked
    ? 'justify-end border-accent bg-accent'
    : 'justify-start border-border bg-surface-3'} {className}"
>
  <span
    aria-hidden="true"
    class="block size-[1.125rem] shrink-0 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
  ></span>
</button>
