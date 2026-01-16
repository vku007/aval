/**
 * LoginModalScene
 * In-canvas login modal using pure Phaser graphics
 */
class LoginModalScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LoginModalScene' });
        this.emailValue = '';
        this.passwordValue = '';
        this.activeField = 'email'; // 'email' or 'password'
        this.errorMessage = '';
        this.isSubmitting = false;
    }

    create(data) {
        console.log('[LoginModalScene] create() started');
        
        // Store callback to update parent scene
        this.onLoginSuccess = data?.onLoginSuccess;
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Semi-transparent overlay
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.5);
        overlay.setOrigin(0, 0);
        overlay.setInteractive();
        
        // Modal dimensions
        const modalWidth = 400;
        const modalHeight = 350;
        const modalX = width / 2;
        const modalY = height / 2;
        
        // Modal background
        this.modalBg = this.add.rectangle(modalX, modalY, modalWidth, modalHeight, 0xffffff);
        this.modalBg.setStrokeStyle(2, 0x000000);
        
        // Title
        this.add.text(modalX, modalY - 140, 'LOGIN', {
            font: '24px monospace',
            fill: '#000000'
        }).setOrigin(0.5);
        
        // Email label
        this.add.text(modalX - 180, modalY - 80, 'Email:', {
            font: '14px monospace',
            fill: '#000000'
        }).setOrigin(0, 0.5);
        
        // Email field
        this.emailField = this.createInputField(modalX, modalY - 50, 360, 40, 'email');
        
        // Password label
        this.add.text(modalX - 180, modalY + 10, 'Password:', {
            font: '14px monospace',
            fill: '#000000'
        }).setOrigin(0, 0.5);
        
        // Password field
        this.passwordField = this.createInputField(modalX, modalY + 40, 360, 40, 'password');
        
        // Error message text
        this.errorText = this.add.text(modalX, modalY + 80, '', {
            font: '12px monospace',
            fill: '#ff0000',
            wordWrap: { width: 360 }
        }).setOrigin(0.5, 0);
        
        // Buttons
        this.createButton(modalX - 95, modalY + 130, 170, 40, 'CANCEL', () => this.close());
        this.createButton(modalX + 95, modalY + 130, 170, 40, 'LOGIN', () => this.handleSubmit(), true);
        
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
        
        // Update cursor positions
        this.updateCursorPosition();
    }

    updateCursorPosition() {
        const emailWidth = this.emailField.text.width;
        const passwordWidth = this.passwordField.text.width;
        
        this.emailField.cursor.setPosition(-180 + 10 + emailWidth, 0);
        this.emailField.cursor.setVisible(this.activeField === 'email');
        
        this.passwordField.cursor.setPosition(-180 + 10 + passwordWidth, 0);
        this.passwordField.cursor.setVisible(this.activeField === 'password');
    }

    handleKeyDown(event) {
        if (this.isSubmitting) return;
        
        const key = event.key;
        
        // Tab to switch fields
        if (key === 'Tab') {
            event.preventDefault();
            this.setActiveField(this.activeField === 'email' ? 'password' : 'email');
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
            } else {
                this.passwordValue = this.passwordValue.slice(0, -1);
            }
            this.updateDisplay();
            return;
        }
        
        // Regular characters
        if (key.length === 1) {
            if (this.activeField === 'email') {
                this.emailValue += key;
            } else {
                this.passwordValue += key;
            }
            this.updateDisplay();
        }
    }

    updateDisplay() {
        // Update email display
        this.emailField.text.setText(this.emailValue);
        
        // Update password display (bullets)
        this.passwordField.text.setText('•'.repeat(this.passwordValue.length));
        
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
        
        console.log('[LoginModalScene] handleSubmit() started');
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
        
        if (this.passwordValue.length < 8) {
            this.showError('Password must be at least 8 characters');
            this.setActiveField('password');
            return;
        }
        
        // Disable input during submission
        this.isSubmitting = true;
        this.showError('Logging in...');
        
        try {
            const user = await gameAPI.login(this.emailValue, this.passwordValue);
            console.log('[LoginModalScene] Login successful:', user);
            
            // Update parent scene
            if (this.onLoginSuccess) {
                this.onLoginSuccess(user);
            }
            
            // Close modal
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
        this.scene.stop('LoginModalScene');
    }

    shutdown() {
        console.log('[LoginModalScene] shutdown() - cleaning up');
        this.input.keyboard.off('keydown', this.handleKeyDown, this);
    }
}
