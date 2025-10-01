const PARTICLE_COUNT = 140;
const particles = [];
const baseFlowStrength = 0.05;
const flowScale = 0.0018;
const motionSmoothing = 0.08;
let smoothedForce;
let orientationVector;
let lastOrientationTime = 0;
let permissionGranted = false;
let needsPermission = false;
let orientationMessageShown = false;
let statusLabel;
let indicatorLabel;
let indicatorRow;
let motionButton;

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '-1');

  colorMode(HSB, 360, 100, 100, 100);
  noStroke();

  smoothedForce = createVector(0, 0);
  orientationVector = createVector(0, 0);

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    particles.push(new Particle());
  }

  statusLabel = document.getElementById('motion-status');
  indicatorLabel = document.getElementById('indicator-label');
  indicatorRow = document.getElementById('motion-indicator');
  motionButton = document.getElementById('enable-motion');

  if (typeof DeviceOrientationEvent !== 'undefined') {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      needsPermission = true;
      permissionGranted = false;
      if (motionButton) {
        motionButton.hidden = false;
        motionButton.addEventListener('click', requestMotionAccess, { once: true });
      }
      updateStatus('Tap “Enable motion access”, then tilt your device to steer the swarm.');
      setIndicator(false, 'Awaiting motion access…');
    } else {
      permissionGranted = true;
      updateStatus('Tilt your device to steer the swarm. Drag to guide it on desktop.');
      setIndicator(false, 'Waiting for motion data…');
    }

    window.addEventListener('deviceorientation', handleOrientation, true);
  } else {
    updateStatus('Drag across the canvas to guide the particle swarm.');
    setIndicator(false, 'Motion sensors unavailable. Drag to guide.');
  }
}

function draw() {
  background(235, 90, 6, 10);

  const targetForce = createVector(0, 0);
  const now = Date.now();
  const orientationActive = permissionGranted && now - lastOrientationTime < 900;

  if (orientationActive) {
    setIndicator(true, 'Motion signal locked.');
    targetForce.set(orientationVector.x, -orientationVector.y).mult(0.55);
  } else if ((touches && touches.length > 0) || mouseIsPressed) {
    if (Number.isFinite(mouseX) && Number.isFinite(mouseY)) {
      const pointer = createVector(mouseX - width / 2, mouseY - height / 2);
      const scale = Math.max(min(width, height) / 2, 1);
      pointer.div(scale).limit(1).mult(0.65);
      targetForce.set(pointer);
    } else {
      targetForce.set(0, 0);
    }
    setIndicator(false, 'Guiding swarm with touch input.');
  } else {
    const idleMessage = permissionGranted
      ? 'Waiting for motion data…'
      : needsPermission
      ? 'Awaiting motion access…'
      : 'Tilt or drag to guide the swarm.';
    setIndicator(false, idleMessage);

    if (!needsPermission) {
      targetForce.set(
        sin(frameCount * 0.01) * 0.18,
        cos(frameCount * 0.013) * 0.18
      );
    }
  }

  smoothedForce.lerp(targetForce, motionSmoothing);

  particles.forEach((particle) => {
    particle.applyForce(smoothedForce);
    particle.applyFlow(frameCount);
    particle.update();
    particle.draw();
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function requestMotionAccess() {
  if (!needsPermission || typeof DeviceOrientationEvent === 'undefined') {
    return;
  }

  DeviceOrientationEvent.requestPermission()
    .then((response) => {
      if (response === 'granted') {
        permissionGranted = true;
        orientationMessageShown = false;
        updateStatus('Tilt your device to steer the swarm.');
        setIndicator(false, 'Waiting for motion data…');
        if (motionButton) {
          motionButton.hidden = true;
        }
      } else {
        permissionGranted = false;
        updateStatus('Motion access denied. Drag with your finger to guide the swarm.');
        setIndicator(false, 'Motion access denied. Drag to guide.');
      }
    })
    .catch(() => {
      permissionGranted = false;
      updateStatus('Motion request failed. Drag with your finger to guide the swarm.');
      setIndicator(false, 'Motion request failed. Drag to guide.');
    });
}

function handleOrientation(event) {
  if (needsPermission && !permissionGranted) {
    return;
  }

  const gamma = event.gamma ?? 0; // left-right tilt
  const beta = event.beta ?? 0; // front-back tilt

  const normalizedX = constrain(gamma, -45, 45) / 45;
  const normalizedY = constrain(beta, -45, 45) / 45;

  orientationVector.set(normalizedX, normalizedY);
  lastOrientationTime = Date.now();

  if (!orientationMessageShown) {
    updateStatus('Motion data streaming. Tilt to guide the swarm!');
    orientationMessageShown = true;
  }
}

function updateStatus(message) {
  if (statusLabel && statusLabel.textContent !== message) {
    statusLabel.textContent = message;
  }
}

function setIndicator(active, message) {
  if (!indicatorRow) {
    return;
  }

  indicatorRow.classList.toggle('active', !!active);

  if (indicatorLabel && message && indicatorLabel.textContent !== message) {
    indicatorLabel.textContent = message;
  }
}

class Particle {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.vel = p5.Vector.random2D().mult(random(0.2, 1.2));
    this.acc = createVector(0, 0);
    this.size = random(6, 16);
    this.hue = random(180, 230);
    this.alpha = random(40, 70);
    this.twinkleOffset = random(TAU);
  }

  applyForce(force) {
    this.acc.add(force);
  }

  applyFlow(frame) {
    const n = noise(this.pos.x * flowScale, this.pos.y * flowScale, frame * 0.004);
    const angle = TAU * n;
    const flow = p5.Vector.fromAngle(angle).mult(baseFlowStrength);
    this.acc.add(flow);
  }

  update() {
    this.vel.add(this.acc);
    this.vel.limit(2.4);
    this.pos.add(this.vel);
    this.acc.mult(0);
    this.wrapAround();
  }

  wrapAround() {
    if (this.pos.x < -this.size) this.pos.x = width + this.size;
    if (this.pos.x > width + this.size) this.pos.x = -this.size;
    if (this.pos.y < -this.size) this.pos.y = height + this.size;
    if (this.pos.y > height + this.size) this.pos.y = -this.size;
  }

  draw() {
    const pulse = (sin(frameCount * 0.05 + this.twinkleOffset) + 1) * 0.5;
    const brightness = map(pulse, 0, 1, 60, 95);
    fill(this.hue, 80, brightness, this.alpha + pulse * 20);
    ellipse(this.pos.x, this.pos.y, this.size, this.size);
  }
}
