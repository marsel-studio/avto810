/* 3D-сцены на Three.js r128: тормозной диск с суппортом и учебная модель сход-развала. */
(function () {
  'use strict';
  const S = {};
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function makeRenderer(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;
    return r;
  }

  /* Студийное окружение из светящихся панелей: даёт металлу честные отражения без внешних файлов. */
  function studioEnv(renderer) {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(30, 24, 16), new THREE.MeshBasicMaterial({ color: 0x07080a, side: THREE.BackSide })));
    const panel = (w, h, pos, k, tint) => {
      const c = new THREE.Color().setRGB(k * tint[0], k * tint[1], k * tint[2]);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 0, 0); env.add(m);
    };
    panel(14, 8, [0, 12, 4], 3.2, [1, 1, 1]);
    panel(2.2, 16, [-12, 1, 3], 7, [1, 0.97, 0.92]);
    panel(2.2, 16, [12, 2, 2], 4.5, [0.8, 0.9, 1]);
    panel(16, 3, [0, 3, -13], 2.4, [0.9, 0.95, 1]);
    panel(14, 6, [0, -10, 2], 0.5, [1, 0.9, 0.8]);
    const pm = new THREE.PMREMGenerator(renderer);
    const tex = pm.fromScene(env, 0.02).texture;
    pm.dispose();
    return tex;
  }

  /* Цикл отрисовки: пауза вне экрана и на скрытой вкладке, подгонка размера. */
  function runner(stage, renderer, camera, draw, fit) {
    let vis = true, raf = 0, last = performance.now(), alive = true;
    const size = () => {
      const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
      renderer.setSize(w, h, false); camera.aspect = w / h; if (fit) fit(w, h, camera); camera.updateProjectionMatrix();
    };
    const frame = now => {
      raf = 0; if (!alive || !vis || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      draw(dt, now / 1000); raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && alive && vis && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; kick(); }, { rootMargin: '120px' });
    io.observe(stage);
    const ro = new ResizeObserver(() => { size(); draw(0, performance.now() / 1000); });
    ro.observe(stage);
    document.addEventListener('visibilitychange', kick);
    size(); draw(0, 0); kick();
    return () => { alive = false; io.disconnect(); ro.disconnect(); cancelAnimationFrame(raf); };
  }

  function sector(r0, r1, a0, a1) {
    const s = new THREE.Shape();
    s.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
    s.lineTo(Math.cos(a0) * r1, Math.sin(a0) * r1);
    s.absarc(0, 0, r1, a0, a1, false);
    s.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0);
    s.absarc(0, 0, r0, a1, a0, true);
    return s;
  }
  function slab(shape, depth, z, mat, bevel) {
    const b = bevel == null ? 0.018 : bevel;
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 36 });
    const m = new THREE.Mesh(g, mat); m.position.z = z; return m;
  }

  /* ---------- Тормозной диск ---------- */
  S.disc = function (stage, opts) {
    opts = opts || {};
    const canvas = stage.querySelector('canvas');
    const renderer = makeRenderer(canvas);
    const scene = new THREE.Scene();
    scene.environment = studioEnv(renderer);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0, 5);

    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(3, 4, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9db8ff, 0.7); rim.position.set(-4, 1, -3); scene.add(rim);

    const root = new THREE.Group(); scene.add(root);
    const spin = new THREE.Group(); root.add(spin);

    const D = 0.13;
    const iron = new THREE.MeshStandardMaterial({ color: 0xc5cad2, metalness: 1, roughness: 0.28 });
    const castHat = new THREE.MeshStandardMaterial({ color: 0x9a9fa8, metalness: 1, roughness: 0.42, side: THREE.DoubleSide });
    const groove = new THREE.MeshStandardMaterial({ color: 0x70757e, metalness: 1, roughness: 0.55 });

    const sh = new THREE.Shape(); sh.absarc(0, 0, 1, 0, Math.PI * 2, false);
    const bore = new THREE.Path(); bore.absarc(0, 0, 0.44, 0, Math.PI * 2, true); sh.holes.push(bore);
    [[0.73, 20, 0], [0.87, 20, 0.5]].forEach(([r, n, off]) => {
      for (let i = 0; i < n; i++) {
        const a = (i + off) / n * Math.PI * 2, p = new THREE.Path();
        p.absarc(Math.cos(a) * r, Math.sin(a) * r, 0.036, 0, Math.PI * 2, true); sh.holes.push(p);
      }
    });
    const rotor = slab(sh, D, -D / 2, iron, 0.008); spin.add(rotor);

    [[0.5, 0.52], [0.6, 0.61], [0.945, 0.965]].forEach(([a, b]) => {
      [1, -1].forEach(side => {
        const ring = new THREE.Mesh(new THREE.RingGeometry(a, b, 96), groove);
        ring.position.z = side * (D / 2 + 0.0105); if (side < 0) ring.rotation.y = Math.PI; spin.add(ring);
      });
    });

    const hat = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.14, 0), new THREE.Vector2(0.14, 0.21), new THREE.Vector2(0.4, 0.21),
      new THREE.Vector2(0.46, 0.15), new THREE.Vector2(0.46, 0)
    ], 64), castHat);
    hat.rotation.x = Math.PI / 2; hat.position.z = -D / 2; spin.add(hat);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(0.4, 48), castHat); cap.position.z = -D / 2 + 0.21; spin.add(cap);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + 0.3;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.1, 16), iron);
      bolt.rotation.x = Math.PI / 2; bolt.position.set(Math.cos(a) * 0.27, Math.sin(a) * 0.27, -D / 2 + 0.21 + 0.05); spin.add(bolt);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), new THREE.MeshBasicMaterial({ color: 0x050607 }));
      hole.position.set(Math.cos(a) * 0.27, Math.sin(a) * 0.27, -D / 2 + 0.2105); spin.add(hole);
    }

    const calMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(opts.caliper || '#c8102e'), metalness: 0.25, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.08 });
    const padMat = new THREE.MeshStandardMaterial({ color: 0x25272b, metalness: 0.1, roughness: 0.92 });
    const cal = new THREE.Group(); cal.rotation.z = 0.62; root.add(cal);
    const A = 0.4;
    cal.add(slab(sector(0.6, 1.04, -A, A), 0.2, D / 2 + 0.04, calMat));
    cal.add(slab(sector(0.6, 1.04, -A, A), 0.2, -D / 2 - 0.04 - 0.2, calMat));
    cal.add(slab(sector(1.05, 1.17, -A, A), D + 0.08 + 0.4, -(D / 2 + 0.04 + 0.2), calMat));
    cal.add(slab(sector(0.66, 1.0, -(A - 0.04), A - 0.04), 0.04, D / 2, padMat, 0));
    cal.add(slab(sector(0.66, 1.0, -(A - 0.04), A - 0.04), 0.04, -D / 2 - 0.04, padMat, 0));
    [-0.22, 0.22].forEach(a => {
      const nip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 14), iron);
      nip.position.set(Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0.0); nip.rotation.z = a - Math.PI / 2 + Math.PI; cal.add(nip);
    });

    const anchorCal = new THREE.Object3D(); anchorCal.position.set(Math.cos(0.62 + 0.3) * 1.1, Math.sin(0.62 + 0.3) * 1.1, 0.33); root.add(anchorCal);
    const anchorDisc = new THREE.Object3D(); anchorDisc.position.set(Math.cos(3.55) * 0.9, Math.sin(3.55) * 0.9, D / 2 + 0.02); root.add(anchorDisc);
    const tags = [[anchorCal, stage.querySelector('[data-tag="caliper"]')], [anchorDisc, stage.querySelector('[data-tag="disc"]')]];

    let ux = 0, uy = 0, px = 0, py = 0, cx = 0, cy = 0, vx = 0, drag = null, spinSpeed = opts.spin == null ? 0.25 : opts.spin, idle = 0;
    const base = { y: -0.5, x: 0.1 };
    canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); stage.classList.add('grabbing'); });
    canvas.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect(); px = ((e.clientX - r.left) / r.width - 0.5) * 2; py = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
      ux += dx * 0.009; uy = Math.max(-0.7, Math.min(0.7, uy + dy * 0.006)); vx = dx * 0.009; idle = 0;
    });
    const end = () => { drag = null; stage.classList.remove('grabbing'); };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', () => { px = 0; py = 0; });

    const v = new THREE.Vector3();
    const stop = runner(stage, renderer, camera, (dt, t) => {
      if (!drag) { ux += vx; vx *= 0.93; }
      idle += dt;
      const sway = reduce() ? 0 : Math.sin(t * 0.35) * 0.22;
      const ty = base.y + ux + sway + px * 0.18, tx = base.x + uy + py * 0.08;
      cy += (ty - cy) * (dt ? 0.08 : 1); cx += (tx - cx) * (dt ? 0.08 : 1);
      root.rotation.y = cy; root.rotation.x = cx;
      if (!reduce()) spin.rotation.z -= dt * spinSpeed;
      const w = stage.clientWidth, h = stage.clientHeight;
      tags.forEach(([a, el]) => {
        if (!el) return; a.getWorldPosition(v); v.project(camera);
        el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-v.y * 0.5 + 0.5) * h).toFixed(1) + 'px)';
      });
      renderer.render(scene, camera);
    }, (w, h, cam) => { const asp = w / h; cam.position.z = asp < 1 ? 5 / Math.min(1, asp * 1.25) : 5; });

    return {
      setCaliper(c) { calMat.color.set(c); },
      setSpin(s) { spinSpeed = s; },
      destroy() { stop(); renderer.dispose(); }
    };
  };

  /* ---------- Сход-развал ---------- */
  S.align = function (stage, opts) {
    opts = opts || {};
    const canvas = stage.querySelector('canvas');
    const renderer = makeRenderer(canvas);
    const scene = new THREE.Scene();
    scene.environment = studioEnv(renderer);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    camera.position.set(2.2, 2.2, 6.2); camera.lookAt(0, 0.55, 0.2);

    const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(3, 6, 4); scene.add(sun);
    const world = new THREE.Group(); scene.add(world);

    const grid = new THREE.GridHelper(10, 20, 0x2b3038, 0x191c21); world.add(grid);
    const rubber = new THREE.MeshStandardMaterial({ color: 0x121314, roughness: 0.85, metalness: 0.05 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xd2d6dd, metalness: 1, roughness: 0.25 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.7, metalness: 0.4 });
    const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(opts.accent || '#d4202c') });
    const refMat = new THREE.MeshBasicMaterial({ color: 0x6d7480, transparent: true, opacity: 0.8 });

    const R = 0.62, Y = R;
    const wheels = [1, -1].map(side => {
      const pos = new THREE.Group(); pos.position.set(side * 1.45, Y, 0); world.add(pos);
      const toe = new THREE.Group(); pos.add(toe);
      const cam = new THREE.Group(); toe.add(cam);
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.2, 28, 72), rubber); tire.rotation.y = Math.PI / 2; cam.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 48), metal); rim.rotation.z = Math.PI / 2; cam.add(rim);
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.02, 48), dark); face.rotation.z = Math.PI / 2; face.position.x = side * 0.15; cam.add(face);
      for (let i = 0; i < 5; i++) {
        const sp = new THREE.Group(); sp.rotation.x = i / 5 * Math.PI * 2;
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.3, 0.075), metal); b.position.set(side * 0.17, 0.19, 0); sp.add(b); cam.add(sp);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 24), metal); hub.rotation.z = Math.PI / 2; hub.position.x = side * 0.18; cam.add(hub);
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.014, 1.7, 0.014), beamMat); up.position.y = 0.85; cam.add(up);
      const fwd = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 3.2), beamMat); fwd.position.z = 1.6; toe.add(fwd);
      const plumb = new THREE.Mesh(new THREE.BoxGeometry(0.01, 1.7, 0.01), refMat); plumb.position.y = 0.85; pos.add(plumb);
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 3.2), refMat); line.position.z = 1.6; pos.add(line);
      return { side, toe, cam };
    });
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.9, 20), metal); axle.rotation.z = Math.PI / 2; axle.position.y = Y; world.add(axle);
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 1.2), dark); block.position.set(0, Y, -0.25); world.add(block);

    const target = { c: 0, t: 0 }, cur = { c: 0, t: 0 }, K = 3 * Math.PI / 180;
    let yaw = -0.35, drag = null;
    canvas.addEventListener('pointerdown', e => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); stage.classList.add('grabbing'); });
    canvas.addEventListener('pointermove', e => { if (drag == null) return; yaw = Math.max(-1.1, Math.min(0.6, yaw + (e.clientX - drag) * 0.008)); drag = e.clientX; });
    const end = () => { drag = null; stage.classList.remove('grabbing'); };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

    const stop = runner(stage, renderer, camera, dt => {
      const f = dt ? 0.14 : 1;
      cur.c += (target.c - cur.c) * f; cur.t += (target.t - cur.t) * f;
      world.rotation.y += (yaw - world.rotation.y) * (dt ? 0.12 : 1);
      wheels.forEach(w => { w.cam.rotation.z = -w.side * cur.c * K; w.toe.rotation.y = -w.side * cur.t * K; });
      renderer.render(scene, camera);
    }, (w, h, cam) => { const asp = w / h; cam.fov = asp < 1 ? 52 : 34; });

    return {
      set(c, t) { target.c = c; target.t = t; },
      setAccent(c) { beamMat.color.set(c); },
      destroy() { stop(); renderer.dispose(); }
    };
  };

  window.Scenes = S;
})();
