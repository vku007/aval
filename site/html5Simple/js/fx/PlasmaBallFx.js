/**
 * Yellow plasma ball on a deep blue field for UITestScene.
 * WebGL shader when available; masked glowing orbs otherwise.
 * Tap the panel to orbit the ball around that point (radius = 3 ball sizes).
 * The orbit center eases to each new tap so the ball flies instead of jumping.
 */
const PLASMA_BALL_RADIUS = 0.025;
const PLASMA_BALL_SIZE = PLASMA_BALL_RADIUS * 2;
const PLASMA_ORBIT_RADIUS = PLASMA_BALL_SIZE * 3;
const PLASMA_ORBIT_SPEED = 1.6;
const PLASMA_CENTER_FOLLOW = 3.2;

const PLASMA_BALL_FS = `
precision mediump float;

uniform float time;
uniform vec2 resolution;
uniform vec2 ballPos;
varying vec2 fragCoord;

void main () {
    vec2 uv = fragCoord / resolution.xy;
    float aspect = resolution.x / max(resolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);

    float t = time;
    vec2 q = p;
    q.x += 0.012 * sin(p.y * 10.0 + t * 1.7);
    q.y += 0.012 * cos(p.x * 9.0 - t * 1.35);

    vec2 c1 = ballPos;
    vec2 c2 = vec2(
        c1.x + 0.022 * sin(t * 2.15),
        c1.y + 0.02 * cos(t * 1.72)
    );

    float d1 = length(q - c1);
    float d2 = length(q - c2);
    float field = 0.023 / (d1 + 0.0025) + 0.01 / (d2 + 0.004);

    float ang = atan(q.y - c1.y, q.x - c1.x);
    float ripple = 0.5 + 0.5 * sin(ang * 6.0 + t * 4.2 + d1 * 72.0);
    float wisp = pow(max(0.0, 1.0 - d1 * 13.6), 2.2) * pow(ripple, 10.0);

    vec3 deep = vec3(0.02, 0.07, 0.24);
    vec3 mid = vec3(0.04, 0.20, 0.52);
    vec3 gold = vec3(1.0, 0.82, 0.16);
    vec3 hot = vec3(1.0, 0.97, 0.78);

    float bgWave = 0.5 + 0.5 * sin(p.x * 5.5 + p.y * 3.8 + t * 0.55);
    vec3 col = mix(deep, mid, 0.32 + 0.22 * bgWave);

    float glow = field * field;
    float core = smoothstep(1.15, 2.15, field);

    col += gold * glow * 0.9;
    col += vec3(1.0, 0.45, 0.08) * glow * 0.25;
    col += hot * core;
    col += gold * wisp * 1.55;

    float vig = smoothstep(1.15, 0.18, length(uv - 0.5));
    col *= 0.58 + 0.42 * vig;

    gl_FragColor = vec4(col, 1.0);
}
`;

function wanderBallPos(t, aspect) {
    return {
        x: 0.50 * aspect + 0.24 * Math.sin(t * 0.92),
        y: 0.50 + 0.27 * Math.sin(t * 1.18 + 0.9)
    };
}

function plasmaBallPos(state) {
    if (!state.orbitOn) {
        return wanderBallPos(state.t, state.aspect);
    }
    return {
        x: state.orbitCenter.x + Math.cos(state.angle) * PLASMA_ORBIT_RADIUS,
        y: state.orbitCenter.y + Math.sin(state.angle) * PLASMA_ORBIT_RADIUS
    };
}

function beginOrRetargetOrbit(state, target) {
    const ball = plasmaBallPos(state);
    if (!state.orbitOn) {
        state.orbitOn = true;
        let ang = Math.atan2(ball.y - target.y, ball.x - target.x);
        if (!Number.isFinite(ang)) {
            ang = 0;
        }
        state.angle = ang;
        state.orbitCenter = {
            x: ball.x - Math.cos(ang) * PLASMA_ORBIT_RADIUS,
            y: ball.y - Math.sin(ang) * PLASMA_ORBIT_RADIUS
        };
    }
    state.orbitTarget = { x: target.x, y: target.y };
}

function stepPlasmaMotion(state, delta) {
    state.t += delta / 1000;
    if (state.orbitOn && state.orbitTarget) {
        state.angle += (delta / 1000) * PLASMA_ORBIT_SPEED;
        const k = 1 - Math.exp(-PLASMA_CENTER_FOLLOW * (delta / 1000));
        state.orbitCenter.x += (state.orbitTarget.x - state.orbitCenter.x) * k;
        state.orbitCenter.y += (state.orbitTarget.y - state.orbitCenter.y) * k;
    }
    return plasmaBallPos(state);
}

function writeBallUniform(view, ball) {
    if (view && view.uniforms && view.uniforms.ballPos) {
        view.uniforms.ballPos.value.x = ball.x;
        view.uniforms.ballPos.value.y = ball.y;
    }
}

function pointerToPlasmaSpace(pointer, x, y, width, height) {
    const localX = Phaser.Math.Clamp(pointer.worldX - x, 0, width);
    const localY = Phaser.Math.Clamp(pointer.worldY - y, 0, height);
    const aspect = width / Math.max(height, 1);
    return {
        x: (localX / width) * aspect,
        y: 1 - localY / height
    };
}

function bindPlasmaOrbit(scene, state, x, y, width, height) {
    const hit = scene.add.zone(x, y, width, height).setOrigin(0);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (pointer) => {
        beginOrRetargetOrbit(state, pointerToPlasmaSpace(pointer, x, y, width, height));
    });
    state.hit = hit;
}

function newPlasmaState(aspect) {
    return {
        t: 0,
        aspect,
        orbitOn: false,
        orbitCenter: { x: 0.5 * aspect, y: 0.5 },
        orbitTarget: null,
        angle: 0
    };
}

function attachPlasmaBall(scene, x, y, width, height) {
    const maskG = scene.make.graphics({ add: false });
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRect(x, y, width, height);
    const mask = maskG.createGeometryMask();
    const aspect = width / Math.max(height, 1);

    const useShader = scene.game.renderer.type === Phaser.WEBGL
        && typeof Phaser.Display.BaseShader === 'function'
        && typeof scene.add.shader === 'function';

    if (useShader) {
        try {
            const start = wanderBallPos(0, aspect);
            const shader = new Phaser.Display.BaseShader('PlasmaBall', PLASMA_BALL_FS, null, {
                ballPos: { type: '2f', value: { x: start.x, y: start.y } }
            });
            const view = scene.add.shader(shader, x + width / 2, y + height / 2, width, height);
            view.setMask(mask);
            const state = Object.assign(newPlasmaState(aspect), {
                kind: 'shader',
                view,
                maskG,
                update: (_, delta) => {
                    writeBallUniform(view, stepPlasmaMotion(state, delta));
                }
            });
            bindPlasmaOrbit(scene, state, x, y, width, height);
            return state;
        } catch (error) {
            console.warn('[PlasmaBallFx] Shader failed, using glowing orbs', error);
        }
    }

    return attachPlasmaBallCanvas(scene, x, y, width, height, mask, maskG, aspect);
}

function ensurePlasmaOrbTexture(scene) {
    const key = 'plasma-orb';
    if (scene.textures.exists(key)) {
        return key;
    }
    const size = 256;
    const tex = scene.textures.createCanvas(key, size, size);
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,252,230,1)');
    g.addColorStop(0.12, 'rgba(255,236,140,0.95)');
    g.addColorStop(0.28, 'rgba(255,196,40,0.6)');
    g.addColorStop(0.5, 'rgba(255,140,20,0.28)');
    g.addColorStop(0.72, 'rgba(30,70,160,0.14)');
    g.addColorStop(1, 'rgba(5,18,56,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
    return key;
}

function attachPlasmaBallCanvas(scene, x, y, width, height, mask, maskG, aspect) {
    const bg = scene.add.graphics();
    bg.fillStyle(0x051238, 1);
    bg.fillRect(x, y, width, height);
    bg.setMask(mask);

    const key = ensurePlasmaOrbTexture(scene);
    const orbSize = Math.min(width, height) * 0.2375;
    const orb = scene.add.image(x + width / 2, y + height / 2, key);
    orb.setDisplaySize(orbSize, orbSize);
    orb.setBlendMode(Phaser.BlendModes.ADD);
    orb.setMask(mask);

    const orb2 = scene.add.image(x + width / 2, y + height / 2, key);
    orb2.setDisplaySize(orbSize * 0.55, orbSize * 0.55);
    orb2.setBlendMode(Phaser.BlendModes.ADD);
    orb2.setAlpha(0.85);
    orb2.setMask(mask);

    const state = Object.assign(newPlasmaState(aspect), {
        kind: 'canvas',
        x,
        y,
        width,
        height,
        view: orb,
        maskG,
        update: (_, delta) => {
            const ball = stepPlasmaMotion(state, delta);
            const cx = x + ball.x * height;
            const cy = y + (1 - ball.y) * height;
            orb.setPosition(cx, cy);
            orb2.setPosition(
                cx + width * 0.015 * Math.sin(state.t * 2.15),
                cy + height * 0.0125 * Math.cos(state.t * 1.72)
            );
        }
    });
    bindPlasmaOrbit(scene, state, x, y, width, height);
    return state;
}
