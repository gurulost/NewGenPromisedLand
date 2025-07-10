// cloudShaderStunning.ts
import * as THREE from 'three';

/**
 * Returns a ShaderMaterial that produces beautiful, 3‑D drifting clouds
 * over unexplored hex tiles.  Terrain tiles fall back to the supplied
 * textures.  All artistic controls are exposed as uniforms.
 */
export function createStunningCloudMaterial(textures: Record<string, THREE.Texture>) {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,          // clouds can overlap nicely
    uniforms: {
      // terrain textures with proper format
      plainsTexture: textures.plainsTexture,
      forestTexture: textures.forestTexture,
      mountainTexture: textures.mountainTexture,
      waterTexture: textures.waterTexture,
      desertTexture: textures.desertTexture,
      swampTexture: textures.swampTexture,
      grassTexture: textures.grassTexture,
      sandTexture: textures.sandTexture,
      woodTexture: textures.woodTexture,

      // time & animation
      time:        { value: 0 },
      cloudSpeed:  { value: 0.025 },   // world units per second
      cloudScale:  { value: 0.03 },    // spatial frequency of noise
      cloudHeight: { value: 0.40 },    // metres the peaks can rise

      // colour art direction
      skyBottom:   { value: new THREE.Color('#7fbce9') },  // horizon blue
      skyTop:      { value: new THREE.Color('#cbe9ff') },  // zenith
      cloudBright: { value: new THREE.Color('#ffffff') },
      cloudShadow: { value: new THREE.Color('#d3e0ed') },

      // lighting
      sunDir:      { value: new THREE.Vector3(0.35, 0.8, 0.4).normalize() },
      rimPower:    { value: 3.0 }
    },

    vertexShader: /* glsl */`
      attribute vec3  instanceColor;
      attribute float instanceOpacity;
      attribute float instanceTextureId;

      varying vec3  vColor;
      varying float vOpacity;
      varying float vTextureId;
      varying vec2  vUv;
      varying vec3  vWorld;
      varying vec3  vNormal;

      uniform float time;
      uniform float cloudScale;
      uniform float cloudSpeed;
      uniform float cloudHeight;

      // ───── fbm noise (5 octaves of hash‑based value noise) ─────
      vec3 hash33(vec3 p){
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.xxy + p.yzz) * p.zyx);
      }
      float noise(vec3 p){
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n = 0.0;
        for (int z=0; z<=1; z++)
        for (int y=0; y<=1; y++)
        for (int x=0; x<=1; x++){
          vec3 g = vec3(float(x), float(y), float(z));
          n += dot(hash33(i + g), f - g);
        }
        return n * 0.125; // divide by 8
      }
      float fbm(vec3 p){
        float a = 0.5, v = 0.0;
        for(int i=0;i<5;i++){
          v += a * noise(p);
          p = p * 2.0 + 17.0;
          a *= 0.5;
        }
        return v;
      }

      // approximate displaced normal by central differencing
      vec3 displacedNormal(in vec3 worldPos, in float baseDisp){
        float eps = 0.05;
        vec3 dx = vec3(eps, 0.0, 0.0);
        vec3 dz = vec3(0.0, 0.0, eps);
        float d1 = fbm(vec3((worldPos.x+eps) * cloudScale,
                            (worldPos.z)     * cloudScale,
                            time * cloudSpeed)) * cloudHeight;
        float d2 = fbm(vec3((worldPos.x)     * cloudScale,
                            (worldPos.z+eps) * cloudScale,
                            time * cloudSpeed)) * cloudHeight;
        vec3 p1 = vec3(eps, d1 - baseDisp, 0.0);
        vec3 p2 = vec3(0.0, d2 - baseDisp, eps);
        return normalize(cross(p2, p1));
      }

      void main(){
        vColor      = instanceColor;
        vOpacity    = instanceOpacity;
        vTextureId  = instanceTextureId;
        vUv         = uv;

        // world position before displacement
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld     = world.xyz;

        // only puff up unexplored tiles
        if (vTextureId < 0.5){
          float disp = fbm(vec3(vWorld.xz * cloudScale,
                                time      * cloudSpeed)) * cloudHeight;
          world.y += disp;
          vNormal = displacedNormal(vWorld, disp);
        } else {
          vNormal = normalMatrix * normal; // regular terrain
        }

        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,

    fragmentShader: /* glsl */`
      precision highp float;

      // uniforms
      uniform float time;
      uniform float cloudScale;
      uniform float cloudSpeed;
      uniform vec3  skyBottom, skyTop;
      uniform vec3  cloudBright, cloudShadow;
      uniform vec3  sunDir;
      uniform float rimPower;

      // terrain samplers
      uniform sampler2D plainsTexture;
      uniform sampler2D forestTexture;
      uniform sampler2D mountainTexture;
      uniform sampler2D waterTexture;
      uniform sampler2D desertTexture;
      uniform sampler2D swampTexture;
      uniform sampler2D grassTexture;
      uniform sampler2D sandTexture;
      uniform sampler2D woodTexture;

      varying vec3  vColor;
      varying float vOpacity;
      varying float vTextureId;
      varying vec2  vUv;
      varying vec3  vWorld;
      varying vec3  vNormal;

      // same fbm for cloud alpha
      vec3 hash33(vec3 p){
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.xxy + p.yzz) * p.zyx);
      }
      float noise(vec3 p){
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n = 0.0;
        for (int z=0; z<=1; z++)
        for (int y=0; y<=1; y++)
        for (int x=0; x<=1; x++){
          vec3 g = vec3(float(x), float(y), float(z));
          n += dot(hash33(i + g), f - g);
        }
        return n * 0.125;
      }
      float fbm(vec3 p){
        float a = 0.5, v = 0.0;
        for(int i=0;i<5;i++){
          v += a * noise(p);
          p = p * 2.0 + 17.0;
          a *= 0.5;
        }
        return v;
      }

      // keep your existing border look
      float hexBorder(vec2 uv, float w){
        vec2 q = (uv - 0.5) * 2.0;
        float ang = atan(q.y, q.x) + 0.5236;
        float rad = length(q);
        float hd  = cos(floor(0.5 + ang / 1.047198) * 1.047198 - ang) * rad;
        return step(hd, 0.97) - step(hd, 0.97 - w);
      }

      void main() {
        // ───── unexplored tile → clouds ─────
        if (vTextureId < 0.5){
          // sample noise for density and soft edges
          float n = fbm(vec3(vWorld.xz * cloudScale,
                             time      * cloudSpeed));
          float cloud = smoothstep(0.45, 0.72, n);

          // sky gradient based on height (Y world) – subtle
          float hFactor = clamp((vWorld.y + 2.0) / 2.5, 0.0, 1.0);
          vec3 sky = mix(skyBottom, skyTop, hFactor);

          // basic lambert + rim for fluffiness
          float ndotl = clamp(dot(normalize(vNormal), sunDir), 0.0, 1.0);
          float rim   = pow(1.0 - ndotl, rimPower);

          vec3 col = mix(sky, cloudShadow, cloud);      // base cloud
          col = mix(col, cloudBright, ndotl * cloud);   // sun highlight
          col += rim * cloud * 0.25;                    // rim light

          // gently overlay hex border
          float border = hexBorder(vUv, 0.07);
          col = mix(col, vec3(0.18), border);

          gl_FragColor = vec4(col, vOpacity);
          return;
        }

        // ───── explored tile → sample existing textures ─────
        vec3 textureColor = vec3(1.0);
        vec3 borderColor = vec3(0.5, 0.5, 0.5);

        if (vTextureId < 1.5) {
          textureColor = texture2D(plainsTexture, vUv).rgb;
          borderColor = vec3(0.8, 0.9, 0.4);
        } else if (vTextureId < 2.5) {
          textureColor = texture2D(forestTexture, vUv).rgb;
          borderColor = vec3(0.2, 0.8, 0.2);
        } else if (vTextureId < 3.5) {
          // Apply same mountain texture rotation as original
          vec2 rotatedUv = vUv - 0.5;
          float angle = -0.698132;
          float cosAngle = cos(angle);
          float sinAngle = sin(angle);
          vec2 mountainUv = vec2(rotatedUv.x * cosAngle - rotatedUv.y * sinAngle, rotatedUv.x * sinAngle + rotatedUv.y * cosAngle) + 0.5;
          textureColor = texture2D(mountainTexture, mountainUv).rgb;
          borderColor = vec3(0.6, 0.4, 0.3);
        } else if (vTextureId < 4.5) {
          textureColor = texture2D(waterTexture, vUv).rgb;
          borderColor = vec3(0.2, 0.7, 0.9);
        } else if (vTextureId < 5.5) {
          textureColor = texture2D(desertTexture, vUv).rgb;
          borderColor = vec3(0.9, 0.7, 0.4);
        } else if (vTextureId < 6.5) {
          textureColor = texture2D(swampTexture, vUv).rgb;
          borderColor = vec3(0.4, 0.6, 0.3);
        }

        // Apply hex border
        float border = hexBorder(vUv, 0.12); // Increased from 0.07 to 0.12 for thicker borders
        vec3 finalColor = textureColor;
        if (border > 0.5) {
          finalColor = mix(finalColor, borderColor, 0.9); // Increased from 0.8 to 0.9 for stronger border colors
        }

        // Apply the instance color tint (for cities, valid moves, etc.)
        finalColor *= vColor;

        // Dim explored tiles that are not currently visible (opacity is 0.85)
        if (vOpacity < 1.0) {
            vec3 fogColor = vec3(0.4, 0.5, 0.6);
            finalColor = mix(finalColor, fogColor, 0.08);
        }

        gl_FragColor = vec4(finalColor, vOpacity);
      }
    `
  });
}