/**
 * AccountModalScene
 * One card for sign-in (choice, log in, create account) and for log-out.
 * Email, password, and display name are HTML inputs over the card.
 */
class AccountModalScene extends Phaser.Scene {
    constructor() {
        super({ key: 'AccountModalScene' });
    }

    init(data) {
        this.mode = data && data.mode === 'logout' ? 'logout' : 'sign-in';
        this.step = this.mode === 'logout' ? 'logout' : 'choice';
        this.onSuccess = data && data.onSuccess;
        this.isSubmitting = false;
        this._fxClosing = false;
        this._loggingOut = false;
        this._opened = false;
        this.authFields = null;
        this.keptEmail = '';
    }

    create(data) {
        if (data && data.mode) {
            this.mode = data.mode === 'logout' ? 'logout' : 'sign-in';
        }
        this.onSuccess = (data && data.onSuccess) || this.onSuccess;
        this.step = this.mode === 'logout' ? 'logout' : 'choice';

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        this.viewW = width;
        this.viewH = height;

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 1);
        overlay.setOrigin(0, 0);
        overlay.setInteractive();
        overlay._fxTargetAlpha = 0.5;

        this.card = this.add.container(width / 2, height / 2);
        this.drawStep(this.step);

        fxOpenModal(this, overlay, this.card, () => {
            this._opened = true;
            if (this.authFields) this.authFields.show();
        });

        if (this.input.keyboard) {
            this.input.keyboard.on('keydown-ESC', this.onEscape, this);
        }
    }

    onEscape() {
        if (this.isSubmitting || this._fxClosing || this._loggingOut) return;
        if (this.step === 'login' || this.step === 'create') {
            this.drawStep('choice');
            return;
        }
        this.close();
    }

    drawStep(step, options) {
        const opts = options || {};
        if (this.authFields) {
            this.authFields.destroy();
            this.authFields = null;
        }
        this.step = step;
        this.errorText = null;
        this.errorLink = null;
        if (this.card) {
            const kids = this.card.list ? this.card.list.slice() : [];
            kids.forEach((child) => this.tweens.killTweensOf(child));
            this.card.removeAll(true);
        }

        if (step === 'logout') this.drawLogout();
        else if (step === 'login') this.drawLogin(opts.email || '');
        else if (step === 'create') this.drawCreate();
        else this.drawChoice();

        if (this._opened && this.authFields) this.authFields.show();
    }

    cardMetrics() {
        const modalWidth = Math.min(350, this.viewW - 24);
        return {
            modalWidth: modalWidth,
            fieldW: modalWidth - 40,
            fieldH: Math.max(UI.fieldH, 54),
            btnH: UI.touchMin
        };
    }

    addTitle(top, text) {
        this.card.add(this.add.text(0, top + 32, text, {
            font: `${UI.heading}px monospace`,
            fill: '#111111'
        }).setOrigin(0.5));
    }

    addSubtitle(top, text, fieldW) {
        this.card.add(this.add.text(0, top + 56, text, {
            font: `${UI.small}px monospace`,
            fill: '#666666',
            wordWrap: { width: fieldW },
            align: 'center'
        }).setOrigin(0.5));
    }

    drawChoice() {
        const m = this.cardMetrics();
        const hasToken = typeof gameAPI !== 'undefined' && !!gameAPI.token;
        const labels = ['LOG IN'];
        if (hasToken) labels.push('CREATE ACCOUNT');
        labels.push('CANCEL');
        const gap = 12;
        const stackH = labels.length * m.btnH + (labels.length - 1) * gap;
        const modalHeight = 96 + stackH + 24;
        const top = -modalHeight / 2;

        this.card.add(drawRoundedCard(this, 0, 0, m.modalWidth, modalHeight, 18));
        this.addTitle(top, 'Sign in');
        this.addSubtitle(
            top,
            hasToken
                ? 'Open an account you already have, or save this guest.'
                : 'Open an account you already have.',
            m.fieldW
        );

        let y = top + 96 + m.btnH / 2;
        labels.forEach((label) => {
            const button = this.createButton(0, y, m.fieldW, m.btnH, label, () => {
                if (label === 'LOG IN') this.drawStep('login');
                else if (label === 'CREATE ACCOUNT') this.drawStep('create');
                else this.close();
            });
            this.card.add(button);
            y += m.btnH + gap;
        });
    }

    drawLogin(email) {
        const m = this.cardMetrics();
        const modalHeight = 400;
        const top = -modalHeight / 2;
        const btnW = Math.floor((m.fieldW - 12) / 2);

        this.card.add(drawRoundedCard(this, 0, 0, m.modalWidth, modalHeight, 18));
        this.addTitle(top, 'Log in');
        this.addSubtitle(top, 'Open an account you already have.', m.fieldW);
        this.addErrorText(top + 96 + m.fieldH * 2 + 36, m.fieldW);

        const btnY = top + modalHeight - 28 - m.btnH / 2;
        this.card.add(this.createButton(-btnW / 2 - 6, btnY, btnW, m.btnH, 'BACK', () => this.drawStep('choice')));
        this.card.add(this.createButton(btnW / 2 + 6, btnY, btnW, m.btnH, 'LOG IN', () => this.submitLogin(), true));

        this.authFields = mountAuthFields(this, {
            cardX: this.viewW / 2,
            cardY: this.viewH / 2,
            fields: [
                {
                    name: 'email',
                    localY: top + 96,
                    width: m.fieldW,
                    height: m.fieldH,
                    type: 'email',
                    autocomplete: 'username',
                    placeholder: 'Email',
                    value: email || ''
                },
                {
                    name: 'password',
                    localY: top + 96 + m.fieldH + 14,
                    width: m.fieldW,
                    height: m.fieldH,
                    type: 'password',
                    autocomplete: 'current-password',
                    placeholder: 'Password'
                }
            ],
            onSubmit: () => this.submitLogin(),
            onEscape: () => this.onEscape()
        });
    }

    drawCreate() {
        const m = this.cardMetrics();
        const modalHeight = 520;
        const top = -modalHeight / 2;
        const fieldStart = top + 112;
        const fieldGap = 14;
        const btnW = Math.floor((m.fieldW - 12) / 2);

        this.card.add(drawRoundedCard(this, 0, 0, m.modalWidth, modalHeight, 18));
        this.addTitle(top, 'Create account');
        this.addSubtitle(top, 'Save this guest as a real player.', m.fieldW);
        this.addErrorText(fieldStart + (m.fieldH + fieldGap) * 3 + 8, m.fieldW);
        this.errorLink = this.makeLoginLink();
        this.card.add(this.errorLink);

        const btnY = top + modalHeight - 28 - m.btnH / 2;
        this.card.add(this.createButton(-btnW / 2 - 6, btnY, btnW, m.btnH, 'BACK', () => this.drawStep('choice')));
        this.card.add(this.createButton(btnW / 2 + 6, btnY, btnW, m.btnH, 'CREATE ACCOUNT', () => this.submitCreate(), true));

        this.authFields = mountAuthFields(this, {
            cardX: this.viewW / 2,
            cardY: this.viewH / 2,
            fields: [
                {
                    name: 'email',
                    localY: fieldStart,
                    width: m.fieldW,
                    height: m.fieldH,
                    type: 'email',
                    autocomplete: 'email',
                    placeholder: 'Email'
                },
                {
                    name: 'password',
                    localY: fieldStart + m.fieldH + fieldGap,
                    width: m.fieldW,
                    height: m.fieldH,
                    type: 'password',
                    autocomplete: 'new-password',
                    placeholder: 'Password'
                },
                {
                    name: 'displayName',
                    localY: fieldStart + (m.fieldH + fieldGap) * 2,
                    width: m.fieldW,
                    height: m.fieldH,
                    type: 'text',
                    autocomplete: 'nickname',
                    placeholder: 'Display name'
                }
            ],
            onSubmit: () => this.submitCreate(),
            onEscape: () => this.onEscape()
        });
    }

    drawLogout() {
        const m = this.cardMetrics();
        const body = 'Leave this account? The game starts again as a new guest. Games on this account stay on this account.';
        const measure = this.add.text(0, 0, body, {
            font: `${UI.body}px monospace`,
            wordWrap: { width: m.fieldW },
            align: 'center'
        });
        const bodyH = measure.height;
        measure.destroy();

        const modalHeight = 36 + 16 + bodyH + 20 + m.btnH + 28;
        const top = -modalHeight / 2;
        const btnW = Math.floor((m.fieldW - 12) / 2);

        this.card.add(drawRoundedCard(this, 0, 0, m.modalWidth, modalHeight, 18));
        this.addTitle(top, 'Log out');
        this.card.add(this.add.text(0, top + 56, body, {
            font: `${UI.body}px monospace`,
            fill: '#111111',
            wordWrap: { width: m.fieldW },
            align: 'center'
        }).setOrigin(0.5, 0));

        const btnY = top + modalHeight - 28 - m.btnH / 2;
        this.card.add(this.createButton(-btnW / 2 - 6, btnY, btnW, m.btnH, 'STAY', () => this.close()));
        this.card.add(this.createButton(btnW / 2 + 6, btnY, btnW, m.btnH, 'LOG OUT', () => this.confirmLogout(), true));
    }

    addErrorText(y, fieldW) {
        this.errorText = this.add.text(0, y, '', {
            font: `${UI.small}px monospace`,
            fill: '#cc0000',
            wordWrap: { width: fieldW }
        }).setOrigin(0.5, 0);
        this.card.add(this.errorText);
    }

    makeLoginLink() {
        const link = this.add.text(0, 0, 'LOG IN', {
            font: `${UI.small}px monospace`,
            fill: '#cc0000'
        }).setOrigin(0, 0);
        link.setVisible(false);
        link.on('pointerup', () => {
            if (this.isSubmitting || this._fxClosing) return;
            this.drawStep('login', { email: this.keptEmail });
        });
        return link;
    }

    showError(message) {
        if (!this.errorText) return;
        this.errorText.setOrigin(0.5, 0);
        this.errorText.setX(0);
        this.errorText.setText(message);
        if (this.errorLink) {
            this.errorLink.setVisible(false);
            if (this.errorLink.input) this.errorLink.disableInteractive();
        }
    }

    showEmailExists(email) {
        this.keptEmail = email || '';
        if (!this.errorText || !this.errorLink) {
            this.showError('This email already has an account.');
            return;
        }
        this.errorText.setText('This email already has an account.');
        this.errorText.setOrigin(0, 0);
        const link = this.errorLink;
        link.setVisible(true);
        const gap = 8;
        const total = this.errorText.width + gap + link.width;
        const left = -Math.min(total, this.cardMetrics().fieldW) / 2;
        const sameLine = total <= this.cardMetrics().fieldW;
        this.errorText.setX(sameLine ? left : -this.errorText.width / 2);
        link.setPosition(
            sameLine ? left + this.errorText.width + gap : -link.width / 2,
            sameLine ? this.errorText.y : this.errorText.y + this.errorText.height + 4
        );
        link.setInteractive({ useHandCursor: true });
    }

    clearError() {
        this.showError('');
    }

    finishSignIn(user) {
        const role = typeof tokenRole === 'function' ? tokenRole(gameAPI.token) : null;
        if (this.onSuccess) this.onSuccess(user, role);
        this.close();
    }

    async submitLogin() {
        if (this.isSubmitting || this._fxClosing || !this.authFields) return;
        this.clearError();

        const emailValue = this.authFields.value('email');
        const passwordValue = this.authFields.value('password');

        if (!emailValue.trim()) {
            this.showError('Email is required');
            this.authFields.focus('email');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
            this.showError('Invalid email format');
            this.authFields.focus('email');
            return;
        }
        if (!passwordValue) {
            this.showError('Password is required');
            this.authFields.focus('password');
            return;
        }
        if (passwordValue.length < 8) {
            this.showError('Password must be at least 8 characters');
            this.authFields.focus('password');
            return;
        }

        this.isSubmitting = true;
        this.authFields.setBusy(true);
        this.showError('Logging in...');

        try {
            const user = await gameAPI.login(emailValue, passwordValue);
            this.finishSignIn(user);
        } catch (error) {
            this.isSubmitting = false;
            if (this.authFields) this.authFields.setBusy(false);
            if (error.statusCode === 401) this.showError('Invalid email or password.');
            else if (error.statusCode === 429) this.showError('Too many attempts. Try again later.');
            else this.showError('Login failed. Please try again.');
        }
    }

    async submitCreate() {
        if (this.isSubmitting || this._fxClosing || !this.authFields) return;
        this.clearError();

        const emailValue = this.authFields.value('email');
        const passwordValue = this.authFields.value('password');
        const displayNameValue = this.authFields.value('displayName');

        if (!emailValue.trim()) {
            this.showError('Email is required');
            this.authFields.focus('email');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
            this.showError('Invalid email format');
            this.authFields.focus('email');
            return;
        }
        if (!passwordValue) {
            this.showError('Password is required');
            this.authFields.focus('password');
            return;
        }
        if (passwordValue.length < 12) {
            this.showError('Password must be at least 12 characters');
            this.authFields.focus('password');
            return;
        }
        if (!/[a-zA-Z]/.test(passwordValue) || !/[0-9]/.test(passwordValue)) {
            this.showError('Password must contain letters and numbers');
            this.authFields.focus('password');
            return;
        }

        this.isSubmitting = true;
        this.authFields.setBusy(true);
        this.showError('Creating account...');

        try {
            const user = await gameAPI.promoteToRegular(
                emailValue,
                passwordValue,
                displayNameValue || emailValue.split('@')[0]
            );
            this.finishSignIn(user);
        } catch (error) {
            this.isSubmitting = false;
            if (this.authFields) this.authFields.setBusy(false);
            const code = error.data && (error.data.code || error.data.errorCode);
            if (error.statusCode === 409 || code === 'EMAIL_EXISTS') {
                this.showEmailExists(emailValue);
            } else if (error.statusCode === 400 && code === 'ALREADY_REGULAR') {
                this.showError('You are already a registered user.');
                const role = typeof tokenRole === 'function' ? tokenRole(gameAPI.token) : null;
                if (role === 'user' || role === 'admin') {
                    const user = this.registry.get('currentUser') || gameAPI.user;
                    if (this.onSuccess) this.onSuccess(user, role);
                    this.close();
                }
            } else if (error.statusCode === 429) {
                this.showError('Too many attempts. Try again later.');
            } else {
                this.showError('Could not create the account. Please try again.');
            }
        }
    }

    confirmLogout() {
        if (this._fxClosing || this._loggingOut) return;
        this._loggingOut = true;
        if (typeof gameAPI !== 'undefined' && typeof gameAPI.clearAuth === 'function') {
            gameAPI.clearAuth();
        } else {
            localStorage.removeItem('aval_auth_token');
            localStorage.removeItem('idToken');
        }
        this.registry.set('currentUser', null);
        this.registry.set('role', null);
        window.location.reload();
    }

    createButton(x, y, width, height, label, callback, isPrimary) {
        const button = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, width, height, isPrimary ? 0x000000 : 0xffffff);
        bg.setStrokeStyle(2, 0x000000);
        const text = this.add.text(0, 0, label, {
            font: `${UI.body}px monospace`,
            fill: isPrimary ? '#ffffff' : '#000000'
        }).setOrigin(0.5);
        button.add([bg, text]);
        const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
        button.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        bindPress(this, button, {
            onClick: callback,
            isEnabled: () => !this.isSubmitting && !this._fxClosing && !this._loggingOut
        });
        button.bg = bg;
        button.text = text;
        return button;
    }

    close() {
        if (this._fxClosing) return;
        fxCloseModal(this);
    }

    shutdown() {
        if (this.input && this.input.keyboard) {
            this.input.keyboard.off('keydown-ESC', this.onEscape, this);
        }
        if (this.authFields) {
            this.authFields.destroy();
            this.authFields = null;
        }
        fxResumeOtherScenes(this);
    }
}
