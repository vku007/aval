const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { runInNewContext } = require('node:vm');

function load() {
    const context = { console };
    const source = readFileSync(path.join(__dirname, 'authRole.js'), 'utf8');
    runInNewContext(source, context, { filename: 'authRole.js' });
    return context;
}

function token(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `aaa.${body}.sig`;
}

test('accountButtonLabel follows the token role', () => {
    const { accountButtonLabel } = load();
    assert.equal(accountButtonLabel('user'), 'LOG OUT');
    assert.equal(accountButtonLabel('admin'), 'LOG OUT');
    assert.equal(accountButtonLabel('guest'), 'SIGN IN');
    assert.equal(accountButtonLabel(null), 'SIGN IN');
    assert.equal(accountButtonLabel(''), 'SIGN IN');
    assert.equal(accountButtonLabel('Guest User'), 'SIGN IN');
});

test('tokenRole reads guest, user, and admin', () => {
    const { tokenRole, accountButtonLabel } = load();
    assert.equal(tokenRole(token({ role: 'user' })), 'user');
    assert.equal(tokenRole(token({ role: 'admin', name: 'Guest User' })), 'admin');
    assert.equal(tokenRole(token({ role: 'guest' })), 'guest');
    assert.equal(tokenRole(token({ name: 'Guest User' })), null);
    assert.equal(tokenRole(token({ role: 'owner' })), null);
    assert.equal(tokenRole('not-a-jwt'), null);
    assert.equal(tokenRole(null), null);
    assert.equal(tokenRole('aaa.!!!.sig'), null);
    assert.equal(tokenRole(token({ 'cognito:groups': ['guest'] })), 'guest');
    assert.equal(tokenRole(token({ 'cognito:groups': ['user'] })), 'user');
    assert.equal(tokenRole(token({ 'cognito:groups': ['admin', 'user'] })), 'admin');
    assert.equal(tokenRole(token({ 'custom:role': 'user' })), 'user');
    assert.equal(tokenRole(token({ role: 'guest', 'cognito:groups': ['admin'] })), 'guest');
    assert.equal(accountButtonLabel(tokenRole(token({ 'cognito:groups': ['guest'] }))), 'SIGN IN');
    assert.equal(accountButtonLabel(tokenRole(token({ 'cognito:groups': ['user'] }))), 'LOG OUT');
});
