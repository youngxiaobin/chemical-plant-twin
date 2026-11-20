precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform float uSpeed;
uniform float uHighlight;
void main() {
  float band = fract(vUv.x * 7.0 - uTime * uSpeed);
  float pulse = smoothstep(0.0, 0.06, band) * smoothstep(0.42, 0.1, band);
  vec3 base = vec3(0.03, 0.28, 0.36);
  vec3 hot = vec3(0.62, 0.96, 1.0);
  float glow = 0.28 + pulse * 0.95 + uHighlight * 0.55;
  vec3 color = mix(base, hot, glow);
  float side = smoothstep(0.08, 0.5, abs(vUv.y - 0.5));
  color += vec3(0.15, 0.35, 0.45) * side;
  gl_FragColor = vec4(color, 0.96);
}
