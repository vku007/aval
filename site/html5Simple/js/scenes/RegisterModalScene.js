/**
 * RegisterModalScene
 * In-canvas registration modal for promoting guest users to regular users
 */
class RegisterModalScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RegisterModalScene' });
    }

    init(data) {
        this.emailValue = '';
        this.passwordValue = '';
        this.displayNameValue = '';
        this.activeField = 'email';
        this.errorMessage = '';
        this.isSubmitting = false;
        this.onRegisterSuccess = data?.onRegisterSuccess;
        this._fxClosing = false;
    }

    create(data) {
        console.log('[RegisterModalScene] create() started');

        this.onRegisterSuccess = data?.onRegisterSuccess || this.onRegisterSuccess;

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 1);
        overlay.setOrigin(0, 0);
        overlay.setInteractive();
        overlay._fxTargetAlpha = 0.5;

        const modalWidth = Math.min(350, width - 24);
        const fieldH = Math.max(UI.fieldH, 54);
        const btnH = UI.touchMin;
        const modalHeight = 520;
        const fieldW = modalWidth - 40;
        const btnW = Math.floor((fieldW - 12) / 2);
        const top = -modalHeight / 2;

        const card = this.add.container(width / 2, height / 2);
        card.add(drawRoundedCard(this, 0, 0, modalWidth, modalHeight, 18));

        card.add(this.add.text(0, top + 32, 'Create account', {
            font: `${UI.heading}px monospace`,
            fill: '#111111'
        }).setOrigin(0.5));

        card.add(this.add.text(0, top + 56, 'Save this guest as a real player', {
            font: `${UI.small}px monospace`,
            fill: '#666666',
            wordWrap: { width: fieldW },
            align: 'center'
        }).setOrigin(0.5));

        const fieldStart = top + 88;
        const fieldGap = 14;

        this.emailField = createStyledInput(this, 0, fieldStart, fieldW, fieldH, {
            name: 'email',
            label: 'Email',
            placeholder: 'you@email.com',
            onFocus: (name) => this.setActiveField(name)
        });
        card.add(this.emailField);

        this.passwordField = createStyledInput(this, 0, fieldStart + fieldH + fieldGap, fieldW, fieldH, {
            name: 'password',
            label: 'Password',
            placeholder: 'Min. 12 characters',
            onFocus: (name) => this.setActiveField(name)
        });
        card.add(this.passwordField);

        this.displayNameField = createStyledInput(this, 0, fieldStart + (fieldH + fieldGap) * 2, fieldW, fieldH, {
            name: 'displayName',
            label: 'Display name',
            placeholder: 'Optional',
            onFocus: (name) => this.setActiveField(name)
        });
        card.add(this.displayNameField);

        this.errorText = this.add.text(0, fieldStart + (fieldH + fieldGap) * 3 + 8, '', {
            font: `${UI.small}px monospace`,
            fill: '#cc0000',
            wordWrap: { width: fieldW }
        }).setOrigin(0.5, 0);
        card.add(this.errorText);

        const btnY = top + modalHeight - 28 - btnH / 2;
        const cancelBtn = this.createButton(-btnW / 2 - 6, btnY, btnW, btnH, 'CANCEL', () => this.close());
        const registerBtn = this.createButton(btnW / 2 + 6, btnY, btnW, btnH, 'REGISTER', () => this.handleSubmit(), true);
        card.add(cancelBtn);
        card.add(registerBtn);

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
        this.displayNameField.setFocused(fieldName === 'displayName');
        this.updateCursorPosition();
    }

    updateCursorPosition() {
        this.emailField.syncCaret();
        this.passwordField.syncCaret();
        this.displayNameField.syncCaret();
    }

    handleKeyDown(event) {
        if (this.isSubmitting || this._fxClosing) return;

        const key = event.key;

        if (key === 'Tab') {
            event.preventDefault();
            if (this.activeField === 'email') {
                this.setActiveField('password');
            } else if (this.activeField === 'password') {
                this.setActiveField('displayName');
            } else {
                this.setActiveField('email');
            }
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
            } else if (this.activeField === 'password') {
                this.passwordValue = this.passwordValue.slice(0, -1);
            } else {
                this.displayNameValue = this.displayNameValue.slice(0, -1);
            }
            this.updateDisplay();
            return;
        }

        if (key.length === 1) {
            if (this.activeField === 'email') {
                this.emailValue += key;
            } else if (this.activeField === 'password') {
                this.passwordValue += key;
            } else {
                this.displayNameValue += key;
            }
            this.updateDisplay();
        }
    }

    updateDisplay() {
        this.emailField.setDisplay(this.emailValue);
        this.passwordField.setDisplay('•'.repeat(this.passwordValue.length));
        this.displayNameField.setDisplay(this.displayNameValue);
        this.updateCursorPosition();
    }

    showError(message) {
        this.errorText.setText(message);
    }

    clearError() {
        this.errorText.setText('');
    }

    async handleSubmit() {
        if (this.isSubmitting || this._fxClosing) return;

        console.log('[RegisterModalScene] handleSubmit() started');
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

        if (this.passwordValue.length < 12) {
            this.showError('Password must be at least 12 characters');
            this.setActiveField('password');
            return;
        }

        if (!/[a-zA-Z]/.test(this.passwordValue) || !/[0-9]/.test(this.passwordValue)) {
            this.showError('Password must contain letters and numbers');
            this.setActiveField('password');
            return;
        }

        this.isSubmitting = true;
        this.showError('Registering...');

        try {
            const user = await gameAPI.promoteToRegular(
                this.emailValue,
                this.passwordValue,
                this.displayNameValue || this.emailValue.split('@')[0]
            );
            console.log('[RegisterModalScene] Registration successful:', user);

            if (this.onRegisterSuccess) {
                this.onRegisterSuccess(user);
            }

            this.close();

        } catch (error) {
            console.error('[RegisterModalScene] Registration failed:', error);
            this.isSubmitting = false;

            if (error.statusCode === 409 || error.data?.errorCode === 'EMAIL_EXISTS') {
                this.showError('This email is already registered. Please use the LOGIN button instead.');
            } else if (error.statusCode === 400) {
                if (error.data?.errorCode === 'ALREADY_REGULAR') {
                    this.showError('You are already a registered user');
                } else {
                    this.showError(error.message);
                }
            } else if (error.statusCode === 429) {
                this.showError('Too many attempts. Try again later.');
            } else {
                this.showError('Registration failed. Please try again.');
            }
        }
    }

    close() {
        console.log('[RegisterModalScene] Closing modal');
        fxCloseModal(this);
    }

    shutdown() {
        console.log('[RegisterModalScene] shutdown() - cleaning up');
        fxResumeOtherScenes(this);
        this.input.keyboard.off('keydown', this.handleKeyDown, this);
    }
}
