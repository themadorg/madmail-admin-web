import { LOGO_SECRET_LABEL, LOGO_SECRET_TITLE } from '$lib/logoSecretGlitch';
import type { StatusResponse } from '$lib/api';

export type StatusProbeResult = {
	error?: string;
	status?: number;
	data?: StatusResponse | null;
};

/** Server feature detection (e.g. madmail v2 via `/admin/status`). */
class ServerCapabilitiesStore {
	/** `null` = not checked yet, `true` = v2 (`/admin/status`), `false` = legacy. */
	isMadmailV2 = $state<boolean | null>(null);

	setMadmailV2(value: boolean) {
		this.isMadmailV2 = value;
	}

	/** Update v2 flag from a `GET /admin/status` response. */
	applyStatusResult(res: StatusProbeResult) {
		if (res.error || res.status === 404 || !res.data) {
			this.isMadmailV2 = false;
			return;
		}
		const sent = res.data.sent_messages;
		if (typeof sent !== 'number' || Number.isNaN(sent)) {
			this.isMadmailV2 = false;
			return;
		}
		this.isMadmailV2 = true;
	}

	reset() {
		this.isMadmailV2 = null;
	}

	get logoSecretTitle(): string {
		return this.isMadmailV2 === false ? LOGO_SECRET_LABEL : LOGO_SECRET_TITLE;
	}

	get logoSecretRainWord(): string {
		return this.isMadmailV2 === false ? LOGO_SECRET_LABEL : `${LOGO_SECRET_LABEL}.`;
	}
}

export const serverCapabilities = new ServerCapabilitiesStore();
