/**
 * HTML fields laid over a Phaser card. The rectangle math is pure.
 * AccountModalScene is the caller.
 */

function gameRectToCss(canvasRect, scaleW, scaleH, worldX, worldY, worldW, worldH) {
    const sx = scaleW ? canvasRect.width / scaleW : 1;
    const sy = scaleH ? canvasRect.height / scaleH : 1;
    return {
        left: canvasRect.left + (worldX - worldW / 2) * sx,
        top: canvasRect.top + (worldY - worldH / 2) * sy,
        width: worldW * sx,
        height: worldH * sy,
        radius: 12 * sx,
        pad: 16 * sx
    };
}

function mountAuthFields(scene, options) {
    const fields = options.fields || [];
    const form = document.createElement('form');
    form.className = 'auth-fields';
    form.noValidate = true;
    form.hidden = true;

    const inputs = {};
    fields.forEach((field) => {
        const input = document.createElement('input');
        input.name = field.name;
        input.type = field.type;
        input.placeholder = field.placeholder;
        input.setAttribute('aria-label', field.placeholder);
        input.autocomplete = field.autocomplete;
        input.spellcheck = false;
        if (field.value != null) input.value = field.value;
        if (field.type === 'email') input.inputMode = 'email';
        inputs[field.name] = input;
        form.appendChild(input);
    });
    document.body.appendChild(form);

    const place = () => {
        const canvas = scene.game && scene.game.canvas;
        const scale = scene.scale;
        if (!canvas || !scale || !form.isConnected) return;
        const rect = canvas.getBoundingClientRect();
        fields.forEach((field) => {
            const css = gameRectToCss(
                rect,
                scale.width,
                scale.height,
                options.cardX + (field.localX || 0),
                options.cardY + field.localY,
                field.width,
                field.height
            );
            const input = inputs[field.name];
            input.style.left = css.left + 'px';
            input.style.top = css.top + 'px';
            input.style.width = css.width + 'px';
            input.style.height = css.height + 'px';
            input.style.borderRadius = css.radius + 'px';
            input.style.paddingLeft = css.pad + 'px';
            input.style.paddingRight = css.pad + 'px';
        });
    };

    const show = () => {
        if (!form.isConnected || scene._fxClosing) return;
        if (scene.sys && typeof scene.sys.isActive === 'function' && !scene.sys.isActive()) return;
        place();
        form.hidden = false;
        const first = inputs.email || inputs[fields[0] && fields[0].name];
        if (first) first.focus({ preventScroll: true });
    };

    const hide = () => {
        form.hidden = true;
    };

    const onResize = () => place();
    window.addEventListener('resize', onResize);
    if (scene.scale) scene.scale.on('resize', onResize);

    const keyboard = scene.input && scene.input.keyboard;
    let captureDisabled = false;
    if (keyboard && typeof keyboard.disableGlobalCapture === 'function') {
        keyboard.disableGlobalCapture();
        captureDisabled = true;
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (typeof options.onSubmit === 'function') options.onSubmit();
    });
    form.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        if (typeof options.onEscape === 'function') options.onEscape();
    });

    scene.hideAuthFields = hide;
    const placeGlobal = () => {
        if (form.isConnected) place();
    };
    window.placeAuthFields = placeGlobal;

    let destroyed = false;
    const api = {
        place,
        show,
        hide,
        focus(name) {
            const input = inputs[name];
            if (input && !input.disabled) input.focus({ preventScroll: true });
        },
        value(name) {
            const input = inputs[name];
            return input ? input.value : '';
        },
        setBusy(busy) {
            Object.keys(inputs).forEach((name) => {
                inputs[name].disabled = !!busy;
            });
        },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            window.removeEventListener('resize', onResize);
            if (scene.scale) scene.scale.off('resize', onResize);
            if (captureDisabled && keyboard && typeof keyboard.enableGlobalCapture === 'function') {
                keyboard.enableGlobalCapture();
            }
            if (scene.hideAuthFields === hide) scene.hideAuthFields = null;
            if (window.placeAuthFields === placeGlobal) window.placeAuthFields = null;
            form.remove();
        }
    };

    if (scene.events) scene.events.once('shutdown', () => api.destroy());
    return api;
}
