/**
 * LoginModalScene
 * In-canvas login modal using pure Phaser graphics
 */
class LoginModalScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LoginModalScene' });
    }

    init(data) {
        this.emailValue = '';
        this.passwordValue = '';
        this.activeField = 'email';
        this.errorMessage = '';
        this.isSubmitting = false;
        this.onLoginSuccess = data?.onLoginSuccess;
        this._fxClosing = false;
    }

    create(data) {
        console.log('[LoginModalScene] create() started');

        this.onLoginSuccess = data?.onLoginSuccess || this.onLoginSuccess;

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 1);
        overlay.setOrigin(0, 0);
        overlay.setInteractive();
        overlay._fxTargetAlpha = 0.5;

        const modalWidth = Math.min(350, width - 24);
        const fieldH = Math.max(UI.fieldH, 54);
        const btnH = UI.touchMin;
        const modalHeight = 400;
        const fieldW = modalWidth - 40;
        const btnW = Math.floor((fieldW - 12) / 2);
        const top = -modalHeight / 2;

        const card = this.add.container(width / 2, height / 2);
        card.add(drawRoundedCard(this, 0, 0, modalWidth, modalHeight, 18));

        card.add(this.add.text(0, top + 32, 'LOGIN', {
            font: `${UI.heading}px monospace`,
            fill: '#111111'
        }).setOrigin(0.5));

        card.add(this.add.text(0, top + 56, 'Sign in to keep your games', {
            font: `${UI.small}px monospace`,
            fill: '#666666',
            wordWrap: { width: fieldW },
            align: 'center'
        }).setOrigin(0.5));

        this.emailField = createStyledInput(this, 0, top + 96, fieldW, fieldH, {
            name: 'email',
            label: 'Email',
            placeholder: 'you@email.com',
            onFocus: (name) => this.setActiveField(name)
        });
        card.add(this.emailField);

        this.passwordField = createStyledInput(this, 0, top + 96 + fieldH + 14, fieldW, fieldH, {
            name: 'password',
            label: 'Password',
            placeholder: 'Min. 8 characters',
            onFocus: (name) => this.setActiveField(name)
        });
        card.add(this.passwordField);

        this.errorText = this.add.text(0, top + 96 + fieldH * 2 + 36, '', {
            font: `${UI.small}px monospace`,
            fill: '#cc0000',
            wordWrap: { width: fieldW }
        }).setOrigin(0.5, 0);
        card.add(this.errorText);

        const btnY = top + modalHeight - 28 - btnH / 2;
        const cancelBtn = this.createButton(-btnW / 2 - 6, btnY, btnW, btnH, 'CANCEL', () => this.close());
        const loginBtn = this.createButton(btnW / 2 + 6, btnY, btnW, btnH, 'LOGIN', () => this.handleSubmit(), true);
        card.add(cancelBtn);
        card.add(loginBtn);

        fxOpenModal(this, overlay, card);

        this.input.keyboard.on('keydown', this.handleKeyDown, this);
        this.setActiveField('email');
    }

    createButton(x, y, width, height, label, callback, isPrimary = false) {
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
        bindPress(this, button, { onClick: callback });

        button.bg = bg;
        button.text = text;

        return button;
    }

    setActiveField(fieldName) {
        this.activeField = fieldName;
        this.emailField.setFocused(fieldName === 'email');
        this.passwordField.setFocused(fieldName === 'password');
        this.updateCursorPosition();
    }

    updateCursorPosition() {
        this.emailField.syncCaret();
        this.passwordField.syncCaret();
    }

    updateDisplay() {
        this.emailField.setDisplay(this.emailValue);
        this.passwordField.setDisplay('•'.repeat(this.passwordValue.length));
        this.updateCursorPosition();
    }

    handleKeyDown(event) {
        if (this.isSubmitting || this._fxClosing) return;

        const key = event.key;

        if (key === 'Tab') {
            event.preventDefault();
            this.setActiveField(this.activeField === 'email' ? 'password' : 'email');
            return;
        }

        if (key === 'Enter') {
            this.handleSubmit();
            return;
        }

        if (key === 'Escape') {
            this.close();
            return;
        }

        if (key === 'Backspace') {
            if (this.activeField === 'email') {
                this.emailValue = this.emailValue.slice(0, -1);
            } else {
                this.passwordValue = this.passwordValue.slice(0, -1);
            }
            this.updateDisplay();
            return;
        }

        if (key.length === 1) {
            if (this.activeField === 'email') {
                this.emailValue += key;
            } else {
                this.passwordValue += key;
            }
            this.updateDisplay();
        }
    }

    showError(message) {
        this.errorText.setText(message);
    }

    clearError() {
        this.errorText.setText('');
    }

    async handleSubmit() {
        if (this.isSubmitting || this._fxClosing) return;

        console.log('[LoginModalScene] handleSubmit() started');
        this.clearError();

        if (!this.emailValue.trim()) {
            this.showError('Email is required');
            this.setActiveField('email');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.emailValue)) {
            this.showError('Invalid email format');
            this.setActiveField('email');
            return;
        }

        if (!this.passwordValue) {
            this.showError('Password is required');
            this.setActiveField('password');
            return;
        }

        if (this.passwordValue.length < 8) {
            this.showError('Password must be at least 8 characters');
            this.setActiveField('password');
            return;
        }

        this.isSubmitting = true;
        this.showError('Logging in...');

        try {
            const user = await gameAPI.login(this.emailValue, this.passwordValue);
            console.log('[LoginModalScene] Login successful:', user);

            if (this.onLoginSuccess) {
                this.onLoginSuccess(user);
            }

            this.close();

        } catch (error) {
            console.error('[LoginModalScene] Login failed:', error);
            this.isSubmitting = false;

            if (error.statusCode === 401) {
                this.showError('Invalid email or password');
            } else if (error.statusCode === 429) {
                this.showError('Too many attempts. Try again later.');
            } else {
                this.showError('Login failed. Please try again.');
            }
        }
    }

    close() {
        console.log('[LoginModalScene] Closing modal');
        fxCloseModal(this);
    }

    shutdown() {
        console.log('[LoginModalScene] shutdown() - cleaning up');
        fxResumeOtherScenes(this);
        this.input.keyboard.off('keydown', this.handleKeyDown, this);
    }
}
