/**
 * Role for the menu account button.
 * A claim wins. Otherwise the Cognito groups, admin then user then guest.
 * The profile name is not a role.
 */

function accountButtonLabel(role) {
    return role === 'user' || role === 'admin' ? 'LOG OUT' : 'SIGN IN';
}

function tokenRole(idToken) {
    const payload = jwtPayload(idToken);
    if (!payload) return null;
    const claimed = knownRole(payload['custom:role']) || knownRole(payload.role);
    if (claimed) return claimed;
    const groups = payload['cognito:groups'];
    if (!Array.isArray(groups)) return null;
    if (groups.indexOf('admin') >= 0) return 'admin';
    if (groups.indexOf('user') >= 0) return 'user';
    if (groups.indexOf('guest') >= 0) return 'guest';
    return null;
}

function knownRole(value) {
    if (value === 'guest' || value === 'user' || value === 'admin') return value;
    return null;
}

function jwtPayload(idToken) {
    if (typeof idToken !== 'string') return null;
    const parts = idToken.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const json = decodeBase64Url(parts[1]);
    if (!json) return null;
    try {
        const payload = JSON.parse(json);
        if (!payload || typeof payload !== 'object') return null;
        return payload;
    } catch (e) {
        return null;
    }
}

function decodeBase64Url(segment) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let input = String(segment).replace(/-/g, '+').replace(/_/g, '/');
    const mod = input.length % 4;
    if (mod === 1) return null;
    if (mod) input += '='.repeat(4 - mod);
    const bytes = [];
    for (let i = 0; i < input.length; i += 4) {
        const c0 = input.charAt(i);
        const c1 = input.charAt(i + 1);
        const c2 = input.charAt(i + 2);
        const c3 = input.charAt(i + 3);
        const v0 = alphabet.indexOf(c0);
        const v1 = alphabet.indexOf(c1);
        if (v0 < 0 || v1 < 0) return null;
        bytes.push((v0 << 2) | (v1 >> 4));
        if (c2 !== '=') {
            const v2 = alphabet.indexOf(c2);
            if (v2 < 0) return null;
            bytes.push(((v1 & 15) << 4) | (v2 >> 2));
            if (c3 !== '=') {
                const v3 = alphabet.indexOf(c3);
                if (v3 < 0) return null;
                bytes.push(((v2 & 3) << 6) | v3);
            }
        }
    }
    return utf8FromBytes(bytes);
}

function utf8FromBytes(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        if (b < 0x80) {
            out += String.fromCharCode(b);
        } else if ((b & 0xe0) === 0xc0 && i + 1 < bytes.length) {
            out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[++i] & 0x3f));
        } else if ((b & 0xf0) === 0xe0 && i + 2 < bytes.length) {
            out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f));
        } else if ((b & 0xf8) === 0xf0 && i + 3 < bytes.length) {
            const cp = ((b & 0x07) << 18) | ((bytes[++i] & 0x3f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f);
            if (typeof String.fromCodePoint === 'function') {
                out += String.fromCodePoint(cp);
            } else {
                return null;
            }
        } else {
            return null;
        }
    }
    return out;
}
