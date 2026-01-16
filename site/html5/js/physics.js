/**
 * Planck.js (Box2D) Physics Engine Wrapper
 * Provides easy integration with Phaser 3
 */

console.log('[physics.js] Loading physics module...');

class PhysicsWorld {
  constructor(options = {}) {
    console.log('[PhysicsWorld] Constructor called with options:', options);
    
    // Physics scale: pixels to meters (Box2D works in meters)
    this.PTM = options.pixelsToMeter || 30; // 30 pixels = 1 meter
    
    // Check if planck is available
    if (typeof planck === 'undefined') {
      throw new Error('Planck.js is not loaded! Make sure the CDN script is included.');
    }
    
    // Create Planck world with gravity
    const gravity = planck.Vec2(
      options.gravityX || 0,
      options.gravityY || 10 // Positive Y = down in screen coords
    );
    this.world = planck.World(gravity);
    
    // Body tracking
    this.bodies = new Map(); // id -> { body, sprite, type }
    this.bodyIdCounter = 0;
    
    // Physics settings
    this.velocityIterations = options.velocityIterations || 8;
    this.positionIterations = options.positionIterations || 3;
    
    // Debug rendering
    this.debugDraw = options.debugDraw || false;
    this.debugGraphics = null;
    
    // Collision callbacks
    this.onBeginContact = null;
    this.onEndContact = null;
    
    // Setup contact listener
    this._setupContactListener();
    
    console.log('[PhysicsWorld] World created with gravity:', gravity.x, gravity.y);
  }

  /**
   * Setup contact listener for collision events
   */
  _setupContactListener() {
    this.world.on('begin-contact', (contact) => {
      if (this.onBeginContact) {
        const fixtureA = contact.getFixtureA();
        const fixtureB = contact.getFixtureB();
        const bodyA = fixtureA.getBody();
        const bodyB = fixtureB.getBody();
        
        const dataA = bodyA.getUserData();
        const dataB = bodyB.getUserData();
        
        this.onBeginContact({
          bodyA: dataA,
          bodyB: dataB,
          fixtureA,
          fixtureB,
          contact
        });
      }
    });

    this.world.on('end-contact', (contact) => {
      if (this.onEndContact) {
        const fixtureA = contact.getFixtureA();
        const fixtureB = contact.getFixtureB();
        const bodyA = fixtureA.getBody();
        const bodyB = fixtureB.getBody();
        
        const dataA = bodyA.getUserData();
        const dataB = bodyB.getUserData();
        
        this.onEndContact({
          bodyA: dataA,
          bodyB: dataB,
          fixtureA,
          fixtureB,
          contact
        });
      }
    });
  }

  /**
   * Convert pixels to meters
   */
  toMeters(pixels) {
    return pixels / this.PTM;
  }

  /**
   * Convert meters to pixels
   */
  toPixels(meters) {
    return meters * this.PTM;
  }

  /**
   * Create a static rectangular body (ground, walls, platforms)
   */
  createStaticBox(x, y, width, height, options = {}) {
    const bodyDef = {
      type: 'static',
      position: planck.Vec2(this.toMeters(x), this.toMeters(y))
    };
    
    const body = this.world.createBody(bodyDef);
    
    const shape = planck.Box(
      this.toMeters(width / 2),
      this.toMeters(height / 2)
    );
    
    body.createFixture({
      shape,
      friction: options.friction ?? 0.5,
      restitution: options.restitution ?? 0.2
    });

    const id = `static_${this.bodyIdCounter++}`;
    const userData = {
      id,
      type: 'static',
      label: options.label || 'ground',
      width,
      height,
      ...options.userData
    };
    body.setUserData(userData);
    
    this.bodies.set(id, { body, sprite: null, type: 'box', width, height });
    
    return { id, body };
  }

  /**
   * Create a dynamic rectangular body
   */
  createDynamicBox(x, y, width, height, options = {}) {
    const bodyDef = {
      type: 'dynamic',
      position: planck.Vec2(this.toMeters(x), this.toMeters(y)),
      angle: options.angle || 0,
      linearDamping: options.linearDamping ?? 0.1,
      angularDamping: options.angularDamping ?? 0.1,
      fixedRotation: options.fixedRotation ?? false,
      bullet: options.bullet ?? false
    };
    
    const body = this.world.createBody(bodyDef);
    
    const shape = planck.Box(
      this.toMeters(width / 2),
      this.toMeters(height / 2)
    );
    
    body.createFixture({
      shape,
      density: options.density ?? 1.0,
      friction: options.friction ?? 0.5,
      restitution: options.restitution ?? 0.3
    });

    const id = `dynamic_${this.bodyIdCounter++}`;
    const userData = {
      id,
      type: 'dynamic',
      label: options.label || 'box',
      width,
      height,
      ...options.userData
    };
    body.setUserData(userData);
    
    this.bodies.set(id, { body, sprite: options.sprite || null, type: 'box', width, height });
    
    return { id, body };
  }

  /**
   * Create a dynamic circular body
   */
  createDynamicCircle(x, y, radius, options = {}) {
    const bodyDef = {
      type: 'dynamic',
      position: planck.Vec2(this.toMeters(x), this.toMeters(y)),
      linearDamping: options.linearDamping ?? 0.1,
      angularDamping: options.angularDamping ?? 0.1,
      bullet: options.bullet ?? false
    };
    
    const body = this.world.createBody(bodyDef);
    
    const shape = planck.Circle(this.toMeters(radius));
    
    body.createFixture({
      shape,
      density: options.density ?? 1.0,
      friction: options.friction ?? 0.3,
      restitution: options.restitution ?? 0.5
    });

    const id = `circle_${this.bodyIdCounter++}`;
    const userData = {
      id,
      type: 'dynamic',
      label: options.label || 'circle',
      radius,
      ...options.userData
    };
    body.setUserData(userData);
    
    this.bodies.set(id, { body, sprite: options.sprite || null, type: 'circle', radius });
    
    return { id, body };
  }

  /**
   * Create a kinematic body (moving platform)
   */
  createKinematicBox(x, y, width, height, options = {}) {
    const bodyDef = {
      type: 'kinematic',
      position: planck.Vec2(this.toMeters(x), this.toMeters(y))
    };
    
    const body = this.world.createBody(bodyDef);
    
    const shape = planck.Box(
      this.toMeters(width / 2),
      this.toMeters(height / 2)
    );
    
    body.createFixture({
      shape,
      friction: options.friction ?? 0.5
    });

    const id = `kinematic_${this.bodyIdCounter++}`;
    const userData = {
      id,
      type: 'kinematic',
      label: options.label || 'platform',
      width,
      height,
      ...options.userData
    };
    body.setUserData(userData);
    
    this.bodies.set(id, { body, sprite: options.sprite || null, type: 'box', width, height });
    
    return { id, body };
  }

  /**
   * Link a Phaser sprite to a physics body
   */
  linkSprite(id, sprite) {
    const bodyData = this.bodies.get(id);
    if (bodyData) {
      bodyData.sprite = sprite;
    }
  }

  /**
   * Apply force to a body
   */
  applyForce(id, forceX, forceY) {
    const bodyData = this.bodies.get(id);
    if (bodyData && bodyData.body) {
      const force = planck.Vec2(forceX, forceY);
      const point = bodyData.body.getWorldCenter();
      bodyData.body.applyForce(force, point, true);
    }
  }

  /**
   * Apply impulse to a body (instant velocity change)
   */
  applyImpulse(id, impulseX, impulseY) {
    const bodyData = this.bodies.get(id);
    if (bodyData && bodyData.body) {
      const impulse = planck.Vec2(impulseX, impulseY);
      const point = bodyData.body.getWorldCenter();
      bodyData.body.applyLinearImpulse(impulse, point, true);
    }
  }

  /**
   * Set linear velocity directly
   */
  setVelocity(id, vx, vy) {
    const bodyData = this.bodies.get(id);
    if (bodyData && bodyData.body) {
      bodyData.body.setLinearVelocity(planck.Vec2(vx, vy));
    }
  }

  /**
   * Get body position in pixels
   */
  getPosition(id) {
    const bodyData = this.bodies.get(id);
    if (bodyData && bodyData.body) {
      const pos = bodyData.body.getPosition();
      return {
        x: this.toPixels(pos.x),
        y: this.toPixels(pos.y)
      };
    }
    return null;
  }

  /**
   * Get body angle in radians
   */
  getAngle(id) {
    const bodyData = this.bodies.get(id);
    if (bodyData && bodyData.body) {
      return bodyData.body.getAngle();
    }
    return 0;
  }

  /**
   * Destroy a body
   */
  destroyBody(id) {
    const bodyData = this.bodies.get(id);
    if (bodyData && bodyData.body) {
      this.world.destroyBody(bodyData.body);
      this.bodies.delete(id);
    }
  }

  /**
   * Step the physics simulation
   * @param {number} deltaTime - Time step in seconds
   */
  step(deltaTime) {
    // Clamp delta to prevent spiral of death
    const dt = Math.min(deltaTime, 1/30);
    
    this.world.step(dt, this.velocityIterations, this.positionIterations);
    
    // Sync sprites with physics bodies
    this.bodies.forEach((data, id) => {
      if (data.sprite && data.body) {
        const pos = data.body.getPosition();
        data.sprite.x = this.toPixels(pos.x);
        data.sprite.y = this.toPixels(pos.y);
        data.sprite.rotation = data.body.getAngle();
      }
    });
  }

  /**
   * Enable debug drawing (call in Phaser scene's create)
   */
  enableDebugDraw(scene) {
    this.debugDraw = true;
    this.debugGraphics = scene.add.graphics();
    this.debugGraphics.setDepth(1000);
  }

  /**
   * Render debug shapes (call in Phaser scene's update)
   */
  renderDebug() {
    if (!this.debugDraw || !this.debugGraphics) return;
    
    this.debugGraphics.clear();
    
    for (let body = this.world.getBodyList(); body; body = body.getNext()) {
      const pos = body.getPosition();
      const angle = body.getAngle();
      const type = body.getType();
      
      // Color based on body type
      let color;
      switch (type) {
        case 'static':
          color = 0x00ff88; // Green
          break;
        case 'dynamic':
          color = 0x00f5ff; // Cyan
          break;
        case 'kinematic':
          color = 0xffd700; // Yellow
          break;
        default:
          color = 0xffffff;
      }
      
      this.debugGraphics.lineStyle(2, color, 0.8);
      
      for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) {
        const shape = fixture.getShape();
        const shapeType = shape.getType();
        
        if (shapeType === 'circle') {
          const center = shape.getCenter();
          const radius = shape.getRadius();
          const px = this.toPixels(pos.x + center.x);
          const py = this.toPixels(pos.y + center.y);
          const pr = this.toPixels(radius);
          
          this.debugGraphics.strokeCircle(px, py, pr);
          
          // Draw rotation indicator
          this.debugGraphics.lineBetween(
            px, py,
            px + Math.cos(angle) * pr,
            py + Math.sin(angle) * pr
          );
        } else if (shapeType === 'polygon') {
          const vertices = shape.m_vertices;
          const count = shape.m_count;
          
          if (count > 0) {
            this.debugGraphics.beginPath();
            
            for (let i = 0; i < count; i++) {
              const v = vertices[i];
              // Rotate vertex
              const rx = v.x * Math.cos(angle) - v.y * Math.sin(angle);
              const ry = v.x * Math.sin(angle) + v.y * Math.cos(angle);
              
              const px = this.toPixels(pos.x + rx);
              const py = this.toPixels(pos.y + ry);
              
              if (i === 0) {
                this.debugGraphics.moveTo(px, py);
              } else {
                this.debugGraphics.lineTo(px, py);
              }
            }
            
            this.debugGraphics.closePath();
            this.debugGraphics.strokePath();
          }
        }
      }
    }
  }

  /**
   * Get body count for stats
   */
  getBodyCount() {
    return this.bodies.size;
  }

  /**
   * Clear all bodies
   */
  clear() {
    this.bodies.forEach((data, id) => {
      if (data.body) {
        this.world.destroyBody(data.body);
      }
    });
    this.bodies.clear();
    this.bodyIdCounter = 0;
  }

  /**
   * Destroy the physics world
   */
  destroy() {
    this.clear();
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
    }
  }
}

console.log('[physics.js] Physics module loaded');

// Export for module systems (optional)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PhysicsWorld };
}
