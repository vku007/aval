/**
 * Save / load UI Editor heat-map + ball props as a local JSON file.
 * Uses the File System Access picker when the browser allows it;
 * otherwise SAVE downloads and LOAD opens a file chooser.
 */
const UI_EDITOR_PRESET_KIND = 'ui-editor-preset';
const UI_EDITOR_PRESET_VERSION = 2;
const UI_EDITOR_BALL_PARAM_KEYS = [
    'radius', 'energy', 'angleSpeed', 'orbitRadius', 'tiltX', 'tiltY', 'tiltZ'
];

function copyOrbitPoint(point) {
    if (!point || typeof point.col !== 'number' || typeof point.row !== 'number') {
        return null;
    }
    return { col: point.col, row: point.row };
}

function serializeUiEditor(heatMap, balls, rods) {
    const heat = heatMap && typeof heatMap.serialize === 'function'
        ? heatMap.serialize()
        : {};
    return {
        kind: UI_EDITOR_PRESET_KIND,
        version: UI_EDITOR_PRESET_VERSION,
        heatMap: {
            diffusion: Number(heat && heat.diffusion) || 0,
            cooling: Number(heat && heat.cooling) || 0,
            viewX: Number(heat && heat.viewX) || 0,
            viewY: Number(heat && heat.viewY) || 0,
            viewZ: Number(heat && heat.viewZ) || 0
        },
        balls: (balls || []).map((ball) => {
            const raw = typeof ball.serialize === 'function' ? ball.serialize() : {};
            const params = raw.params || {};
            return {
                name: String(raw.name || ''),
                isVisible: raw.isVisible !== false,
                params: {
                    radius: Number(params.radius),
                    energy: Number(params.energy),
                    angleSpeed: Number(params.angleSpeed),
                    orbitRadius: Number(params.orbitRadius),
                    tiltX: Number(params.tiltX),
                    tiltY: Number(params.tiltY),
                    tiltZ: Number(params.tiltZ),
                    phase: Number(params.phase)
                },
                orbitOn: !!raw.orbitOn,
                orbitCenter: copyOrbitPoint(raw.orbitCenter),
                orbitTarget: copyOrbitPoint(raw.orbitTarget),
                angle: Number(raw.angle) || 0,
                wanderPhase: Number(raw.wanderPhase) || 0
            };
        }),
        rods: (rods || []).map((rod) => {
            const raw = typeof rod.serialize === 'function' ? rod.serialize() : {};
            const params = raw.params || {};
            return {
                name: String(raw.name || ''),
                isVisible: raw.isVisible !== false,
                params: {
                    thickness: Number(params.thickness),
                    energy: Number(params.energy),
                    followSpeed: Number(params.followSpeed),
                    delay: Number(params.delay),
                    gap: Number(params.gap),
                    startAngle: Number(raw.startAngle != null ? raw.startAngle : params.startAngle),
                    endAngle: Number(raw.endAngle != null ? raw.endAngle : params.endAngle),
                    noiseAmt: Number(params.noiseAmt),
                    noiseGrain: Number(params.noiseGrain),
                    noiseFlicker: Number(params.noiseFlicker)
                },
                start: copyOrbitPoint(raw.start),
                end: copyOrbitPoint(raw.end),
                startAngle: Number(raw.startAngle != null ? raw.startAngle : params.startAngle),
                endAngle: Number(raw.endAngle != null ? raw.endAngle : params.endAngle),
                center: copyOrbitPoint(raw.center),
                target: copyOrbitPoint(raw.target)
            };
        })
    };
}

function scaleUiEditorPoint(point, sx, sy) {
    if (!point || typeof point.col !== 'number' || typeof point.row !== 'number') {
        return point || null;
    }
    return { col: point.col * sx, row: point.row * sy };
}

function scaleUiEditorPresetToField(data, field) {
    if (!data || typeof data !== 'object' || !field) {
        return data;
    }
    const from = data.source || { cols: 123, rows: 100 };
    const sx = Math.max(1, field.cols - 1) / Math.max(1, from.cols - 1);
    const sy = Math.max(1, field.rows - 1) / Math.max(1, from.rows - 1);
    if (Math.abs(sx - 1) < 0.001 && Math.abs(sy - 1) < 0.001) {
        return data;
    }
    const copy = JSON.parse(JSON.stringify(data));
    const rScale = (sx + sy) / 2;
    (copy.balls || []).forEach((ball) => {
        ball.orbitCenter = scaleUiEditorPoint(ball.orbitCenter, sx, sy);
        ball.orbitTarget = scaleUiEditorPoint(ball.orbitTarget, sx, sy);
        if (ball.params && ball.params.orbitRadius != null) {
            ball.params.orbitRadius = ball.params.orbitRadius * rScale;
        }
    });
    (copy.rods || []).forEach((rod) => {
        rod.start = scaleUiEditorPoint(rod.start, sx, sy);
        rod.end = scaleUiEditorPoint(rod.end, sx, sy);
        rod.center = scaleUiEditorPoint(rod.center, sx, sy);
        rod.target = scaleUiEditorPoint(rod.target, sx, sy);
    });
    return copy;
}

function applyUiEditorPreset(heatMap, balls, data, rods) {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid preset file');
    }
    if (data.kind && data.kind !== UI_EDITOR_PRESET_KIND) {
        throw new Error('Not a UI Editor preset');
    }
    if (heatMap && data.heatMap && typeof heatMap.applySerialized === 'function') {
        heatMap.applySerialized(data.heatMap);
    }
    const ballList = data.balls || [];
    (balls || []).forEach((ball, index) => {
        if (ballList[index]) {
            ball.applySerialized(ballList[index]);
        }
    });
    const rodList = data.rods || [];
    (rods || []).forEach((rod, index) => {
        if (rodList[index]) {
            rod.applySerialized(rodList[index]);
        }
    });
}

function uiEditorPresetJson(data) {
    const json = JSON.stringify(data, (key, value) => {
        if (typeof value === 'number' && !Number.isFinite(value)) {
            return 0;
        }
        if (typeof value === 'function') {
            return undefined;
        }
        return value;
    }, 2);
    if (!json || json === 'undefined') {
        throw new Error('Preset did not serialize to JSON');
    }
    return json;
}

function uiEditorPresetFilename() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `ui-editor-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
}

function downloadUiEditorPresetJson(json) {
    const link = document.createElement('a');
    link.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    link.download = uiEditorPresetFilename();
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function saveUiEditorPresetFile(data) {
    const json = uiEditorPresetJson(data);
    downloadUiEditorPresetJson(json);
    return json.length;
}

function pickUiEditorPresetFile() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.style.display = 'none';
        let settled = false;
        const finish = (fn, value) => {
            if (settled) {
                return;
            }
            settled = true;
            input.remove();
            fn(value);
        };
        input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            if (!file) {
                finish(reject, new DOMException('No file selected', 'AbortError'));
                return;
            }
            if (file.size < 8) {
                finish(reject, new Error('Preset file is empty'));
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    finish(resolve, parseUiEditorPresetText(String(reader.result || '')));
                } catch (error) {
                    finish(reject, error);
                }
            };
            reader.onerror = () => finish(reject, reader.error || new Error('Could not read file'));
            reader.readAsText(file);
        });
        document.body.appendChild(input);
        input.click();
    });
}

function parseUiEditorPresetText(text) {
    const trimmed = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!trimmed) {
        throw new Error('Preset file is empty');
    }
    const data = JSON.parse(trimmed);
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid preset file');
    }
    return data;
}

function loadUiEditorPresetFile() {
    return pickUiEditorPresetFile();
}
