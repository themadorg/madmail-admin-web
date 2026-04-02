<script lang="ts">
  import { store } from "$lib/state.svelte";
  import { ArrowDownToLine, Trash2, Plus, ToggleLeft, ToggleRight, Clock, Zap } from "lucide-svelte";

  let showAdd = $state(false);
  let newName = $state("");
  let newUrl = $state("");
  let newInterval = $state("1");
  let confirmingDelete = $state("");
  let editingInterval = $state<{ name: string; value: string } | null>(null);

  async function handleAdd() {
    if (!newName.trim() || !newUrl.trim()) return;
    await store.addExchanger(
      newName.trim(),
      newUrl.trim(),
      parseInt(newInterval) || 60,
    );
    newName = "";
    newUrl = "";
    newInterval = "1";
    showAdd = false;
  }

  function requestDelete(name: string) {
    confirmingDelete = confirmingDelete === name ? "" : name;
  }

  async function handleConfirmDelete() {
    const name = confirmingDelete;
    confirmingDelete = "";
    await store.deleteExchanger(name);
  }

  async function handleUpdateInterval(name: string) {
    if (!editingInterval) return;
    const val = parseInt(editingInterval.value);
    if (isNaN(val) || val <= 0) {
      editingInterval = null;
      return;
    }
    await store.updateExchanger(name, { poll_interval: val });
    editingInterval = null;
  }

  function fmtPollTime(iso?: string): string {
    if (!iso) return "Never";
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 5) return "Just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return d.toLocaleTimeString();
  }

  function focusOnMount(el: HTMLInputElement) {
    el.focus();
    el.select();
  }
</script>

{#if store.exchangers}
  <div class="exc-header">
    <span class="exc-count">
      <ArrowDownToLine size={14} />
      {store.exchangers.total} exchanger{store.exchangers.total !== 1 ? 's' : ''}
    </span>
    <button class="btn-add" onclick={() => (showAdd = !showAdd)}>
      <Plus size={12} />
      Add Exchanger
    </button>
  </div>

  <!-- Add form -->
  {#if showAdd}
    <div class="add-form">
      <div class="form-grid">
        <div class="field">
          <label for="exc-name">Name</label>
          <input
            id="exc-name"
            type="text"
            bind:value={newName}
            placeholder="onjast"
          />
        </div>
        <div class="field">
          <label for="exc-url">Endpoint URL</label>
          <input
            id="exc-url"
            type="text"
            bind:value={newUrl}
            placeholder="https://onjast.com/mxdeliv"
          />
        </div>
      </div>
      <div class="field">
        <label for="exc-interval">Poll Interval (seconds)</label>
        <input
          id="exc-interval"
          type="number"
          min="1"
          bind:value={newInterval}
          placeholder="1"
        />
      </div>
      <div class="form-actions">
        <button class="btn-cancel" onclick={() => (showAdd = false)}>
          Cancel
        </button>
        <button
          class="btn-submit"
          onclick={handleAdd}
          disabled={!newName.trim() || !newUrl.trim()}
        >
          Add Exchanger
        </button>
      </div>
    </div>
  {/if}

  {#if store.exchangers.total === 0 && !showAdd}
    <div class="empty-state">
      <ArrowDownToLine size={32} />
      <p>No exchangers configured</p>
      <p class="empty-hint">Exchangers let this server pull messages from remote relays.</p>
      <button class="btn-add" onclick={() => (showAdd = true)}>
        <Plus size={12} />
        Add Exchanger
      </button>
    </div>
  {:else}
    <div class="entry-list">
      {#each store.exchangers.exchangers as ex (ex.name)}
        <div class="entry" class:entry-disabled={!ex.enabled}>
          <div class="entry-info">
            <div class="entry-header">
              <span class="entry-name">{ex.name}</span>
              <span class="entry-status" class:status-on={ex.enabled} class:status-off={!ex.enabled}>
                {ex.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>
            <span class="entry-url">{ex.url}</span>
            <div class="entry-meta">
              {#if editingInterval?.name === ex.name}
                <div class="inline-edit">
                  <Clock size={10} />
                  <input
                    type="number"
                    min="1"
                    bind:value={editingInterval.value}
                    onblur={() => handleUpdateInterval(ex.name)}
                    onkeydown={(e) => e.key === "Enter" && handleUpdateInterval(ex.name)}
                    use:focusOnMount
                    class="interval-input"
                  />
                  <span class="unit">s</span>
                </div>
              {:else}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span 
                  class="meta-item clickable-meta" 
                  onclick={() => (editingInterval = { name: ex.name, value: String(ex.poll_interval) })}
                  title="Click to edit interval"
                >
                  <Clock size={10} />
                  {ex.poll_interval}s interval
                </span>
              {/if}
              <span class="meta-item">
                <Zap size={10} />
                {fmtPollTime(ex.last_poll_at)}
              </span>
            </div>
          </div>
          <div class="entry-actions">
            <button
              class="btn-toggle"
              onclick={() => store.updateExchanger(ex.name, { enabled: !ex.enabled })}
              title={ex.enabled ? 'Disable' : 'Enable'}
            >
              {#if ex.enabled}
                <ToggleRight size={18} />
              {:else}
                <ToggleLeft size={18} />
              {/if}
            </button>
            <button
              class="btn-delete"
              onclick={() => requestDelete(ex.name)}
              aria-label="Delete {ex.name}"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
{:else}
  <p class="loading">Loading exchangers…</p>
{/if}

<!-- Delete confirmation modal -->
{#if confirmingDelete}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={() => (confirmingDelete = "")}>
    <div class="modal-backdrop"></div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-box" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-icon">
          <Trash2 size={18} />
        </div>
        <div class="modal-title">
          <h3>Delete exchanger?</h3>
          <p class="modal-detail">{confirmingDelete}</p>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-cancel" onclick={() => (confirmingDelete = "")}>
          Cancel
        </button>
        <button class="btn-danger" onclick={handleConfirmDelete}>
          Delete
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Header bar ── */
  .exc-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    margin-bottom: 1rem;
    background: var(--th-surface-2);
    border: 1px solid var(--th-border);
    border-radius: 0.5rem;
  }

  .exc-count {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    color: var(--th-text);
  }
  .exc-count :global(svg) {
    color: var(--th-accent);
    opacity: 0.7;
  }

  /* ── Buttons ── */
  .btn-add {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    border: 1px solid color-mix(in srgb, var(--th-accent) 30%, transparent);
    border-radius: 0.5rem;
    color: var(--th-accent);
    background: transparent;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .btn-add:hover { background: color-mix(in srgb, var(--th-accent) 10%, transparent); }

  .btn-cancel {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    border: 1px solid var(--th-border);
    border-radius: 0.5rem;
    color: var(--th-text-2);
    background: transparent;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-cancel:hover { background: var(--th-surface-2); }

  .btn-submit {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: none;
    border-radius: 0.5rem;
    color: #fff;
    background: var(--th-accent);
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-submit:hover { background: var(--th-accent-dim); }
  .btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-toggle {
    padding: 0.375rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--th-accent);
    opacity: 0.5;
    cursor: pointer;
    transition: opacity 0.15s, background 0.15s;
  }
  .btn-toggle:hover { opacity: 1; background: color-mix(in srgb, var(--th-accent) 10%, transparent); }

  .btn-delete {
    padding: 0.375rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--th-danger);
    opacity: 0.35;
    cursor: pointer;
    transition: opacity 0.15s, background 0.15s;
  }
  .btn-delete:hover { opacity: 1; background: color-mix(in srgb, var(--th-danger) 10%, transparent); }

  .btn-danger {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: none;
    border-radius: 0.5rem;
    color: #fff;
    background: var(--th-danger);
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-danger:hover { opacity: 0.85; }

  /* ── Add form ── */
  .add-form {
    padding: 1rem;
    margin-bottom: 1rem;
    background: var(--th-surface-2);
    border: 1px solid color-mix(in srgb, var(--th-accent) 20%, transparent);
    border-radius: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    animation: slide-in 0.15s ease-out;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  @media (max-width: 480px) { .form-grid { grid-template-columns: 1fr; } }

  .field label {
    display: block;
    font-size: 0.6875rem;
    color: var(--th-text-2);
    opacity: 0.7;
    margin-bottom: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .field input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: var(--th-surface-1);
    border: 1px solid var(--th-border);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: var(--th-text);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    box-sizing: border-box;
  }
  .field input::placeholder { color: var(--th-text-2); opacity: 0.35; }
  .field input:focus {
    border-color: var(--th-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--th-accent) 20%, transparent);
  }

  .form-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  /* ── Empty state ── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 0;
    color: var(--th-text-2);
    opacity: 0.5;
  }
  .empty-state :global(svg) { margin-bottom: 0.5rem; opacity: 0.4; }
  .empty-state p { font-size: 0.875rem; margin: 0 0 0.25rem; }
  .empty-hint { font-size: 0.75rem !important; margin-bottom: 0.75rem !important; }

  /* ── Entry list ── */
  .entry-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: var(--th-surface-2);
    border: 1px solid var(--th-border);
    border-radius: 0.5rem;
    transition: border-color 0.15s;
  }
  .entry:hover { border-color: color-mix(in srgb, var(--th-accent) 30%, var(--th-border)); }
  .entry:hover .btn-delete { opacity: 1; }
  .entry-disabled { opacity: 0.5; }

  .entry-info { min-width: 0; flex: 1; }

  .entry-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.125rem;
  }

  .entry-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--th-text);
  }

  .entry-status {
    font-size: 0.625rem;
    font-weight: 500;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .status-on {
    background: color-mix(in srgb, var(--th-success) 15%, transparent);
    color: var(--th-success);
  }
  .status-off {
    background: color-mix(in srgb, var(--th-danger) 15%, transparent);
    color: var(--th-danger);
  }

  .entry-url {
    display: block;
    font-size: 0.75rem;
    font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace;
    color: var(--th-accent);
    opacity: 0.85;
    word-break: break-all;
    margin-bottom: 0.25rem;
  }

  .entry-meta {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.125rem;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.625rem;
    color: var(--th-text-2);
    opacity: 0.6;
  }
  .meta-item :global(svg) { opacity: 0.5; }

  .clickable-meta {
    cursor: pointer;
    padding: 0.125rem 0.25rem;
    margin: -0.125rem -0.25rem;
    border-radius: 0.25rem;
    transition: background 0.15s, color 0.15s, opacity 0.15s;
  }
  .clickable-meta:hover {
    background: color-mix(in srgb, var(--th-accent) 15%, transparent);
    color: var(--th-accent);
    opacity: 1;
  }

  .inline-edit {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    font-size: 0.625rem;
    color: var(--th-accent);
  }

  .interval-input {
    width: 2.5rem;
    padding: 0 0.125rem;
    font-size: 0.625rem;
    font-family: inherit;
    border: 1px solid var(--th-accent);
    background: var(--th-surface-1);
    color: var(--th-accent);
    border-radius: 0.125rem;
    outline: none;
    text-align: center;
    appearance: textfield;
    -moz-appearance: textfield;
  }
  .interval-input::-webkit-outer-spin-button,
  .interval-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .unit {
    font-size: 0.625rem;
    opacity: 0.7;
  }

  .entry-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
    margin-inline-start: 0.5rem;
  }

  /* ── Modal ── */
  .modal-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 1rem; }
  .modal-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(4px); }
  .modal-box { position: relative; background: var(--th-surface-1); border: 1px solid var(--th-border); border-radius: 0.75rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); width: 100%; max-width: 24rem; padding: 1.25rem; animation: modal-in 0.15s ease-out; }
  .modal-header { display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 1rem; }
  .modal-icon { padding: 0.5rem; border-radius: 0.5rem; background: color-mix(in srgb, var(--th-danger) 10%, transparent); color: var(--th-danger); flex-shrink: 0; }
  .modal-title h3 { font-size: 0.875rem; font-weight: 600; color: var(--th-text); margin: 0 0 0.25rem; }
  .modal-detail { font-size: 0.75rem; font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace; color: var(--th-text-2); word-break: break-all; margin: 0; }
  .modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }

  /* ── Loading ── */
  .loading { font-size: 0.875rem; color: var(--th-text-2); }

  /* ── Animations ── */
  @keyframes slide-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes modal-in { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
</style>
