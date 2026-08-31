/**
 * RegisterModalScene
 * In-canvas registration modal for promoting guest users to regular users
 */
class RegisterModalScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RegisterModalScene' });
        this.emailValue = '';
        this.passwordValue = '';
        this.displayNameValue = '';
        this.activeField = 'email'; // 'email', 'password', or 'displayName'
        this.errorMessage = '';
        this.isSubmitting = false;
    }

    create(data) {
        console.log('[RegisterModalScene] create() started');
        
        // Store callback to update parent scene
        this.onRegisterSuccess = data?.onRegisterSuccess;
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Semi-transparent overlay
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.5);
        overlay.setOrigin(0, 0);
        overlay.setInteractive();
        
        const modalWidth = Math.min(350, width - 24);
        const modalHeight = 400;
        const modalX = width / 2;
        const modalY = height / 2;
        const fieldW = modalWidth - 32;
        const labelX = modalX - fieldW / 2;
        const btnW = Math.floor((fieldW - 12) / 2);
        
        this.modalBg = this.add.rectangle(modalX, modalY, modalWidth, modalHeight, 0xffffff);
        this.modalBg.setStrokeStyle(2, 0x000000);
        
        this.add.text(modalX, modalY - 170, 'REGISTER', {
            font: `${UI.heading}px monospace`,
            fill: '#000000'
        }).setOrigin(0.5);
        
        this.add.text(labelX, modalY - 132, 'Email:', {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0.5);
        
        this.emailField = this.createInputField(modalX, modalY - 104, fieldW, 36, 'email');
        
        this.add.text(labelX, modalY - 58, 'Password:', {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0.5);
        
        this.passwordField = this.createInputField(modalX, modalY - 30, fieldW, 36, 'password');
        
        this.add.text(labelX, modalY + 16, 'Display Name (optional):', {
            font: `${UI.body}px monospace`,
            fill: '#000000'
        }).setOrigin(0, 0.5);
        
        this.displayNameField = this.createInputField(modalX, modalY + 44, fieldW, 36, 'displayName');
        
        this.errorText = this.add.text(modalX, modalY + 82, '', {
            font: `${UI.small}px monospace`,
            fill: '#ff0000',
            wordWrap: { width: fieldW }
        }).setOrigin(0.5, 0);
        
        this.createButton(modalX - btnW / 2 - 6, modalY + 154, btnW, 36, 'CANCEL', () => this.close());
        this.createButton(modalX + btnW / 2 + 6, modalY + 154, btnW, 36, 'REGISTER', () => this.handleSubmit(), true);
        
        // Keyboard input
        this.input.keyboard.on('keydown', this.handleKeyDown, this);
        
        // Set initial focus
        this.setActiveField('email');
    }

    createInputField(x, y, width, height, name) {
        const field = this.add.container(x, y);
        
        // Background
        const bg = this.add.rectangle(0, 0, width, height, 0xffffff);
        bg.setStrokeStyle(2, 0x000000);
        
        // Text display
        const text = this.add.text(-width/2 + 10, 0, '', {
            font: '14px monospace',
            fill: '#000000'
        }).setOrigin(0, 0.5);
        
        // Cursor (blinking)
        const cursor = this.add.text(0, 0, '|', {
            font: '14px monospace',
            fill: '#000000'
        }).setOrigin(0, 0.5);
        
        // Blinking animation
        this.tweens.add({
            targets: cursor,
            alpha: 0,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
        
        field.add([bg, text, cursor]);
        field.bg = bg;
        field.text = text;
        field.cursor = cursor;
        field.name = name;
        field.fieldWidth = width;
        
        // Click to focus
        bg.setInteractive();
        bg.on('pointerdown', () => this.setActiveField(name));
        
        return field;
    }

    createButton(x, y, width, height, label, callback, isPrimary = false) {
        const button = this.add.container(x, y);
        
        const bg = this.add.rectangle(0, 0, width, height, isPrimary ? 0x000000 : 0xffffff);
        bg.setStrokeStyle(2, 0x000000);
        
        const text = this.add.text(0, 0, label, {
            font: '14px monospace',
            fill: isPrimary ? '#ffffff' : '#000000'
        }).setOrigin(0.5);
        
        button.add([bg, text]);
        
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setStrokeStyle(3, 0x000000));
        bg.on('pointerout', () => bg.setStrokeStyle(2, 0x000000));
        bg.on('pointerdown', callback);
        
        button.bg = bg;
        button.text = text;
        
        return button;
    }

    setActiveField(fieldName) {
        this.activeField = fieldName;
        
        // Update borders
        this.emailField.bg.setStrokeStyle(fieldName === 'email' ? 3 : 2, 0x000000);
        this.passwordField.bg.setStrokeStyle(fieldName === 'password' ? 3 : 2, 0x000000);
        this.displayNameField.bg.setStrokeStyle(fieldName === 'displayName' ? 3 : 2, 0x000000);
        
        // Update cursor positions
        this.updateCursorPosition();
    }

    updateCursorPosition() {
        const emailWidth = this.emailField.text.width;
        const passwordWidth = this.passwordField.text.width;
        const displayNameWidth = this.displayNameField.text.width;
        
        this.emailField.cursor.setPosition(-this.emailField.fieldWidth / 2 + 10 + emailWidth, 0);
        this.emailField.cursor.setVisible(this.activeField === 'email');
        
        this.passwordField.cursor.setPosition(-this.passwordField.fieldWidth / 2 + 10 + passwordWidth, 0);
        this.passwordField.cursor.setVisible(this.activeField === 'password');
        
        this.displayNameField.cursor.setPosition(-this.displayNameField.fieldWidth / 2 + 10 + displayNameWidth, 0);
        this.displayNameField.cursor.setVisible(this.activeField === 'displayName');
    }

    handleKeyDown(event) {
        if (this.isSubmitting) return;
        
        const key = event.key;
        
        // Tab to switch fields
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
        
        // Enter to submit
        if (key === 'Enter') {
            this.handleSubmit();
            return;
        }
        
        // ESC to cancel
        if (key === 'Escape') {
            this.close();
            return;
        }
        
        // Backspace
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
        
        // Regular characters
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
        // Update email display
        this.emailField.text.setText(this.emailValue);
        
        // Update password display (bullets)
        this.passwordField.text.setText('•'.repeat(this.passwordValue.length));
        
        // Update display name
        this.displayNameField.text.setText(this.displayNameValue);
        
        // Update cursor positions
        this.updateCursorPosition();
    }

    showError(message) {
        this.errorText.setText(message);
    }

    clearError() {
        this.errorText.setText('');
    }

    async handleSubmit() {
        if (this.isSubmitting) return;
        
        console.log('[RegisterModalScene] handleSubmit() started');
        this.clearError();
        
        // Validation
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
        
        // Check password complexity
        if (!/[a-zA-Z]/.test(this.passwordValue) || !/[0-9]/.test(this.passwordValue)) {
            this.showError('Password must contain letters and numbers');
            this.setActiveField('password');
            return;
        }
        
        // Disable input during submission
        this.isSubmitting = true;
        this.showError('Registering...');
        
        try {
            const user = await gameAPI.promoteToRegular(
                this.emailValue, 
                this.passwordValue,
                this.displayNameValue || this.emailValue.split('@')[0]
            );
            console.log('[RegisterModalScene] Registration successful:', user);
            
            // Update parent scene
            if (this.onRegisterSuccess) {
                this.onRegisterSuccess(user);
            }
            
            // Close modal
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
        this.scene.stop('RegisterModalScene');
    }

    shutdown() {
        console.log('[RegisterModalScene] shutdown() - cleaning up');
        this.input.keyboard.off('keydown', this.handleKeyDown, this);
    }
}
