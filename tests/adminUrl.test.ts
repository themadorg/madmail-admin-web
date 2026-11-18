import assert from "node:assert/strict";
import { test } from "node:test";
import { applySettingsToAdminBaseUrl } from "../src/lib/adminUrl.ts";
import type { AllSettings, SettingValue } from "../src/lib/api.ts";

function setting(value: string, isSet = true): SettingValue {
    return { key: "k", value, is_set: isSet };
}

function settings(partial: {
    smtp_hostname?: SettingValue;
    https_port?: SettingValue;
    http_port?: SettingValue;
    admin_path?: SettingValue;
}): AllSettings {
    const unset = setting("", false);
    return {
        smtp_hostname: unset,
        https_port: unset,
        http_port: unset,
        admin_path: unset,
        ...partial,
    } as AllSettings;
}

const proxySettings = settings({
    smtp_hostname: setting("203.0.113.5"),
    https_port: setting("444"),
    http_port: setting("81"),
    admin_path: setting("/api/admin"),
});

test("a proxied https origin keeps its host and port", () => {
    const current = "https://mail.example/api/admin";
    assert.equal(applySettingsToAdminBaseUrl(current, proxySettings), current);
});

test("a proxied origin still follows admin_path", () => {
    const next = applySettingsToAdminBaseUrl(
        "https://mail.example/api/admin",
        settings({
            smtp_hostname: setting("203.0.113.5"),
            https_port: setting("444"),
            admin_path: setting("private-api"),
        }),
    );
    assert.equal(next, "https://mail.example/private-api");
});

test("an http proxy origin does not pick up the listen port", () => {
    const current = "http://mail.example/api/admin";
    assert.equal(
        applySettingsToAdminBaseUrl(
            current,
            settings({
                http_port: setting("81"),
                https_port: setting("444"),
                admin_path: setting("/api/admin"),
            }),
        ),
        current,
    );
});

test("followListener rebuilds the direct admin-token URL", () => {
    const next = applySettingsToAdminBaseUrl(
        "https://mail.example/api/admin",
        proxySettings,
        { followListener: true },
    );
    assert.equal(next, "https://203.0.113.5:444/api/admin");
});

test("followListener moves a direct connection onto a new https port", () => {
    const next = applySettingsToAdminBaseUrl(
        "https://mail.example:444/api/admin",
        settings({
            smtp_hostname: setting("mail.example"),
            https_port: setting("445"),
            admin_path: setting("/api/admin"),
        }),
        { followListener: true },
    );
    assert.equal(next, "https://mail.example:445/api/admin");
});

test("followListener clears the default https and http ports", () => {
    assert.equal(
        applySettingsToAdminBaseUrl(
            "https://mail.example:444/api/admin",
            settings({ https_port: setting("443"), admin_path: setting("/api/admin") }),
            { followListener: true },
        ),
        "https://mail.example/api/admin",
    );
    assert.equal(
        applySettingsToAdminBaseUrl(
            "http://mail.example:81/api/admin",
            settings({ http_port: setting("80"), admin_path: setting("/api/admin") }),
            { followListener: true },
        ),
        "http://mail.example/api/admin",
    );
});

test("an unset listen port or hostname is left alone", () => {
    const current = "https://mail.example:444/secret";
    assert.equal(
        applySettingsToAdminBaseUrl(
            current,
            settings({ admin_path: setting("/secret") }),
            { followListener: true },
        ),
        current,
    );
});

test("an invalid URL is returned unchanged", () => {
    assert.equal(applySettingsToAdminBaseUrl("not a url", proxySettings), "not a url");
});
