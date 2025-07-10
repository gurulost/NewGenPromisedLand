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

      // ------------- 3-D simplex helpers -------------
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }

      float snoise(vec3 v){
        const vec2  C = vec2(1.0/6.0, 1.0/3.0);
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

        // First corner
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);

        // Other corners
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );

        //  x0, x1, x2, x3
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        // Permutations
        i = mod289(i);
        vec4 p = permute( permute( permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

        // Gradients
        vec3  ns = 1.0/7.0 * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ *ns.x + ns.y;
        vec4 y = y_ *ns.x + ns.y;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);

        // Normalise gradients
        vec4 norm = inversesqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

        // Mix contributions
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                      dot(p2,x2), dot(p3,x3) ) );
      }

      float fbm(vec3 p){
        float v = 0.0;
        float a = 0.5;
        for(int i=0;i<5;i++){
            v += a * snoise(p);
            p = p*2.0 + vec3(17.0);
            a *= 0.5;
        }
        return v;        // signed –1…+1
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
        // ---------- UNEXPLORED CLOUD LAYER ----------
        if (vTextureId < 0.5) {

            // 3-D position: world X-Z plus animated Y
            vec3 p = vec3(vWorld.xz * 0.025, time * 0.03);

            // signed 3-D simplex noise  (returns –1 … +1)
            float d = fbm(p);                // 5-octave fBM

            // remap to 0-1 range
            d = d * 0.5 + 0.5;

            // cloud body
            float clouds = smoothstep(0.40, 0.65, d);

            // colours
            vec3 sky   = vec3(0.53, 0.81, 0.92);   // #87CEEB-ish
            vec3 cloud = vec3(1.0);

            gl_FragColor = vec4(mix(sky, cloud, clouds), 1.0);
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