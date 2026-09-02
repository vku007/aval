/**
 * Motion + fill helpers driven by UI.fx.
 */

function fxStopIdle(scene, target) {
    if (!scene || !target) return;
    scene.tweens.killTweensOf(target);
    if (target._fxRestY != null) {
        target.y = target._fxRestY;
    }
    target.setScale(1);
}

function fxStartIdle(scene, target, kind) {
    if (!scene || !target || !UI.fx) return;
    fxStopIdle(scene, target);

    if (UI.fx.goPulse && (kind === 'go' || kind === 'pulse')) {
        scene.tweens.add({
            targets: target,
            scaleX: UI.fx.goPulseScale,
            scaleY: UI.fx.goPulseScale,
            duration: UI.fx.goPulseMs / 2,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    if (kind === 'go' && UI.fx.goBounce && UI.fx.goBouncePx) {
        if (target._fxRestY == null) {
            target._fxRestY = target.y;
        }
        scene.tweens.add({
            targets: target,
            y: target._fxRestY - UI.fx.goBouncePx,
            duration: 450,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
}

function fxPressDown(scene, target, options = {}) {
    if (!scene || !target || !UI.fx) return;
    scene.tweens.killTweensOf(target);
    const scale = options.strong ? UI.fx.pressDownStrong : UI.fx.pressDown;
    scene.tweens.add({
        targets: target,
        scaleX: scale,
        scaleY: scale,
        duration: 60,
        ease: 'Quad.easeOut'
    });
    const pos = fxWorldXY(target);
    const tapFx = options.tapFx || 'stars';
    if (tapFx === 'ring') {
        fxTapRing(scene, pos.x, pos.y, {
            radius: Math.max(target.buttonWidth || 64, target.buttonHeight || 48) * 0.55,
            color: options.ringColor || 0x000000
        });
        fxRisingGhost(scene, pos.x, pos.y, options.ghostLabel || (target.buttonText && target.buttonText.text));
    } else if (tapFx !== 'none') {
        fxFallingStars(scene, pos.x, pos.y);
        if (UI.fx.pressParticles && options.particles) {
            fxBurstDots(scene, pos.x, pos.y, 4);
        }
    }
}

function fxPressUp(scene, target, options = {}) {
    if (!scene || !target || !UI.fx) return;
    scene.tweens.killTweensOf(target);
    const overshoot = UI.fx.overshoot || 1;
    const rest = 1;
    const finish = () => {
        const canIdle = options.resumeIdle && (!options.isEnabled || options.isEnabled());
        if (canIdle) {
            fxStartIdle(scene, target, options.idleKind);
        }
    };
    if (overshoot !== rest) {
        scene.tweens.add({
            targets: target,
            scaleX: overshoot,
            scaleY: overshoot,
            duration: 80,
            ease: 'Quad.easeOut',
            onComplete: () => {
                scene.tweens.add({
                    targets: target,
                    scaleX: rest,
                    scaleY: rest,
                    duration: 80,
                    onComplete: finish
                });
            }
        });
    } else {
        scene.tweens.add({
            targets: target,
            scaleX: rest,
            scaleY: rest,
            duration: 80,
            onComplete: finish
        });
    }
}

function bindPress(scene, target, options = {}) {
    let pressed = false;

    target.on('pointerdown', () => {
        if (options.isEnabled && !options.isEnabled()) return;
        pressed = true;
        fxPressDown(scene, target, options);
    });

    const release = (fire) => {
        if (!pressed) return;
        pressed = false;
        const stillOn = !options.isEnabled || options.isEnabled();
        fxPressUp(scene, target, {
            resumeIdle: stillOn && !!options.idleKind,
            idleKind: options.idleKind,
            isEnabled: options.isEnabled
        });
        if (fire && stillOn && options.onClick) {
            options.onClick();
        }
    };

    target.on('pointerup', () => release(true));
    target.on('pointerout', () => release(false));
    target.on('pointerupoutside', () => release(false));
}

function redrawWireButton(btn, mode) {
    if (!btn || !btn.buttonBg) return;
    const w = btn.buttonWidth;
    const h = btn.buttonHeight;
    const bg = btn.buttonBg;
    bg.clear();

    if (mode === 'disabled' || mode === 'goOff') {
        bg.fillStyle(0xcccccc, 1);
        bg.fillRect(-w / 2, -h / 2, w, h);
        bg.lineStyle(2, 0x999999, 1);
        bg.strokeRect(-w / 2, -h / 2, w, h);
        if (btn.buttonText) btn.buttonText.setColor('#999999');
        return;
    }

    if (mode === 'goOn') {
        bg.fillStyle(0xccffcc, 1);
        bg.fillRect(-w / 2, -h / 2, w, h);
        bg.lineStyle(2, 0x00cc00, 1);
        bg.strokeRect(-w / 2, -h / 2, w, h);
        if (btn.buttonText) btn.buttonText.setColor('#009900');
        return;
    }

    if (mode === 'goFlash') {
        bg.fillStyle(0x00cc00, 1);
        bg.fillRect(-w / 2, -h / 2, w, h);
        bg.lineStyle(2, 0x006600, 1);
        bg.strokeRect(-w / 2, -h / 2, w, h);
        if (btn.buttonText) btn.buttonText.setColor('#ffffff');
        return;
    }

    if (mode === 'selected' && UI.fx) {
        bg.fillStyle(UI.fx.selectFill, 1);
        bg.fillRect(-w / 2, -h / 2, w, h);
        bg.lineStyle(UI.fx.selectStroke, 0x000000, 1);
        bg.strokeRect(-w / 2, -h / 2, w, h);
        if (btn.buttonText) btn.buttonText.setColor('#000000');
        return;
    }

    bg.lineStyle(2, 0x000000, 1);
    bg.strokeRect(-w / 2, -h / 2, w, h);
    if (btn.buttonText) btn.buttonText.setColor('#000000');
}

function fxSelectMove(btn, selected) {
    if (!btn) return;
    btn.isSelected = !!selected;
    if (!btn.isEnabled) {
        redrawWireButton(btn, 'disabled');
        return;
    }
    redrawWireButton(btn, selected ? 'selected' : 'idle');
}

function fxPop(scene, target) {
    if (!scene || !target || !UI.fx || !UI.fx.roundPop) return;
    target.setScale(UI.fx.roundPopFrom);
    scene.tweens.add({
        targets: target,
        scaleX: UI.fx.roundPopPeak,
        scaleY: UI.fx.roundPopPeak,
        duration: 90,
        ease: 'Quad.easeOut',
        onComplete: () => {
            scene.tweens.add({
                targets: target,
                scaleX: 1,
                scaleY: 1,
                duration: 90
            });
        }
    });
}

function fxPopIn(scene, target) {
    if (!scene || !target) return;
    if (!UI.fx || !UI.fx.modalPop) {
        target.setScale(1);
        return;
    }
    target.setScale(UI.fx.errorPopFrom || 0.85);
    scene.tweens.add({
        targets: target,
        scaleX: 1,
        scaleY: 1,
        duration: 140,
        ease: 'Back.Out'
    });
}

function fxSceneFadeMs() {
    if (!UI.fx || !UI.fx.sceneFade) return 0;
    return UI.fx.sceneFadeMs || 0;
}

function fxGoTo(scene, key, data, options = {}) {
    if (!scene || scene._fxGoing) return;
    scene._fxGoing = true;

    const go = () => {
        scene.scene.start(key, data);
    };

    const ms = fxSceneFadeMs();
    const cam = scene.cameras && scene.cameras.main;
    if (!cam || !ms || typeof cam.fadeOut !== 'function') {
        go();
        return;
    }

    if (options.flash && UI.fx.sceneFlash && typeof cam.flash === 'function') {
        cam.flash(Math.min(120, ms), 255, 255, 255);
    }

    cam.once('camerafadeoutcomplete', go);
    cam.fadeOut(ms, 0, 0, 0);
}

function fxEnter(scene, options = {}) {
    if (!scene || !scene.cameras || !scene.cameras.main) return;
    const cam = scene.cameras.main;
    const ms = fxSceneFadeMs();
    if (!ms || typeof cam.fadeIn !== 'function') return;

    if (options.flash && UI.fx && UI.fx.sceneFlash && typeof cam.flash === 'function') {
        cam.flash(Math.min(120, ms), 255, 255, 255);
    }
    cam.fadeIn(ms, 0, 0, 0);
}

function fxPauseOtherScenes(scene) {
    const paused = [];
    const scenes = scene.scene && scene.scene.manager && scene.scene.manager.scenes;
    if (!scenes) return paused;
    scenes.forEach((other) => {
        if (other && other !== scene && other.sys && other.sys.isActive() && other.input && other.input.enabled) {
            other.input.enabled = false;
            paused.push(other);
        }
    });
    scene._fxPausedScenes = paused;
    return paused;
}

function fxResumeOtherScenes(scene) {
    (scene._fxPausedScenes || []).forEach((other) => {
        if (other && other.input) other.input.enabled = true;
    });
    scene._fxPausedScenes = [];
}

function fxOpenModal(scene, overlay, card) {
    if (!scene) return;
    scene.modalOverlay = overlay;
    scene.modalCard = card;
    scene._fxClosing = false;

    if (scene.scene && typeof scene.scene.bringToTop === 'function') {
        scene.scene.bringToTop();
    }
    fxPauseOtherScenes(scene);

    const ms = fxSceneFadeMs() || 80;
    const targetAlpha = overlay && overlay._fxTargetAlpha != null ? overlay._fxTargetAlpha : 0.5;

    if (overlay) {
        overlay.setDepth(0);
        overlay.setAlpha(0);
        scene.tweens.add({
            targets: overlay,
            alpha: targetAlpha,
            duration: ms,
            ease: 'Quad.easeOut'
        });
    }

    if (!card) return;

    card.setDepth(10);
    if (UI.fx && UI.fx.modalPop) {
        fxPopIn(scene, card);
    } else {
        card.setScale(1);
        card.setAlpha(0);
        scene.tweens.add({
            targets: card,
            alpha: 1,
            duration: ms,
            ease: 'Quad.easeOut'
        });
    }
}

function fxCloseModal(scene, onDone) {
    if (!scene || scene._fxClosing) return;
    scene._fxClosing = true;

    const finish = () => {
        fxResumeOtherScenes(scene);
        if (typeof onDone === 'function') {
            onDone();
        } else {
            scene.scene.stop();
        }
    };

    const overlay = scene.modalOverlay;
    const card = scene.modalCard;
    const ms = fxSceneFadeMs() || 80;

    if (overlay) scene.tweens.killTweensOf(overlay);
    if (card) scene.tweens.killTweensOf(card);

    if (!overlay && !card) {
        finish();
        return;
    }

    if (overlay) {
        scene.tweens.add({
            targets: overlay,
            alpha: 0,
            duration: ms,
            ease: 'Quad.easeIn'
        });
    }

    if (card) {
        const pop = UI.fx && UI.fx.modalPop;
        scene.tweens.add({
            targets: card,
            scaleX: pop ? (UI.fx.errorPopFrom || 0.85) : 1,
            scaleY: pop ? (UI.fx.errorPopFrom || 0.85) : 1,
            alpha: 0,
            duration: ms,
            ease: 'Quad.easeIn',
            onComplete: finish
        });
    } else {
        scene.time.delayedCall(ms, finish);
    }
}

function fxPunch(scene, target) {
    fxStress(scene, target);
}

function fxStress(scene, target, options = {}) {
    if (!scene || !target || !UI.fx) return;
    if (!UI.fx.scorePunch && !UI.fx.stressChanged) return;

    scene.tweens.killTweensOf(target);

    const restX = target._fxRestX != null ? target._fxRestX : target.x;
    target._fxRestX = restX;
    target.x = restX;

    if (UI.fx.scorePunch) {
        const peak = UI.fx.scorePunchScale;
        scene.tweens.add({
            targets: target,
            scaleX: peak,
            scaleY: peak,
            duration: 90,
            yoyo: true,
            ease: 'Quad.easeOut'
        });
    }

    const shake = UI.fx.stressShakePx || 0;
    if (UI.fx.stressChanged && shake) {
        scene.tweens.add({
            targets: target,
            x: restX + shake,
            duration: 40,
            yoyo: true,
            repeat: 5,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                target.x = restX;
            }
        });
    }

    if (UI.fx.stressChanged && target.setColor) {
        const orig = options.origColor || (target.style && target.style.color) || '#000000';
        const flash = options.flashColor || '#ffffff';
        target.setColor(flash);
        scene.time.delayedCall(140, () => {
            if (target.active) target.setColor(orig);
        });
    }

    const pos = fxWorldXY(target);
    fxFallingStars(scene, pos.x, pos.y, UI.fx.stressStars);
}

function fxTapRing(scene, x, y, options = {}) {
    if (!scene || !scene.add) return;
    const radius = options.radius || 32;
    const color = options.color || 0x000000;
    const ring = scene.add.graphics();
    ring.lineStyle(2, color, 1);
    ring.strokeCircle(0, 0, radius);
    ring.setPosition(x, y);
    ring.setDepth(3000);
    ring.setScale(0.35);
    scene.tweens.add({
        targets: ring,
        scaleX: 1.85,
        scaleY: 1.85,
        alpha: 0,
        duration: 220,
        ease: 'Quad.easeOut',
        onComplete: () => ring.destroy()
    });
}

function fxRisingGhost(scene, x, y, label) {
    if (!scene || !label) return;
    const ghost = scene.add.text(x, y, String(label), {
        font: `${UI.body}px monospace`,
        fill: '#000000'
    }).setOrigin(0.5).setDepth(3000).setAlpha(0.7);
    scene.tweens.add({
        targets: ghost,
        y: y - 42,
        alpha: 0,
        duration: 280,
        ease: 'Quad.easeOut',
        onComplete: () => ghost.destroy()
    });
}

function fxWorldXY(obj) {
    if (obj && typeof obj.getWorldTransformMatrix === 'function') {
        const m = obj.getWorldTransformMatrix();
        return { x: m.tx, y: m.ty };
    }
    return { x: obj?.x || 0, y: obj?.y || 0 };
}

function fxDrawStar(scene, x, y, size, color) {
    const g = scene.add.graphics();
    g.lineStyle(1.5, color, 1);
    g.fillStyle(color, 0.12);
    const inner = size * 0.38;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? size : inner;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.setPosition(x, y);
    g.setDepth(3000);
    return g;
}

function fxFallingStars(scene, x, y, count) {
    if (!scene || !scene.add || !UI.fx) return;
    const n = count != null ? count : UI.fx.fallingStars;
    if (!n) return;
    for (let i = 0; i < n; i++) {
        const size = 4 + Math.random() * 6;
        const sx = x + (Math.random() - 0.5) * 40;
        const sy = y + (Math.random() - 0.5) * 10;
        const star = fxDrawStar(scene, sx, sy, size, 0x000000);
        star.setRotation(Math.random() * Math.PI);
        const drift = (Math.random() - 0.5) * 50;
        const fall = 100 + Math.random() * 150;
        scene.tweens.add({
            targets: star,
            x: sx + drift,
            y: sy + fall,
            rotation: star.rotation + (Math.random() > 0.5 ? 2.2 : -2.2),
            alpha: 0,
            duration: 480 + Math.random() * 320,
            delay: i * 18,
            ease: 'Cubic.easeIn',
            onComplete: () => star.destroy()
        });
    }
}

function fxFadeText(scene, textObj, value) {
    if (!textObj) return;
    if (!scene || !UI.fx || !UI.fx.statusFade) {
        textObj.setText(value);
        return;
    }
    scene.tweens.killTweensOf(textObj);
    scene.tweens.add({
        targets: textObj,
        alpha: 0,
        duration: 40,
        onComplete: () => {
            textObj.setText(value);
            scene.tweens.add({
                targets: textObj,
                alpha: 1,
                duration: 40
            });
        }
    });
}

function fxBurstDots(scene, x, y, count = 10) {
    if (!scene || !scene.add) return;
    const n = count;
    for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i) / n;
        const dist = 18 + Math.random() * 16;
        const dot = scene.add.circle(x, y, 2, 0x000000);
        scene.tweens.add({
            targets: dot,
            x: x + Math.cos(angle) * dist,
            y: y + Math.sin(angle) * dist,
            alpha: 0,
            duration: 280,
            onComplete: () => dot.destroy()
        });
    }
}

function fxShake(scene) {
    if (!scene || !UI.fx || !UI.fx.camShake) return;
    scene.cameras.main.shake(UI.fx.camShakeMs, UI.fx.camShakeIntensity);
}

function drawRoundedCard(scene, x, y, width, height, radius = 16) {
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    g.lineStyle(2, 0x000000, 1);
    g.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    return g;
}

function createStyledInput(scene, x, y, width, height, options = {}) {
    const pad = 16;
    const radius = 12;
    const field = scene.add.container(x, y);
    const labelText = options.label || '';
    const placeholderText = options.placeholder || '';

    const shell = scene.add.graphics();
    const hit = scene.add.rectangle(0, 0, width, height, 0x000000, 0);
    hit.setInteractive();

    const label = scene.add.text(-width / 2 + pad, 0, labelText, {
        font: `${UI.body}px monospace`,
        fill: '#888888'
    }).setOrigin(0, 0.5);

    const valueY = 8;
    const text = scene.add.text(-width / 2 + pad, valueY, '', {
        font: `${UI.body}px monospace`,
        fill: '#111111'
    }).setOrigin(0, 0.5);

    const placeholder = scene.add.text(-width / 2 + pad, valueY, placeholderText, {
        font: `${UI.body}px monospace`,
        fill: '#c4c4c4'
    }).setOrigin(0, 0.5);

    const caret = scene.add.rectangle(-width / 2 + pad, valueY, 2, UI.body + 6, 0x111111);
    caret.setOrigin(0.5);

    field.add([shell, hit, label, placeholder, text, caret]);

    field.shell = shell;
    field.text = text;
    field.cursor = caret;
    field.name = options.name;
    field.fieldWidth = width;
    field.fieldHeight = height;
    field.isActive = false;
    field.hasValue = false;

    scene.tweens.add({
        targets: caret,
        alpha: 0,
        duration: 480,
        yoyo: true,
        repeat: -1
    });

    const redraw = () => {
        const active = field.isActive;
        const filled = field.hasValue;
        const floated = active || filled;

        shell.clear();
        shell.fillStyle(active ? 0xffffff : 0xf4f4f4, 1);
        shell.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
        shell.lineStyle(active ? 2 : 1, active ? 0x111111 : 0xd0d0d0, 1);
        shell.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);

        if (active) {
            shell.lineStyle(3, 0x111111, 1);
            shell.beginPath();
            shell.moveTo(-width / 2 + radius, height / 2 - 1);
            shell.lineTo(width / 2 - radius, height / 2 - 1);
            shell.strokePath();
        }

        label.setFontSize(floated ? UI.small : UI.body);
        label.setY(floated ? -height / 2 + 12 : 0);
        label.setColor(active ? '#111111' : '#888888');

        text.setY(floated ? valueY : 0);
        placeholder.setY(floated ? valueY : 0);
        placeholder.setVisible(!filled && !active);
        caret.setVisible(active);
        caret.y = floated ? valueY : 0;
    };

    const syncCaret = () => {
        caret.x = -width / 2 + pad + text.width + 3;
        caret.y = (field.isActive || field.hasValue) ? valueY : 0;
        caret.setVisible(field.isActive);
    };

    field.redraw = redraw;
    field.syncCaret = syncCaret;

    field.setFocused = (active) => {
        field.isActive = !!active;
        redraw();
        syncCaret();
    };

    field.setDisplay = (value) => {
        field.hasValue = String(value || '').length > 0;
        text.setText(value || '');
        redraw();
        syncCaret();
    };

    hit.on('pointerdown', () => {
        if (typeof options.onFocus === 'function') {
            options.onFocus(field.name);
        }
    });

    redraw();
    syncCaret();
    return field;
}
