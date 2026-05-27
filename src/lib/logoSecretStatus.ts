import { api, type ApiConfig } from '$lib/api';

const POLL_MS = 10_000;

export function createLogoSecretStatusPoller(
	cfg: () => ApiConfig,
	handlers: {
		onStatusAvailable: () => void;
		onStatusUnavailable: () => void;
		onNewSentMessages: (count: number) => void;
	},
): () => void {
	let lastSent: number | null = null;
	let pollId: ReturnType<typeof setInterval> | null = null;
	let stopped = false;

	function stopPolling() {
		if (pollId !== null) {
			clearInterval(pollId);
			pollId = null;
		}
	}

	async function probe(isInitial: boolean): Promise<boolean> {
		const res = await api.status(cfg());
		if (stopped) return false;

		if (res.error || res.status === 404 || !res.data) {
			if (isInitial) handlers.onStatusUnavailable();
			stopPolling();
			return false;
		}

		const sent = res.data.sent_messages;
		if (typeof sent !== 'number' || Number.isNaN(sent)) {
			if (isInitial) handlers.onStatusUnavailable();
			stopPolling();
			return false;
		}

		if (isInitial) {
			lastSent = sent;
			handlers.onStatusAvailable();
			return true;
		}

		if (lastSent !== null && sent > lastSent) {
			handlers.onNewSentMessages(sent - lastSent);
		}
		lastSent = sent;
		return true;
	}

	void probe(true).then((ok) => {
		if (!ok || stopped) return;
		pollId = setInterval(() => {
			void probe(false);
		}, POLL_MS);
	});

	return () => {
		stopped = true;
		stopPolling();
		lastSent = null;
	};
}
