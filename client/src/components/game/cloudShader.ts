// cloudShader.ts
import * as THREE from 'three';

export function createCloudShader(textures: Record<string, THREE.Texture>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: {
      ...textures,               // plainsTexture, forestTexture, … keep existing
      time: { value: 0.0 },

      // Tunables -------------------------------------------------------------
      cloudScale:  { value: 0.025 },   // spatial frequency of noise
      cloudSpeed:  { value: 0.03 },    // units / second the field drifts
      skyColour:   { value: new THREE.Color(0x8ec9ea) }, // #8EC9EA
      cloudColour: { value: new THREE.Color(0xffffff) },
      sunDir:      { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() }
    },

    vertexShader: /* glsl */`
      attribute vec3 instanceColor;
      attribute float instanceOpacity;
      attribute float instanceTextureId;

      varying vec3  vColor;
      varying float vOpacity;
      varying float vTextureId;
      varying vec2  vUv;
      varying vec3  vWorld;

      void main() {
        vColor      = instanceColor;
        vOpacity    = instanceOpacity;
        vTextureId  = instanceTextureId;
        vUv         = uv;

        // world-space for seamless clouds
        vec4 worldPos = modelMatrix * instanceMatrix * vec4(position,1.0);
        vWorld        = worldPos.xyz;

        gl_Position   = projectionMatrix * viewMatrix * worldPos;
      }
    `,

    fragmentShader: /* glsl */`
      precision highp float;

      varying vec3  vColor;
      varying float vOpacity;
      varying float vTextureId;
      varying vec2  vUv;
      varying vec3  vWorld;

      uniform float time;
      uniform float cloudScale;
      uniform float cloudSpeed;
      uniform vec3  skyColour;
      uniform vec3  cloudColour;
      uniform vec3  sunDir;
      
      uniform sampler2D plainsTexture;
      uniform sampler2D forestTexture;
      uniform sampler2D mountainTexture;
      uniform sampler2D waterTexture;
      uniform sampler2D desertTexture;
      uniform sampler2D swampTexture;
      uniform sampler2D grassTexture;
      uniform sampler2D sandTexture;
      uniform sampler2D woodTexture;

      // ------------- 3-D simplex-style noise --------------------------------
      vec3 hash33(vec3 p) {             // https://www.shadertoy.com/view/4dS3Wd
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.xxy + p.yzz)*p.zyx);
      }

      float noise(in vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f*f*(3.0 - 2.0*f);

        float n  = dot(hash33(i + vec3(0,0,0)), f - vec3(0,0,0));
              n += dot(hash33(i + vec3(1,0,0)), f - vec3(1,0,0));
              n += dot(hash33(i + vec3(0,1,0)), f - vec3(0,1,0));
              n += dot(hash33(i + vec3(1,1,0)), f - vec3(1,1,0));

              n += dot(hash33(i + vec3(0,0,1)), f - vec3(0,0,1));
              n += dot(hash33(i + vec3(1,0,1)), f - vec3(1,0,1));
              n += dot(hash33(i + vec3(0,1,1)), f - vec3(0,1,1));
              n += dot(hash33(i + vec3(1,1,1)), f - vec3(1,1,1));

        return n / 8.0;
      }

      float fbm(vec3 p) {
        float a = 0.5;
        float v = 0.0;
        for(int i=0;i<5;i++){
          v += a * noise(p);
          p = p*2.0 + vec3(17.0); // prevent alignment artefacts
          a *= 0.5;
        }
        return v;
      }

      // ----------- Hex border from your original shader ---------------------
      float hexBorder(vec2 uv, float w){
        vec2 q = (uv-0.5)*2.0;
        float ang = atan(q.y,q.x)+0.5236;
        float rad = length(q);
        float hd  = cos(floor(0.5+ang/1.047198)*1.047198-ang)*rad;
        float o   = step(hd,0.97);
        float i   = step(hd,0.97-w);
        return o-i;
      }

      // ----------------- Main ------------------------------------------------
      void main() {
        // ---------- NEW CLOUD PASS FOR UNEXPLORED TILES ------------ //
        if (vTextureId < 0.5) {
          // sample 3-D field: x,z plus moving y
          vec3 p = vec3(vWorld.xz * cloudScale, time * cloudSpeed);
          float d = fbm(p);

          // soft step for cloud body
          float cloudMask = smoothstep(0.45, 0.7, d);

          // fake top-lit effect
          float sun = clamp(dot(normalize(vec3(0.0,1.0,0.0)), sunDir), 0.0, 1.0);
          vec3 c = mix(skyColour, cloudColour, cloudMask);
          c += cloudMask * 0.15 * sun;  // subtle highlight

          // gentle gamma -> thicker clouds whiter
          c = pow(c, vec3(1.3));

          // slight alpha fade near border so hex edges aren't harsh
          float border = hexBorder(vUv, 0.08);
          float alpha = mix(1.0, 0.0, border);

          gl_FragColor = vec4(c, alpha);
          return;
        }

        // ------------- Everything else: existing terrain logic ---------- //
        vec3 textureColor = vec3(1.0);
        vec3 borderColor = vec3(0.5, 0.5, 0.5);

        if (vTextureId < 1.5) {
          textureColor = texture2D(plainsTexture, vUv).rgb;
          borderColor = vec3(0.8, 0.9, 0.4);
        } else if (vTextureId < 2.5) {
          textureColor = texture2D(forestTexture, vUv).rgb;
          borderColor = vec3(0.2, 0.8, 0.2);
        } else if (vTextureId < 3.5) {
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
        float border = hexBorder(vUv, 0.08);
        vec3 finalColor = textureColor;
        if (border > 0.5) {
          finalColor = mix(finalColor, borderColor, 0.8);
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